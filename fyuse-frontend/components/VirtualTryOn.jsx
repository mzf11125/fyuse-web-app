// components/VirtualTryOn.jsx
"use client";

import { useState } from "react";
import { Button } from "./ui/button.jsx";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/card.jsx";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion.jsx"; // if needed
import { Input } from "./ui/input.jsx";
import { Label } from "./ui/label.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.jsx";
import { ImagePlus, Shirt, Upload, Loader2 } from "lucide-react";

export default function VirtualTryOn() {
  const [personImage, setPersonImage] = useState(null);
  const [clothingImage, setClothingImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");

  // File upload handler (generic for both images)
  const handleImageChange = (e, setImage) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Helper to convert data URL to File object
  function dataURLtoFile(dataurl, filename) {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  // Process images by sending them to your backend (friend's API)
  const processImages = async () => {
    if (!personImage || !clothingImage) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("personImage", dataURLtoFile(personImage, "person.jpg"));
    formData.append("clothingImage", dataURLtoFile(clothingImage, "clothing.jpg"));

    try {
      const response = await fetch("https://your-backend.com/api/try-on", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Error processing images");

      const blob = await response.blob();
      setResultImage(URL.createObjectURL(blob));
      setActiveTab("result");
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="mb-8 text-center text-3xl font-bold text-primary">Virtual Try-On Experience</h2>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="upload">Upload Images</TabsTrigger>
          <TabsTrigger value="result" disabled={!resultImage}>View Result</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="personImage"
                  onChange={(e) => handleImageChange(e, setPersonImage)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Label htmlFor="personImage" className="w-full cursor-pointer">
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  {personImage ? "Change Photo" : "Upload Photo"}
                </Button>
              </Label>
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
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="clothingImage"
                  onChange={(e) => handleImageChange(e, setClothingImage)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Label htmlFor="clothingImage" className="w-full cursor-pointer">
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  {clothingImage ? "Change Item" : "Upload Item"}
                </Button>
              </Label>
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
              <Button>Download Result</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center">
        <Button onClick={processImages} disabled={!personImage || !clothingImage || loading}>
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
    </section>
  );
}