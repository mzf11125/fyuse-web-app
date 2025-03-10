"use client";

import { useState, useCallback } from "react";
import { Button } from "./ui/button.jsx";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "./ui/card.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.jsx";
import { ImagePlus, Shirt, Loader2 } from "lucide-react";

export default function VirtualTryOn() {
  // State for files and previews
  const [personFile, setPersonFile] = useState(null);
  const [personPreview, setPersonPreview] = useState(null);
  const [clothingFile, setClothingFile] = useState(null);
  const [clothingPreview, setClothingPreview] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [matchingAnalysis, setMatchingAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [info, setInfo] = useState("");
  const [seedUsed, setSeedUsed] = useState(0);

  const handleDrop = useCallback((e, setFile, setPreview) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files[0];
    if (file?.type?.startsWith("image/")) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback((e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file?.type?.startsWith("image/")) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  }, []);

  // Function to initiate try-on image generation.
  const processImages = async () => {
    if (!personFile || !clothingFile) {
      setInfo("Please upload both images first");
      return;
    }
    setLoading(true);
    setInfo("");
    try {
      const formData = new FormData();
      formData.append("personImg", personFile, personFile.name);
      formData.append("garmentImg", clothingFile, clothingFile.name);
      formData.append("seed", "0");
      formData.append("randomizeSeed", "true");

      const response = await fetch("/api/tryon", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to process images");
      }
      const data = await response.json();
      setResultImage(data.generated_image_url);
      setSeedUsed(data.seed);
      setInfo("Try-on image generated successfully.");
      setActiveTab("result");
      // Clear previous matching analysis result
      setMatchingAnalysis(null);
    } catch (error) {
      setInfo(error.message);
      console.error("Processing failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to request matching analysis from backend.
  const performMatchingAnalysis = async () => {
    if (!resultImage) {
      setInfo("No generated image available for analysis.");
      return;
    }
    setLoading(true);
    setInfo("Performing matching analysis...");
    try {
      const response = await fetch("/api/tryon?action=analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: resultImage }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to perform matching analysis");
      }
      const data = await response.json();
      setMatchingAnalysis(data.matching_analysis);
      setInfo("Matching analysis completed.");
    } catch (error) {
      setInfo(error.message);
      console.error("Matching analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const ImageUploadCard = ({
    title,
    preview,
    setFile,
    setPreview,
    icon: Icon,
    id,
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center h-64 cursor-pointer hover:border-primary transition-colors"
          onDrop={(e) => handleDrop(e, setFile, setPreview)}
          onDragOver={handleDragOver}
          onClick={() => document.getElementById(id).click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              document.getElementById(id).click();
            }
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt={`${title} preview`}
              className="max-h-full max-w-full object-contain rounded-md"
            />
          ) : (
            <div className="text-center">
              <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p>Drop image here or click to upload</p>
            </div>
          )}
          <input
            type="file"
            id={id}
            className="hidden"
            accept="image/*"
            onChange={(e) => handleFileSelect(e, setFile, setPreview)}
          />
        </div>
      </CardContent>
    </Card>
  );

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
          <ImageUploadCard
            title="Your Photo"
            preview={personPreview}
            setFile={setPersonFile}
            setPreview={setPersonPreview}
            icon={ImagePlus}
            id="personImage"
          />
          <ImageUploadCard
            title="Clothing Item"
            preview={clothingPreview}
            setFile={setClothingFile}
            setPreview={setClothingPreview}
            icon={Shirt}
            id="clothingImage"
          />
        </TabsContent>

        <TabsContent value="result" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Virtual Try-On Result</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {resultImage ? (
                <>
                  <img
                    src={resultImage}
                    alt="Result"
                    className="max-h-[500px] object-contain rounded-md"
                  />
                  <Button onClick={performMatchingAnalysis} className="mt-4">
                    Perform Matching Analysis
                  </Button>
                  {matchingAnalysis && (
                    <div className="mt-4 p-4 border rounded-md w-full max-w-lg">
                      <h3 className="text-lg font-semibold mb-2">
                        Matching Analysis
                      </h3>
                      <p>{matchingAnalysis}</p>
                    </div>
                  )}
                </>
              ) : (
                <p>No result available. Please upload images and process.</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("upload")}>
                Try Another Item
              </Button>
              {resultImage && (
                <Button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = resultImage;
                    link.download = "tryon_result.jpg";
                    link.click();
                  }}
                >
                  Download Result
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center">
        <Button
          onClick={processImages}
          disabled={!personFile || !clothingFile || loading}
          className="min-w-[200px]"
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
        {info && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {info}
          </p>
        )}
        {seedUsed !== 0 && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Seed used: {seedUsed}
          </p>
        )}
      </div>
    </section>
  );
}
