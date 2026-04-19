"use client";

import { Button } from "@/components/ui/button";
import type { ImageComponent } from "./types";

export interface ImageToolbarProps {
  component: ImageComponent;
  onUpdateProps: (props: Record<string, unknown>) => void;
  onOpenImagePicker?: () => void;
}

export function ImageToolbar({
  onOpenImagePicker,
}: ImageToolbarProps) {
  return (
    <Button variant="outline" size="sm" onClick={onOpenImagePicker}>
      Change Image
    </Button>
  );
}

export default ImageToolbar;
