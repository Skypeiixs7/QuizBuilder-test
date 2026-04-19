"use client";

import React from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

export interface ImageViewProps {
  src: string;
}

export function ImageView({ src }: ImageViewProps) {
  // Show placeholder when no image is set
  if (!src) {
    return (
      <div className="relative h-full w-full flex items-center justify-center bg-gray-100">
        <ImageIcon className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Image src={src} alt="image" fill sizes="100vw" className="object-contain object-center" />
    </div>
  );
}

export default ImageView;
