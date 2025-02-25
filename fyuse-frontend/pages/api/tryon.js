import formidable from "formidable";
import fs from "node:fs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";

// Constants for polling
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

// Function to upload image to Supabase storage and return public URL
async function uploadToSupabaseAndGetUrl(buffer, filename) {
  // Check for required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase credentials in environment variables");
  }

  // Initialize Supabase client - creating it here ensures fresh client for each upload
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Create a unique filename
  const uniqueFilename = `${uuidv4()}-${filename}`;

  // Define the storage bucket
  const bucketName = "tryon-images";

  try {
    // First check if bucket exists
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      console.error("Error listing buckets:", listError);
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = buckets.some((bucket) => bucket.name === bucketName);

    // Create bucket if it doesn't exist
    if (!bucketExists) {
      console.log(`Bucket ${bucketName} doesn't exist, creating...`);
      const { error: createError } = await supabase.storage.createBucket(
        bucketName,
        {
          public: true,
          fileSizeLimit: 100 * 1024 * 1024, // 100MB limit
        }
      );

      if (createError) {
        console.error("Error creating bucket:", createError);
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }
      console.log(`Bucket ${bucketName} created successfully`);
    }

    // Determine content type
    let contentType = "image/jpeg";
    if (filename.toLowerCase().endsWith(".png")) contentType = "image/png";
    if (filename.toLowerCase().endsWith(".gif")) contentType = "image/gif";
    if (filename.toLowerCase().endsWith(".webp")) contentType = "image/webp";

    console.log(`Uploading ${filename} to ${bucketName}/${uniqueFilename}`);

    // Upload file to Supabase
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(uniqueFilename, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading to Supabase:", uploadError);
      throw new Error(`Error uploading to Supabase: ${uploadError.message}`);
    }

    console.log("Upload successful:", data);

    // Get public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uniqueFilename);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error("Failed to get public URL for uploaded file");
    }

    console.log("Generated public URL:", publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Supabase upload error:", error);
    throw error;
  }
}

// Function to validate image URL
async function validateImageUrl(url) {
  console.log("Validating URL:", url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    console.log(
      "URL validation - Content type:",
      contentType,
      "Status:",
      response.status
    );

    if (!contentType?.startsWith("image/")) {
      throw new Error(
        `URL does not point to an image (content-type: ${contentType})`
      );
    }
    if (!response.ok) {
      throw new Error(
        `URL is not accessible (status code: ${response.status})`
      );
    }

    return true;
  } catch (error) {
    console.error("URL validation error:", error);
    if (error.name === "AbortError") {
      throw new Error("Image URL validation timed out");
    }
    throw new Error(`Error accessing URL: ${error.message || "Unknown error"}`);
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
    // Check for Supabase environment variables early
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      res.status(500).json({
        error: "Missing Supabase configuration",
        status: "error",
        message: "Supabase credentials not configured",
      });
      return;
    }

    const form = formidable({
      multiples: true,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024,
      maxFieldsSize: 100 * 1024 * 1024,
    });

    console.log("Parsing form data...");
    const [fields, files] = await form.parse(req);
    console.log("Form parsed, files received:", Object.keys(files));

    if (!files || !files.personImg || !files.garmentImg) {
      res.status(400).json({
        error: "Empty image",
        status: "error",
        message: "Both person and garment images are required",
      });
      return;
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

    try {
      // Read the image files into buffers
      console.log("Reading image files...");
      const personImgBuffer = await fs.promises.readFile(
        personImgFile.filepath
      );
      const garmentImgBuffer = await fs.promises.readFile(
        garmentImgFile.filepath
      );

      console.log(
        "Image buffers created, person:",
        personImgBuffer.length,
        "garment:",
        garmentImgBuffer.length
      );

      // Upload images to Supabase and get public URLs
      console.log("Uploading to Supabase...");
      const humanImageUrl = await uploadToSupabaseAndGetUrl(
        personImgBuffer,
        personImgFile.originalFilename || "person.jpg"
      );

      const clothImageUrl = await uploadToSupabaseAndGetUrl(
        garmentImgBuffer,
        garmentImgFile.originalFilename || "garment.jpg"
      );

      console.log("Human Image URL:", humanImageUrl);
      console.log("Cloth Image URL:", clothImageUrl);

      // Validate image URLs
      try {
        console.log("Validating image URLs...");
        await Promise.all([
          validateImageUrl(humanImageUrl),
          validateImageUrl(clothImageUrl),
        ]);
        console.log("Image URLs validated successfully");
      } catch (validationError) {
        console.error("Validation error:", validationError);
        throw new Error(`Image validation failed: ${validationError.message}`);
      }

      // Clean up temporary files
      console.log("Cleaning up temporary files...");
      await Promise.all([
        fs.promises.unlink(personImgFile.filepath),
        fs.promises.unlink(garmentImgFile.filepath),
      ]);

      // Get API credentials from environment
      const API_BASE_URL = process.env.KOLORS_API_URL;
      const accessKeyId = process.env.ACCESS_KEY_ID;
      const accessKeySecret = process.env.ACCESS_KEY_SECRET;

      if (!API_BASE_URL || !accessKeyId || !accessKeySecret) {
        res.status(500).json({
          error: "Missing API configuration",
          status: "error",
          message: "API credentials not configured",
        });
        return;
      }

      console.log("Using API URL:", API_BASE_URL);

      // Generate JWT token using credentials
      const token = generateToken(accessKeyId, accessKeySecret);

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      // Create payload matching Kling API format
      const payload = {
        model_name: "kolors-virtual-try-on-v1",
        human_image: humanImageUrl,
        cloth_image: clothImageUrl,
      };

      console.log("Creating task with payload:", JSON.stringify(payload));
      console.log("Task creation start time:", Date.now() - startTime);

      // Create task with timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const postResponse = await fetch(API_BASE_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log("Task creation response status:", postResponse.status);
        console.log("Task creation end time:", Date.now() - startTime);

        if (!postResponse.ok) {
          const errorText = await postResponse.text();
          console.error("API error response:", errorText);
          throw new Error(
            `API error: ${postResponse.status} ${postResponse.statusText}`
          );
        }

        const postData = await postResponse.json();
        console.log("Task creation response:", JSON.stringify(postData));

        if (postData.code !== 0) {
          throw new Error(`API Error: ${postData.message}`);
        }

        const taskId = postData.data.task_id;
        console.log("Task created with ID:", taskId);

        // Wait for task completion
        const startWaitTime = Date.now();
        let resultImageUrl = null;

        while (Date.now() - startWaitTime < MAX_WAIT_TIME_MS) {
          try {
            console.log(
              `Polling task status... (${Math.round(
                (Date.now() - startWaitTime) / 1000
              )}s elapsed)`
            );

            const queryController = new AbortController();
            const queryTimeoutId = setTimeout(
              () => queryController.abort(),
              10000
            );

            const queryResponse = await fetch(`${API_BASE_URL}/${taskId}`, {
              headers,
              signal: queryController.signal,
            });

            clearTimeout(queryTimeoutId);

            if (!queryResponse.ok) {
              throw new Error(
                `API request failed: ${queryResponse.status} ${queryResponse.statusText}`
              );
            }

            const queryData = await queryResponse.json();
            console.log("Poll response:", JSON.stringify(queryData));

            if (queryData.code !== 0) {
              throw new Error(`API Error: ${queryData.message}`);
            }

            const status = queryData.data.task_status;

            if (status === "succeed") {
              // Extract result image URL
              resultImageUrl = queryData.data.task_result?.images[0]?.url;
              console.log(
                "Task completed successfully with result:",
                resultImageUrl
              );
              break;
            }
            if (status === "failed") {
              throw new Error(
                `Task failed: ${
                  queryData.data.task_status_msg || "Unknown error"
                }`
              );
            }

            // If still processing, wait before next check
            await sleep(POLL_INTERVAL_MS);
          } catch (pollError) {
            if (pollError.name === "AbortError") {
              console.log("Poll request timed out, trying again...");
              continue;
            }
            throw pollError;
          }
        }

        console.log("Polling end time:", Date.now() - startTime);
        console.log("Total time used:", Date.now() - startTime);

        if (!resultImageUrl) {
          throw new Error(
            `Task ${taskId} timed out after ${MAX_WAIT_TIME_MS / 1000} seconds`
          );
        }

        // Return success response with image URL
        res.status(200).json({
          status: "success",
          task_id: taskId,
          generated_image_url: resultImageUrl,
        });
      } catch (fetchError) {
        if (fetchError.name === "AbortError") {
          res.status(504).json({
            status: "error",
            error: "API request timed out",
            message: "Request timeout, please try again",
          });
        } else {
          throw fetchError;
        }
      }
    } catch (processingError) {
      console.error("Processing error:", processingError);
      res.status(500).json({
        status: "error",
        error: processingError.message,
        message: "Processing error occurred",
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Unexpected error occurred",
    });
  }
}
