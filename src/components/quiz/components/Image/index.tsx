import { ImageAsset, IMAGE_COMPONENT_SLUG } from "./Asset";
import { ImageView } from "./View";
import { ImageToolbar } from "./Toolbar";
import type { ImageComponent } from "./types";
import {
  type ComponentManifest,
  type ComponentRenderParams,
  type InstantiateHelpers,
} from "@/lib/quizComponents";

function createImageComponent({
  createId,
}: InstantiateHelpers): ImageComponent {
  return {
    id: createId(),
    type: "image",
    data: "https://placehold.co/200x150/png",
    props: {},
  };
}

function renderImageComponent({
  component,
}: ComponentRenderParams<ImageComponent>) {
  return <ImageView src={component.data ?? ""} />;
}

const manifest: ComponentManifest<ImageComponent> = {
  slug: IMAGE_COMPONENT_SLUG,
  type: "image",
  category: "content",
  label: "Image",
  Asset: ImageAsset,
  Toolbar: ImageToolbar,
  create: createImageComponent,
  render: renderImageComponent,
};

export default manifest;
export type { ImageComponent };
