"use client";

import type { Component } from "@/types";
import {
  type ComponentRenderHelpers,
  getManifestByType,
} from "@/lib/quizComponents";

export interface ComponentRendererProps {
  component: Component;
  selectedComponentId?: string;
  editingComponentId?: string;
  isEditable?: boolean;
  onTextChange?: (componentId: string, text: string) => void;
  currentPageNumber?: number;
  totalPages?: number;
}

export function ComponentRenderer({
  component,
  selectedComponentId,
  editingComponentId,
  isEditable = false,
  onTextChange,
  currentPageNumber,
  totalPages,
}: ComponentRendererProps) {
  const manifest = getManifestByType(component.type);

  if (!manifest) {
    return null;
  }

  const helpers: ComponentRenderHelpers = {
    isEditable,
    selectedComponentId,
    editingComponentId,
    onTextChange,
    currentPageNumber,
    totalPages,
  };

  return manifest.render({
    component,
    helpers,
  });
}
