import formidable from "formidable";
import fs from "node:fs";
import jwt from "jsonwebtoken";

const MAX_SEED = 999999;
const POLL_INTERVAL_MS = 1000;
const MAX_RETRIES = 12;
const INITIAL_WAIT_MS = 9000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Disable the default body parser for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function tryonHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Create formidable instance with multiples enabled for consistent file handling
    const form = formidable({ multiples: true, keepExtensions: true });
    const { fields, files } = await form.parse(req);

    // Log parsed data (remove or comment out in production)
    console.log("Parsed fields:", fields);
    console.log("Parsed files:", files);

    // More detailed file validation
    if (!files || !files.personImg || !files.garmentImg) {
      console.error('File validation failed. Files received:', files);
      res.status(400).json({
        error: "Missing required image files",
        image: null,
        seed: 0,
        info: files ? `Received files: ${Object.keys(files).join(', ')}` : 'No files received',
      });
      return;
    }

    // Ensure file values are handled correctly whether they're arrays or not
    const personImgFile = Array.isArray(files.personImg)
      ? files.personImg[0]
      : files.personImg;
    const garmentImgFile = Array.isArray(files.garmentImg)
      ? files.garmentImg[0]
      : files.garmentImg;

    if (!personImgFile || !garmentImgFile) {
      res.status(400).json({
        error: "Missing required images",
        image: null,
        seed: 0,
        info: "Empty image",
      });
      return;
    }

    // Get field values safely (handling possible array values)
    const randomizeSeed = Array.isArray(fields.randomizeSeed)
      ? fields.randomizeSeed[0]
      : fields.randomizeSeed;
    const seedField = Array.isArray(fields.seed) ? fields.seed[0] : fields.seed;

    // Determine the seed value
    const usedSeed =
      randomizeSeed === "true"
        ? Math.floor(Math.random() * MAX_SEED)
        : Number.parseInt(seedField || "0");

    // Read files and convert to base64
    const personImgBuffer = await fs.promises.readFile(personImgFile.filepath);
    const garmentImgBuffer = await fs.promises.readFile(
      garmentImgFile.filepath
    );
    const personImgBase64 = personImgBuffer.toString("base64");
    const garmentImgBase64 = garmentImgBuffer.toString("base64");

    // Clean up temporary files
    await Promise.all([
      fs.promises.unlink(personImgFile.filepath),
      fs.promises.unlink(garmentImgFile.filepath),
    ]);

    // Prepare payload for the try-on API
    const payload = {
      humanImage: personImgBase64,
      clothImage: garmentImgBase64,
      seed: usedSeed,
    };

    // Retrieve configuration from environment variables
    const baseUrl = process.env.KOLORS_API_URL;
    const accessKeyId = process.env.ACCESS_KEY_ID;
    const accessKeySecret = process.env.ACCESS_KEY_SECRET;

    if (!baseUrl || !accessKeyId || !accessKeySecret) {
      res.status(500).json({
        error:
          "Missing API configuration. Please set KOLORS_API_URL, ACCESS_KEY_ID, and ACCESS_KEY_SECRET in your environment.",
        image: null,
        seed: usedSeed,
        info: "Configuration error",
      });
      return;
    }

    // Generate JWT token for the try-on API
    const token = jwt.sign({}, accessKeySecret, {
      algorithm: "HS256",
      issuer: accessKeyId,
      expiresIn: "1h",
    });

    // Set up headers for the external API call
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Remove any trailing slash from the base URL to avoid double slashes
    const trimmedBaseUrl = baseUrl.endsWith("/")
      ? baseUrl.slice(0, -1)
      : baseUrl;
    const submitUrl = `${trimmedBaseUrl}/Submit`;

    const postResponse = await fetch(submitUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!postResponse.ok) {
      const errText = await postResponse.text();
      res.status(postResponse.status).json({
        error: `Error during job submission: ${errText}`,
        image: null,
        seed: usedSeed,
        info: "Submission error",
      });
      return;
    }

    const postData = await postResponse.json();
    const postResult = postData.result;
    if (postResult.status !== "success") {
      res.status(500).json({
        error: "Try-on API returned an error during submission",
        image: null,
        seed: usedSeed,
        info: postResult.status,
      });
      return;
    }

    // Get task ID and wait for initial processing
    const taskId = postResult.result;
    await sleep(INITIAL_WAIT_MS);

    // Poll for the result
    let resultImage = null;
    let info = "";

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const queryUrl = `${trimmedBaseUrl}/Query?taskId=${taskId}`;
        const queryResponse = await fetch(queryUrl, {
          method: "GET",
          headers,
        });

        if (!queryResponse.ok) {
          info = "URL error, please contact the admin";
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
          info = "Error processing images";
          break;
        }

        // Wait before next polling attempt
        await sleep(POLL_INTERVAL_MS);
      } catch (pollError) {
        console.error("Error during polling:", pollError);
        info = "Http Timeout, please try again later";
        break;
      }
    }

    if (info !== "Success" || !resultImage) {
      res.status(500).json({
        error: info,
        image: null,
        seed: usedSeed,
        info,
      });
      return;
    }

    // Return the successful result
    res.status(200).json({
      image: resultImage,
      seed: usedSeed,
      info,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      error: "Unexpected error occurred",
      image: null,
      seed: 0,
      info: "Error",
    });
  }
}
