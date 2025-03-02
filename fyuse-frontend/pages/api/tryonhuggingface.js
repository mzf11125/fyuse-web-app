import formidable from "formidable";
import fs from "node:fs/promises";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // Important for handling FormData with formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  try {
    const [fields, files] = await form.parse(req);

    console.log("Received files:", files); // ✅ Debugging

    const personImg = files?.personImg?.filepath;
    const garmentImg = files?.garmentImg?.filepath;

    if (!personImg || !garmentImg) {
      return res.status(400).json({ error: "Both images are required" });
    }

    // Read file buffers
    const personBuffer = await fs.readFile(personImg);
    const garmentBuffer = await fs.readFile(garmentImg);

    // Prepare FormData for Hugging Face API
    const formData = new FormData();
    formData.append("personImg", personBuffer, "person.jpg");
    formData.append("garmentImg", garmentBuffer, "garment.jpg");

    console.log("Sending images to Hugging Face API...");

    // Send request to Hugging Face Model
    const hfResponse = await fetch(process.env.NEXT_PUBLIC_RAOS_API_URL, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
      },
    });

    const hfData = await hfResponse.json();
    console.log("Hugging Face API Response:", hfData); // ✅ Debugging

    if (!hfResponse.ok || !hfData.imageUrl) {
      return res.status(500).json({ error: "Failed to generate image" });
    }

    return res.status(200).json({ imageUrl: hfData.imageUrl });
  } catch (err) {
    console.error("Error processing images:", err);
    return res.status(500).json({ error: "Failed to process images" });
  }
}
