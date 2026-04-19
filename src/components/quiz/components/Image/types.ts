import type { Component } from "@/types";

export interface ImageComponent extends Component {
  type: "image";
  data: string;
  props?: {
    width?: number;
    height?: number;
  } & Record<string, unknown>;
}
