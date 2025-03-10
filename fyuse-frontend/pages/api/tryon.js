import formidable from "formidable";
import fs from "node:fs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const POLL_INTERVAL_MS = 3000; // 3 seconds between checks
const MAX_WAIT_TIME_MS = 120000; // 2 minutes max wait

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const config = {
  api: {
    bodyParser: false,
  },
};

// Generate JWT token using access credentials (matching Kling API requirements)
function generateToken(accessKeyId, accessKeySecret) {
  const headers = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload = {
    iss: accessKeyId,
    exp: Math.floor(Date.now() / 1000) + 1800, // Current time + 30min
    nbf: Math.floor(Date.now() / 1000) - 5, // Current time - 5s
  };

  return jwt.sign(payload, accessKeySecret, { header: headers });
}

async function uploadToS3AndGetUrl(buffer, filename, folder) {
  const uniqueFilename = `${uuidv4()}-${filename}`;
  const key = `${folder}/${uniqueFilename}`;
  let contentType = "image/jpeg";
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".png")) contentType = "image/png";
  else if (lowerName.endsWith(".gif")) contentType = "image/gif";
  else if (lowerName.endsWith(".webp")) contentType = "image/webp";

  const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

async function validateImageUrl(url) {
  console.log("Validating URL:", url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(url, {
    method: "HEAD",
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const contentType = response.headers.get("content-type") || "";
  console.log(
    "URL validation - Content type:",
    contentType,
    "Status:",
    response.status
  );

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `URL does not point to an image (content-type: ${contentType})`
    );
  }
  if (!response.ok) {
    throw new Error(`URL is not accessible (status code: ${response.status})`);
  }
}

// Updated streamToString: if not a stream or is a typed array, convert it to a string.
function streamToString(stream) {
  if (!stream) {
    return Promise.resolve("");
  }
  // If the stream is a Buffer or a typed array, convert it directly.
  if (Buffer.isBuffer(stream) || stream instanceof Uint8Array) {
    return Promise.resolve(Buffer.from(stream).toString("utf8"));
  }
  if (typeof stream === "string") {
    return Promise.resolve(stream);
  }
  if (typeof stream.on !== "function") {
    // If it's an ArrayBuffer, convert to Uint8Array and then to string.
    if (stream instanceof ArrayBuffer) {
      return Promise.resolve(
        Buffer.from(new Uint8Array(stream)).toString("utf8")
      );
    }
    return Promise.resolve(String(stream));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

// Function that downloads the image, determines its MIME type, and then calls Amazon Nova Lite for matching analysis.
async function callMatchingAnalysis(imageUrl) {
  console.log("Downloading composite image for matching analysis...");
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch image: ${resp.statusText}`);
  }

  const contentType = resp.headers.get("content-type") || "image/jpeg";
  console.log("Detected final image content type:", contentType);

  let bedrockFormat = "jpeg";
  if (contentType.includes("png")) bedrockFormat = "png";
  else if (contentType.includes("gif")) bedrockFormat = "gif";
  else if (contentType.includes("webp")) bedrockFormat = "webp";

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString("base64");

  // Updated prompts for concise matching analysis.
  const systemPrompt = `
You are a fashion expert specializing in analyzing how well clothing matches a person's body shape and skin tone from a single image.
Your task is to:
1. Identify the body shape (for men: Trapezoid, Triangle, Inverted Triangle, Rectangle, Round; for women: Rectangle, Inverted Triangle, Hourglass, Pear, Apple), skin tone (Fair, Light, Medium, Tan, Deep), top fit and color, and bottom fit and color.
2. Provide a matching analysis that includes:
   * Matching Percentage: [Percentage]%
   * Matching Description: A concise description explaining how the outfit complements the individual's body shape and skin tone.
Be concise and specific.
  `;

  const textPrompt = `
Please analyze the generated try-on image and provide a matching analysis.
Format your answer exactly as follows:
Matching Percentage: [e.g., 90]%
Matching Description: [A short description summarizing the analysis]
  `;

  const payload = {
    schemaVersion: "messages-v1",
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: "user",
        content: [
          {
            image: {
              format: bedrockFormat,
              source: { bytes: base64Image },
            },
          },
          { text: textPrompt },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 300,
      temperature: 0.7,
      topP: 0.9,
      topK: 50,
    },
  };

  const bedrockClient = new BedrockRuntimeClient({
    region: "us-east-1", // Using the region where Nova Lite is available
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new InvokeModelCommand({
    modelId: "us.amazon.nova-lite-v1:0",
    body: JSON.stringify(payload),
  });

  console.log("Invoking Amazon Nova Lite for matching analysis...");
  const bedrockResponse = await bedrockClient.send(command);
  const raw = await streamToString(bedrockResponse.body);
  console.log("Raw response from Bedrock:", raw);
  const trimmed =
    typeof raw === "string" ? raw.trim() : raw.toString("utf8").trim();

  const firstBraceIndex = trimmed.indexOf("{");
  const lastBraceIndex = trimmed.lastIndexOf("}");
  if (
    firstBraceIndex === -1 ||
    lastBraceIndex === -1 ||
    lastBraceIndex < firstBraceIndex
  ) {
    throw new Error(`No valid JSON object found in the response: ${trimmed}`);
  }
  const jsonString = trimmed.substring(firstBraceIndex, lastBraceIndex + 1);
  console.log("Extracted JSON string:", jsonString);
  const result = JSON.parse(jsonString);
  return result.output.message.content[0].text;
}

export default async function tryonHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Matching Analysis Only Mode ---
  if (req.query.action === "analyze") {
    try {
      let bodyStr = "";
      for await (const chunk of req) {
        bodyStr += chunk;
      }
      const { image_url } = JSON.parse(bodyStr);
      if (!image_url) {
        return res
          .status(400)
          .json({ error: "Missing image_url in request body" });
      }
      const analysis = await callMatchingAnalysis(image_url);
      return res.status(200).json({ matching_analysis: analysis });
    } catch (err) {
      console.error("Error during matching analysis:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- Try-On Generation Mode ---
  const startTime = Date.now();
  console.log("Starting processing at:", startTime);

  try {
    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY ||
      !process.env.KOLORS_ACCESS_KEY_ID ||
      !process.env.KOLORS_ACCESS_KEY_SECRET
    ) {
      return res.status(500).json({
        error: "Missing S3 Bucket or Kling credentials",
        status: "error",
        message: "Check environment variables for AWS + Kling credentials",
      });
    }

    const form = formidable({ multiples: true, keepExtensions: true });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    console.log("Form parsed, files received:", Object.keys(files));
    if (!files.personImg || !files.garmentImg) {
      return res.status(400).json({
        error: "Empty image",
        status: "error",
        message: "Both person and garment images are required",
      });
    }

    const personImgFile = Array.isArray(files.personImg)
      ? files.personImg[0]
      : files.personImg;
    const garmentImgFile = Array.isArray(files.garmentImg)
      ? files.garmentImg[0]
      : files.garmentImg;

    console.log(
      "Person image:",
      personImgFile.originalFilename,
      "size:",
      personImgFile.size
    );
    console.log(
      "Garment image:",
      garmentImgFile.originalFilename,
      "size:",
      garmentImgFile.size
    );

    const personImgBuffer = await fs.promises.readFile(personImgFile.filepath);
    const garmentImgBuffer = await fs.promises.readFile(
      garmentImgFile.filepath
    );

    const humanImageUrl = await uploadToS3AndGetUrl(
      personImgBuffer,
      personImgFile.originalFilename || "person.jpg",
      "uploaded-image/user-image"
    );
    const clothImageUrl = await uploadToS3AndGetUrl(
      garmentImgBuffer,
      garmentImgFile.originalFilename || "garment.jpg",
      "uploaded-image/apparel-image"
    );
    console.log("Human Image URL:", humanImageUrl);
    console.log("Cloth Image URL:", clothImageUrl);

    await Promise.all([
      validateImageUrl(humanImageUrl),
      validateImageUrl(clothImageUrl),
    ]);

    try {
      await fs.promises.unlink(personImgFile.filepath);
      await fs.promises.unlink(garmentImgFile.filepath);
    } catch (err) {
      console.warn("File cleanup failed:", err);
    }

    const API_BASE_URL = process.env.KOLORS_API_URL;
    if (!API_BASE_URL) {
      return res.status(500).json({
        error: "Missing API configuration",
        status: "error",
        message: "API credentials not configured",
      });
    }
    console.log("Using API URL:", API_BASE_URL);

    const token = generateToken(
      process.env.KOLORS_ACCESS_KEY_ID,
      process.env.KOLORS_ACCESS_KEY_SECRET
    );
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const payload = {
      model_name: "kolors-virtual-try-on-v1-5",
      human_image: humanImageUrl,
      cloth_image: clothImageUrl,
    };

    console.log("Creating Kling task with payload:", JSON.stringify(payload));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const postResponse = await fetch(API_BASE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error("Kling API error response:", errorText);
      throw new Error(
        `Kling API error: ${postResponse.status} ${postResponse.statusText}`
      );
    }

    const postData = await postResponse.json();
    if (postData.code !== 0) {
      throw new Error(`Kling API Error: ${postData.message}`);
    }

    const taskId = postData.data.task_id;
    console.log("Task created with ID:", taskId);

    const startWaitTime = Date.now();
    let resultImageUrl = null;
    while (Date.now() - startWaitTime < MAX_WAIT_TIME_MS) {
      console.log(
        `Polling task status... (${Math.round(
          (Date.now() - startWaitTime) / 1000
        )}s elapsed)`
      );
      const queryController = new AbortController();
      const queryTimeoutId = setTimeout(() => queryController.abort(), 10000);

      const queryResponse = await fetch(`${API_BASE_URL}/${taskId}`, {
        headers,
        signal: queryController.signal,
      });
      clearTimeout(queryTimeoutId);

      if (!queryResponse.ok) {
        throw new Error(
          `Kling API request failed: ${queryResponse.status} ${queryResponse.statusText}`
        );
      }

      const queryData = await queryResponse.json();
      if (queryData.code !== 0) {
        throw new Error(`Kling API Error: ${queryData.message}`);
      }

      const status = queryData.data.task_status;
      if (status === "succeed") {
        resultImageUrl = queryData.data.task_result?.images?.[0]?.url;
        console.log("Task completed successfully with result:", resultImageUrl);
        if (resultImageUrl) {
          try {
            const finalResp = await fetch(resultImageUrl);
            if (!finalResp.ok) {
              throw new Error(
                `Failed to fetch generated image: ${finalResp.statusText}`
              );
            }
            const finalContentType =
              finalResp.headers.get("content-type") || "image/jpeg";
            let extension = "jpeg";
            if (finalContentType.includes("png")) extension = "png";
            else if (finalContentType.includes("gif")) extension = "gif";
            else if (finalContentType.includes("webp")) extension = "webp";

            const arrayBuffer = await finalResp.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            const generatedImageName = `generated-${uuidv4()}.${extension}`;
            const finalUrl = await uploadToS3AndGetUrl(
              imageBuffer,
              generatedImageName,
              "generated-image"
            );
            console.log("Generated image uploaded successfully:", finalUrl);
            resultImageUrl = finalUrl;
          } catch (err) {
            console.error("Error fetching or uploading generated image:", err);
          }
        }
        break;
      }
      if (status === "failed") {
        const msg = queryData.data.task_status_msg || "Unknown error";
        throw new Error(`Task failed: ${msg}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }

    if (!resultImageUrl) {
      throw new Error("Image generation took too long or never succeeded.");
    }

    // Return only the generated image URL and task ID.
    return res.status(200).json({
      status: "success",
      task_id: taskId,
      generated_image_url: resultImageUrl,
    });
  } catch (error) {
    console.error("Processing error:", error);
    return res.status(500).json({
      status: "error",
      error: error.message,
      message: "Processing error occurred",
    });
  }
}
