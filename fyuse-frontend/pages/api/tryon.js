import formidable from "formidable";
import fs from "node:fs";
import jwt from "jsonwebtoken";
import sharp from "sharp";

const MAX_SEED = 999999;
const POLL_INTERVAL_MS = 1000;
const MAX_RETRIES = 12;
const INITIAL_WAIT_MS = 9000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const config = {
  api: {
    bodyParser: false,
  },
};

// Generate JWT token using access credentials
function generateToken(accessKeyId, accessKeySecret) {
  const payload = {
    access_key_id: accessKeyId,
    // Add timestamp to ensure token freshness
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, accessKeySecret);
}

async function processImage(buffer) {
  try {
    const processedBuffer = await sharp(buffer)
      .raw()
      .ensureAlpha()
      .toColorspace("srgb")
      .jpeg({
        quality: 100,
        chromaSubsampling: "4:4:4",
      })
      .toBuffer();

    return processedBuffer;
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
}

export default async function tryonHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const startTime = Date.now();
  console.log("Starting processing at:", startTime);

  try {
    const form = formidable({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024,
      maxFieldsSize: 100 * 1024 * 1024,
    });

    let [fields, files] = await form.parse(req);

    if (!files || !files.personImg || !files.garmentImg) {
      res.status(400).json({
        error: "Empty image",
        image: null,
        seed: 0,
        info: "Empty image",
      });
      return;
    }

    const personImgFile = Array.isArray(files.personImg)
      ? files.personImg[0]
      : files.personImg;
    const garmentImgFile = Array.isArray(files.garmentImg)
      ? files.garmentImg[0]
      : files.garmentImg;

    const randomizeSeed = Array.isArray(fields.randomizeSeed)
      ? fields.randomizeSeed[0]
      : fields.randomizeSeed;
    const seedField = Array.isArray(fields.seed) ? fields.seed[0] : fields.seed;
    const usedSeed =
      randomizeSeed === "true"
        ? Math.floor(Math.random() * MAX_SEED)
        : Number.parseInt(seedField || "0");

    try {
      const personImgBuffer = await fs.promises.readFile(
        personImgFile.filepath
      );
      const garmentImgBuffer = await fs.promises.readFile(
        garmentImgFile.filepath
      );

      const processedPersonImg = await processImage(personImgBuffer);
      const processedGarmentImg = await processImage(garmentImgBuffer);

      const personImgBase64 = processedPersonImg.toString("base64");
      const garmentImgBase64 = processedGarmentImg.toString("base64");

      await Promise.all([
        fs.promises.unlink(personImgFile.filepath),
        fs.promises.unlink(garmentImgFile.filepath),
      ]);

      const baseUrl = process.env.KOLORS_API_URL;
      const accessKeyId = process.env.ACCESS_KEY_ID;
      const accessKeySecret = process.env.ACCESS_KEY_SECRET;

      if (!baseUrl || !accessKeyId || !accessKeySecret) {
        res.status(500).json({
          error: "Missing API configuration",
          image: null,
          seed: usedSeed,
          info: "Configuration error",
        });
        return;
      }

      // Generate JWT token using credentials
      const token = generateToken(accessKeyId, accessKeySecret);

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const payload = {
        clothImage: garmentImgBase64,
        humanImage: personImgBase64,
        seed: usedSeed,
      };

      const submitUrl = `${baseUrl}/Submit`;
      console.log("Post start time:", Date.now() - startTime);

      const postResponse = await fetch(submitUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        timeout: 50000,
      });

      console.log("Post end time:", Date.now() - startTime);

      if (!postResponse.ok) {
        throw new Error(
          `API error: ${postResponse.status} ${postResponse.statusText}`
        );
      }

      const postData = await postResponse.json();
      const postResult = postData.result;

      if (postResult.status !== "success") {
        throw new Error(postResult.message || "API request failed");
      }

      const taskId = postResult.result;
      await sleep(INITIAL_WAIT_MS);

      let resultImage = null;
      let info = "";
      let errLog = "";

      console.log("Get start time:", Date.now() - startTime);

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const queryUrl = `${baseUrl}/Query?taskId=${taskId}`;
          const queryResponse = await fetch(queryUrl, {
            method: "GET",
            headers,
            timeout: 20000,
          });

          if (!queryResponse.ok) {
            errLog = `API error: ${queryResponse.status} ${queryResponse.statusText}`;
            info = "API error occurred";
            break;
          }

          const queryData = await queryResponse.json();
          const queryResult = queryData.result;

          if (queryResult.status === "success") {
            resultImage = queryResult.result;
            info = "Success";
            break;
          }
          if (queryResult.status === "error") {
            errLog = queryResult.message || "Status is Error";
            info = "API processing error";
            break;
          }

          await sleep(POLL_INTERVAL_MS);
        } catch (error) {
          console.error("Poll error:", error);
          errLog = error.message;
          info = "Request timeout, please try again";
        }
      }

      console.log("Get end time:", Date.now() - startTime);
      console.log("Total time used:", Date.now() - startTime);

      if (info === "") {
        errLog = `No result after ${MAX_RETRIES} retries`;
        info = "Request timeout, please try again";
      }

      if (info !== "Success") {
        console.error("Error Log:", errLog);
        res.status(500).json({
          error: errLog,
          image: null,
          seed: usedSeed,
          info,
        });
        return;
      }

      res.status(200).json({
        image: resultImage,
        seed: usedSeed,
        info,
      });
    } catch (processingError) {
      console.error("Processing error:", processingError);
      res.status(500).json({
        error: processingError.message,
        image: null,
        seed: usedSeed,
        info: "Processing error occurred",
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      error: error.message,
      image: null,
      seed: 0,
      info: "Unexpected error occurred",
    });
  }
}
