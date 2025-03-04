// import formidable from "formidable";
// import fs from "node:fs";
// import { createClient } from "@supabase/supabase-js";
// import { v4 as uuidv4 } from "uuid";
// import { fal } from "@fal-ai/client";

// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// // Upload image buffer to Supabase storage and return public URL
// async function uploadToSupabaseAndGetUrl(buffer, filename) {
//   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
//   const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

//   if (!supabaseUrl || !supabaseServiceKey) {
//     throw new Error("Missing Supabase credentials in environment variables");
//   }

//   const supabase = createClient(supabaseUrl, supabaseServiceKey);
//   const uniqueFilename = `${uuidv4()}-${filename}`;
//   const bucketName = "tryon-images";

//   // Ensure bucket exists
//   const { data: buckets, error: listError } =
//     await supabase.storage.listBuckets();
//   if (listError) {
//     throw new Error(`Failed to list buckets: ${listError.message}`);
//   }
//   const bucketExists = buckets.some((bucket) => bucket.name === bucketName);
//   if (!bucketExists) {
//     const { error: createError } = await supabase.storage.createBucket(
//       bucketName,
//       {
//         public: true,
//         fileSizeLimit: 100 * 1024 * 1024,
//       }
//     );
//     if (createError) {
//       throw new Error(`Failed to create bucket: ${createError.message}`);
//     }
//   }

//   // Set content type based on file extension
//   let contentType = "image/jpeg";
//   if (filename.toLowerCase().endsWith(".png")) contentType = "image/png";
//   if (filename.toLowerCase().endsWith(".gif")) contentType = "image/gif";
//   if (filename.toLowerCase().endsWith(".webp")) contentType = "image/webp";

//   const { error: uploadError } = await supabase.storage
//     .from(bucketName)
//     .upload(uniqueFilename, buffer, { contentType, upsert: false });
//   if (uploadError) {
//     throw new Error(`Error uploading to Supabase: ${uploadError.message}`);
//   }

//   const { data: publicUrlData } = supabase.storage
//     .from(bucketName)
//     .getPublicUrl(uniqueFilename);
//   if (!publicUrlData || !publicUrlData.publicUrl) {
//     throw new Error("Failed to get public URL for uploaded file");
//   }
//   return publicUrlData.publicUrl;
// }

// // Validate that the URL points to an image
// async function validateImageUrl(url) {
//   const controller = new AbortController();
//   const timeoutId = setTimeout(() => controller.abort(), 10000);
//   const response = await fetch(url, {
//     method: "HEAD",
//     signal: controller.signal,
//   });
//   clearTimeout(timeoutId);
//   const contentType = response.headers.get("content-type");
//   if (!contentType?.startsWith("image/") || !response.ok) {
//     throw new Error(
//       `URL validation failed (content-type: ${contentType}, status: ${response.status})`
//     );
//   }
//   return true;
// }

// export default async function tryonHandler(req, res) {
//   if (req.method !== "POST") {
//     res.status(405).json({ error: "Method not allowed" });
//     return;
//   }

//   try {
//     if (
//       !process.env.NEXT_PUBLIC_SUPABASE_URL ||
//       !process.env.SUPABASE_SERVICE_ROLE_KEY ||
//       !process.env.FAL_KEY
//     ) {
//       res.status(500).json({
//         error: "Missing configuration",
//         message: "Fal.ai API key or Supabase credentials not configured",
//       });
//       return;
//     }

//     // (Optional) Configure Fal client if not set via env variables
//     fal.config({ credentials: process.env.FAL_KEY });

//     const form = formidable({
//       multiples: true,
//       keepExtensions: true,
//       maxFileSize: 100 * 1024 * 1024,
//       maxFieldsSize: 100 * 1024 * 1024,
//     });

//     const [fields, files] = await form.parse(req);
//     if (!files || !files.personImg || !files.garmentImg) {
//       res.status(400).json({
//         error: "Empty image",
//         message: "Both person and garment images are required",
//       });
//       return;
//     }

//     const personImgFile = Array.isArray(files.personImg)
//       ? files.personImg[0]
//       : files.personImg;
//     const garmentImgFile = Array.isArray(files.garmentImg)
//       ? files.garmentImg[0]
//       : files.garmentImg;

//     // Read the image files into buffers
//     const personImgBuffer = await fs.promises.readFile(personImgFile.filepath);
//     const garmentImgBuffer = await fs.promises.readFile(
//       garmentImgFile.filepath
//     );

//     // Upload images to Supabase and obtain public URLs
//     const modelImageUrl = await uploadToSupabaseAndGetUrl(
//       personImgBuffer,
//       personImgFile.originalFilename || "person.jpg"
//     );
//     const garmentImageUrl = await uploadToSupabaseAndGetUrl(
//       garmentImgBuffer,
//       garmentImgFile.originalFilename || "garment.jpg"
//     );

//     // Validate image URLs
//     await Promise.all([
//       validateImageUrl(modelImageUrl),
//       validateImageUrl(garmentImageUrl),
//     ]);

//     // Clean up temporary files
//     await Promise.all([
//       fs.promises.unlink(personImgFile.filepath),
//       fs.promises.unlink(garmentImgFile.filepath),
//     ]);

//     // Submit the request using Fal.ai's client
//     const result = await fal.subscribe("fashn/tryon", {
//       input: {
//         model_image: modelImageUrl,
//         garment_image: garmentImageUrl,
//         category: "tops", // Adjust this as needed (e.g., "bottoms", "one-pieces")
//       },
//       logs: true,
//       onQueueUpdate: (update) => {
//         if (update.status === "IN_PROGRESS") {
//           update.logs.map((log) => console.log(log.message));
//         }
//       },
//     });

//     if (!result.data || !result.data.images || !result.data.images[0]?.url) {
//       throw new Error("No image URL returned from Fal.ai API");
//     }

//     const generatedImageUrl = result.data.images[0].url;
//     res.status(200).json({
//       status: "success",
//       generated_image_url: generatedImageUrl,
//     });
//   } catch (error) {
//     console.error("Processing error:", error);
//     res.status(500).json({
//       status: "error",
//       error: error.message,
//       message: "Processing error occurred",
//     });
//   }
// }
