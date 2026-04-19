"use client";

import React, { useEffect, useState, type DragEvent } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { Image as ImageIcon, Upload } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import type { PageBackground } from "@/types";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export interface BackgroundPopoverProps {
  background?: PageBackground;
  onBackgroundChange: (bg: PageBackground) => void;
}

export function BackgroundPopover({
  background,
  onBackgroundChange,
}: BackgroundPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOverImage, setDragOverImage] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const saveImage = useMutation(api.images.saveImage);
  const imagesQuery = useQuery(api.images.getUserImages);

  const color = background?.color ?? "#ffffff";
  const image = background?.image ?? "";

  // Auto-save color changes
  const handleColorChange = (newColor: string) => {
    onBackgroundChange({ ...background, color: newColor || undefined });
  };

  // Auto-save image changes
  const handleImageChange = (newImage: string) => {
    onBackgroundChange({ ...background, image: newImage || undefined });
  };

  const handleImageDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragOverImage(true);
  };

  const handleImageDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverImage(false);
  };

  const handleImageDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverImage(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
      const savedImage = await saveImage({
        name: file.name,
        storageId,
        format: file.type,
        size: file.size,
      });
      const imageUrl = savedImage.url ?? "";
      if (imageUrl) {
        handleImageChange(imageUrl);
      }
    } catch (error) {
      console.error("Image upload failed", error);
    }
  };

  // Close picker when popover closes
  useEffect(() => {
    if (!isOpen) {
      setIsPickerOpen(false);
      setDragOverImage(false);
    }
  }, [isOpen]);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <ImageIcon className="h-4 w-4" />
            Background
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Page Background</h4>
            <div className="space-y-2">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-8 w-12 p-1"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#ffffff"
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Background Image</Label>
              <div
                className={`group relative flex h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
                  dragOverImage ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
                }`}
                onClick={() => setIsPickerOpen(true)}
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
                onDrop={handleImageDrop}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setIsPickerOpen(true);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {image ? (
                  <>
                    <Image
                      src={image}
                      alt="Background preview"
                      fill
                      className="object-cover"
                      draggable={false}
                      sizes="(max-width: 768px) 100vw, 320px"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 px-4 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Upload className="mb-1 h-4 w-4" />
                      <span>Click to replace</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-5 w-5 text-gray-400" />
                    <p className="text-xs text-gray-500">Click or drop</p>
                  </div>
                )}
              </div>
              {image && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleImageChange("")}
                >
                  Remove Image
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Image URL</Label>
              <Input
                type="text"
                value={image}
                onChange={(e) => handleImageChange(e.target.value)}
                placeholder="https://..."
                className="h-8"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <ImagePickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        images={imagesQuery ?? []}
        onImageSelect={(url) => handleImageChange(url)}
      />
    </>
  );
}

export default BackgroundPopover;

