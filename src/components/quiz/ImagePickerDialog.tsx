import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";
import type { Image as ImageType } from "@/types";
import { FileUpload } from "@/components/ui/file-upload";

interface ImagePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageType[];
  onImageSelect: (url: string) => void;
}

const ImagePickerDialog = ({
  isOpen,
  onClose,
  images,
  onImageSelect,
}: ImagePickerDialogProps) => {
  const handleImageSelect = (image: ImageType) => {
    const url = image.url ?? "";
    if (url) {
      onImageSelect(url);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
          <DialogDescription>
            Choose an image from your uploaded images or upload a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-96 grid-cols-1 gap-4 overflow-y-auto p-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <div
              key={image._id}
              onClick={() => handleImageSelect(image)}
              className="cursor-pointer rounded-lg border border-gray-200 p-2 transition-all hover:border-blue-500 hover:shadow-md"
            >
              {image.url && (
                <Image
                  src={image.url}
                  alt={image.name}
                  width={150}
                  height={150}
                  className="h-32 w-full rounded-lg object-cover"
                />
              )}
              <p className="mt-2 truncate text-xs text-gray-600">
                {image.name}
              </p>
            </div>
          ))}
        </div>

        {images.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p>No images uploaded yet</p>
            <p className="mt-1 text-sm">
              Upload some images first to use them in your quiz.
            </p>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <FileUpload
            onUploadComplete={({ url }) => {
              if (url) {
                onImageSelect(url);
                onClose();
              }
            }}
          >
            <Button type="button" variant="default">
              Upload Image
            </Button>
          </FileUpload>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImagePickerDialog;
