import type React from "react";
import type { Component, ComponentCategory, ComponentType } from "@/types";
import ImageManifest from "../components/quiz/components/Image";
import TextManifest from "../components/quiz/components/Text";
import ShapeManifest from "../components/quiz/components/Shape";
import GroupManifest from "../components/quiz/components/Group";
import ProgressBarManifest from "../components/quiz/components/ProgressBar";

// ==========================================
// COMPONENT MANIFEST TYPES
// ==========================================

export interface InstantiateHelpers {
  createId: () => string;
}

export interface ComponentRenderHelpers {
  isEditable: boolean;
  selectedComponentId?: string;
  editingComponentId?: string;
  onComponentClick?: (component: Component) => void;
  onTextChange?: (componentId: string, text: string) => void;
  currentPageNumber?: number;
  totalPages?: number;
}

export interface ComponentRenderParams<
  TComponent extends Component = Component,
> {
  component: TComponent;
  helpers: ComponentRenderHelpers;
}

export interface ComponentToolbarProps<
  TComponent extends Component = Component,
> {
  component: TComponent;
  onUpdateProps: (props: Record<string, unknown>) => void;
  onOpenImagePicker?: () => void;
  onUnmerge?: () => void; // For group components
  pageType?: "quiz" | "result" | "onboarding";
}

export interface ComponentManifest<TComponent extends Component = Component> {
  slug: string;
  type: ComponentType;
  category: ComponentCategory;
  label: string;
  Asset: React.ComponentType;
  Toolbar: React.ComponentType<ComponentToolbarProps<TComponent>>;
  render: (params: ComponentRenderParams<TComponent>) => React.ReactNode;
  create: (helpers: InstantiateHelpers) => TComponent;
}

// ==========================================
// COMPONENT REGISTRY
// ==========================================

const manifests: ComponentManifest[] = [
  ImageManifest as ComponentManifest,
  TextManifest as ComponentManifest,
  ShapeManifest as ComponentManifest,
  GroupManifest as ComponentManifest,
  ProgressBarManifest as ComponentManifest,
];

export const componentManifests = manifests;

const componentManifestByType = new Map(
  manifests.map((manifest) => [manifest.type, manifest]),
);

export function getManifestByType(
  type: ComponentType,
): ComponentManifest | undefined {
  return componentManifestByType.get(type);
}
