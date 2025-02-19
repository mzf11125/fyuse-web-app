"use client";

import dynamic from "next/dynamic";

const VirtualTryOn = dynamic(() => import("./VirtualTryOn"), { ssr: false });

export default function VirtualTryOnWrapper(props) {
  return <VirtualTryOn {...props} />;
}