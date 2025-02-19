// components/VirtualTryOn.jsx
"use client";

import { useState } from "react";
import { Button } from "./ui/button.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "./ui/card.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.jsx";
import { ImagePlus, Shirt, Upload, Loader2 } from "lucide-react";

export default function VirtualTryOn() {
  const [personImage, setPersonImage] = useState(null); // data URL string
  const [clothingImage, setClothingImage] = useState(null); // data URL string
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [info, setInfo] = useState("");
  const [seedUsed, setSeedUsed] = useState(0);

  // File upload handler (generic for both images)
  const handleImageChange = (e, setImage) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Process images by sending them to your backend API route
  const processImages = async () => {
    if (!personImage || !clothingImage) return;
    setLoading(true);

    try {
      // Create a JSON payload with the Base64 strings.
      // Optionally add a seed (or set randomizeSeed to true)
      const payload = {
        personImg: personImage,
        garmentImg: clothingImage,
        seed: 0,
        randomizeSeed: true,
      };

      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Error processing images:", data.error);
        setInfo(data.error);
      } else {
        // The backend returns a JSON object with image, seed, and info.
        // The image is expected to be a Base64 string (data URL).
        setResultImage(data.image);
        setSeedUsed(data.seed);
        setInfo(data.info);
        setActiveTab("result");
      }
    } catch (error) {
      console.error("Processing failed:", error);
      setInfo(`Processing failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="mb-8 text-center text-3xl font-bold text-primary">
        Virtual Try-On Experience
      </h2>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="upload">Upload Images</TabsTrigger>
          <TabsTrigger value="result" disabled={!resultImage}>
            View Result
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="upload"
          className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Person Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5" />
                Your Photo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center h-64">
                {personImage ? (
                  <img
                    src={personImage}
                    alt="Person preview"
                    className="max-h-full max-w-full object-contain rounded-md"
                  />
                ) : (
                  <div className="text-center">
                    <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p>Drag and drop or click to upload</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="personImage"
                  onChange={(e) => handleImageChange(e, setPersonImage)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <label htmlFor="personImage" className="w-full cursor-pointer">
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  {personImage ? "Change Photo" : "Upload Photo"}
                </Button>
              </label>
            </CardFooter>
          </Card>

          {/* Clothing Image Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shirt className="h-5 w-5" />
                Clothing Item
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center h-64">
                {clothingImage ? (
                  <img
                    src={clothingImage}
                    alt="Clothing preview"
                    className="max-h-full max-w-full object-contain rounded-md"
                  />
                ) : (
                  <div className="text-center">
                    <Shirt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p>Drag and drop or click to upload</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="clothingImage"
                  onChange={(e) => handleImageChange(e, setClothingImage)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <label htmlFor="clothingImage" className="w-full cursor-pointer">
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  {clothingImage ? "Change Item" : "Upload Item"}
                </Button>
              </label>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="result" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Virtual Try-On Result</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              {resultImage ? (
                <img
                  src={resultImage}
                  alt="Result"
                  className="max-h-[500px] object-contain rounded-md"
                />
              ) : (
                <p>No result available. Please upload images and process.</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("upload")}>
                Try Another Item
              </Button>
              <Button
                onClick={() => {
                  // Download the result image
                  const link = document.createElement("a");
                  link.href = resultImage;
                  link.download = "tryon_result.jpg";
                  link.click();
                }}
              >
                Download Result
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center">
        <Button
          onClick={processImages}
          disabled={!personImage || !clothingImage || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Generate Try-On Result"
          )}
        </Button>
      </div>
      {info && <p className="mt-4 text-center">{info}</p>}
      {seedUsed !== 0 && (
        <p className="mt-2 text-center">Seed used: {seedUsed}</p>
      )}
    </section>
  );
}
