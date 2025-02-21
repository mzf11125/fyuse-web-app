const jwt = require("jsonwebtoken");
const { IncomingForm } = require("formidable");
const fs = require("node:fs");

const MAX_SEED = 999999;
const POLL_INTERVAL_MS = 1000;
const MAX_RETRIES = 12;
const INITIAL_WAIT_MS = 9000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function tryonHandler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Parse multipart form data
    const form = new IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Read uploaded files
    const personImg = fs.readFileSync(files.personImg.filepath, { encoding: 'base64' });
    const garmentImg = fs.readFileSync(files.garmentImg.filepath, { encoding: 'base64' });
    const seed = Number.parseInt(fields.seed);
    const randomizeSeed = fields.randomizeSeed === 'true';

    if (!personImg || !garmentImg) {
      res.status(400).json({
        error: "Empty image",
        image: null,
        seed: 0,
        info: "Empty image",
      });
      return;
    }

    // Determine the seed
    let usedSeed = seed;
    if (randomizeSeed) {
      usedSeed = Math.floor(Math.random() * MAX_SEED);
    }

    // Prepare payload for the try-on API using Base64 strings
    const payload = {
      humanImage: `data:image/jpeg;base64,${personImg}`,
      clothImage: `data:image/jpeg;base64,${garmentImg}`,
      seed: usedSeed,
    };

    // Read configuration and credentials from environment variables
    const baseUrl = process.env.KOLORS_API_URL; // e.g., "https://api.klingai.com/kolors-virtual-try-on/"
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

    // Generate JWT token using your AccessKey credentials
    const token = jwt.sign({}, accessKeySecret, {
      algorithm: "HS256",
      issuer: accessKeyId,
      expiresIn: "1h",
    });

    // Set up headers with the JWT token using Bearer scheme
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Submit the try-on job
    const submitUrl = `${baseUrl}Submit`;
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

    // Retrieve the task identifier
    const taskId = postResult.result;

    // Wait for the model to start processing
    await sleep(INITIAL_WAIT_MS);

    // Poll for the result
    let resultImage = null;
    let info = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const queryUrl = `${baseUrl}Query?taskId=${taskId}`;
        const queryResponse = await fetch(queryUrl, {
          method: "GET",
          headers,
        });
        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          const queryResult = queryData.result;
          if (queryResult.status === "success") {
            // Expecting queryResult.result to be a Base64 encoded image
            resultImage = queryResult.result;
            info = "Success";
            break;
          }
          if (queryResult.status === "error") {
            info = "Error";
            break;
          }
        } else {
          info = "URL error, please contact the admin";
          break;
        }
      } catch (pollError) {
        console.error("Error during polling:", pollError);
        info = "Http Timeout, please try again later";
      }
      await sleep(POLL_INTERVAL_MS);
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

    // Return the result image (base64), used seed, and info message
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
};
