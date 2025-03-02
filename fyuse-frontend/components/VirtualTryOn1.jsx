// "use client";

// import { useState, useCallback } from "react";
// import { Button } from "./ui/button.jsx";
// import {
//   Card,
//   CardHeader,
//   CardTitle,
//   CardContent,
//   CardFooter,
// } from "./ui/card.jsx";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.jsx";
// import { ImagePlus, Shirt, Loader2 } from "lucide-react";

// export default function VirtualTryOn() {
//   // Store file objects and preview URLs separately
//   const [personFile, setPersonFile] = useState(null);
//   const [personPreview, setPersonPreview] = useState(null);
//   const [clothingFile, setClothingFile] = useState(null);
//   const [clothingPreview, setClothingPreview] = useState(null);
//   const [resultImage, setResultImage] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [activeTab, setActiveTab] = useState("upload");
//   const [info, setInfo] = useState("");
//   const [seedUsed, setSeedUsed] = useState(0);

//   const handleDrop = useCallback((e, setFile, setPreview) => {
//     e.preventDefault();
//     e.stopPropagation();
//     const file = e.dataTransfer?.files[0];
//     if (file?.type?.startsWith("image/")) {
//       setFile(file);
//       setPreview(URL.createObjectURL(file));
//     }
//   }, []);

//   const handleDragOver = useCallback((e) => {
//     e.preventDefault();
//     e.stopPropagation();
//   }, []);

//   const handleFileSelect = useCallback((e, setFile, setPreview) => {
//     const file = e.target.files[0];
//     if (file?.type?.startsWith("image/")) {
//       setFile(file);
//       setPreview(URL.createObjectURL(file));
//     }
//   }, []);

//   const processImages = async () => {
//     if (!personFile || !clothingFile) {
//       setInfo("Please upload both images first.");
//       return;
//     }

//     setLoading(true);
//     setInfo("");

//     try {
//       const formData = new FormData();
//       formData.append("personImg", personFile);
//       formData.append("garmentImg", clothingFile);

//       // ✅ Log FormData to ensure images exist
//       for (const [key, value] of formData.entries()) {
//         console.log("FormData Key:", key, "Value:", value);
//       }

//       const response = await fetch("/api/tryonhuggingface", {
//         method: "POST",
//         body: formData,
//       });

//       console.log("Response status:", response.status); // ✅ Debugging

//       if (!response.ok) {
//         const text = await response.text();
//         console.error("Response Error:", text); // ✅ Debugging
//         throw new Error(text || "Failed to process images");
//       }

//       const responseData = await response.json();
//       console.log("Response Data:", responseData); // ✅ Debugging

//       if (!responseData.imageUrl) {
//         throw new Error("Failed to retrieve processed image.");
//       }

//       setResultImage(responseData.imageUrl);
//       setActiveTab("result");
//     } catch (error) {
//       setInfo(error.message);
//       console.error("Processing failed:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const ImageUploadCard = ({
//     title,
//     preview,
//     setFile,
//     setPreview,
//     icon: Icon,
//     id,
//   }) => (
//     <Card>
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Icon className="h-5 w-5" />
//           {title}
//         </CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div
//           className="relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center h-64 cursor-pointer hover:border-primary transition-colors"
//           onDrop={(e) => handleDrop(e, setFile, setPreview)}
//           onDragOver={handleDragOver}
//           onClick={() => document.getElementById(id).click()}
//           onKeyDown={(e) => {
//             if (e.key === "Enter" || e.key === " ") {
//               document.getElementById(id).click();
//             }
//           }}
//         >
//           {preview ? (
//             <img
//               src={preview}
//               alt={`${title} preview`}
//               className="max-h-full max-w-full object-contain rounded-md"
//             />
//           ) : (
//             <div className="text-center">
//               <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
//               <p>Drop image here or click to upload</p>
//             </div>
//           )}
//           <input
//             type="file"
//             id={id}
//             className="hidden"
//             accept="image/*"
//             onChange={(e) => handleFileSelect(e, setFile, setPreview)}
//           />
//         </div>
//       </CardContent>
//     </Card>
//   );

//   return (
//     <section className="container mx-auto px-4 py-16">
//       <h2 className="mb-8 text-center text-3xl font-bold text-primary">
//         Virtual Try-On Experience
//       </h2>
//       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
//         <TabsList className="grid grid-cols-2">
//           <TabsTrigger value="upload">Upload Images</TabsTrigger>
//           <TabsTrigger value="result" disabled={!resultImage}>
//             View Result
//           </TabsTrigger>
//         </TabsList>

//         <TabsContent
//           value="upload"
//           className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6"
//         >
//           <ImageUploadCard
//             title="Your Photo"
//             preview={personPreview}
//             setFile={setPersonFile}
//             setPreview={setPersonPreview}
//             icon={ImagePlus}
//             id="personImage"
//           />
//           <ImageUploadCard
//             title="Clothing Item"
//             preview={clothingPreview}
//             setFile={setClothingFile}
//             setPreview={setClothingPreview}
//             icon={Shirt}
//             id="clothingImage"
//           />
//         </TabsContent>

//         <TabsContent value="result" className="mt-6">
//           <Card>
//             <CardHeader>
//               <CardTitle>Your Virtual Try-On Result</CardTitle>
//             </CardHeader>
//             <CardContent className="flex justify-center">
//               {resultImage ? (
//                 <img
//                   src={resultImage}
//                   alt="Result"
//                   className="max-h-[500px] object-contain rounded-md"
//                 />
//               ) : (
//                 <p>No result available. Please upload images and process.</p>
//               )}
//             </CardContent>
//             <CardFooter className="flex justify-between">
//               <Button variant="outline" onClick={() => setActiveTab("upload")}>
//                 Try Another Item
//               </Button>
//               {resultImage && (
//                 <Button
//                   onClick={() => {
//                     const link = document.createElement("a");
//                     link.href = resultImage;
//                     link.download = "tryon_result.jpg";
//                     link.click();
//                   }}
//                 >
//                   Download Result
//                 </Button>
//               )}
//             </CardFooter>
//           </Card>
//         </TabsContent>
//       </Tabs>

//       <div className="mt-8 text-center">
//         <Button
//           onClick={processImages}
//           disabled={!personFile || !clothingFile || loading}
//           className="min-w-[200px]"
//         >
//           {loading ? (
//             <>
//               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//               Processing...
//             </>
//           ) : (
//             "Generate Try-On Result"
//           )}
//         </Button>
//         {info && (
//           <p className="mt-4 text-center text-sm text-muted-foreground">
//             {info}
//           </p>
//         )}
//         {seedUsed !== 0 && (
//           <p className="mt-2 text-center text-sm text-muted-foreground">
//             Seed used: {seedUsed}
//           </p>
//         )}
//       </div>
//     </section>
//   );
// }
