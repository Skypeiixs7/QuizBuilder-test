import type { Id } from "../../convex/_generated/dataModel";

// ==========================================
// COMPONENT TYPES
// ==========================================

export type ComponentType =
  | "image"
  | "text"
  | "shape"
  | "group"
  | "progressBar";

export type ComponentCategory = "content";

export type PageAction =
  | "nextPage"
  | "previousPage"
  | "answerBox"
  | "hyperlink"
  | "startQuiz";

export interface ComponentPosition {
  x: number; // Offset from center (-50 to 50), 0 = centered
  y: number; // Top position as percentage (0-100)
  width: number; // Width as percentage (0-100)
  height: number; // Height as percentage (0-100)
  rotation?: number; // Rotation in degrees (0-360)
}

/**
 * Child component within a group - positions are relative to the group's bounding box
 */
export interface GroupChild {
  id: string;
  type: Exclude<ComponentType, "group">; // Children cannot be groups
  data?: string;
  props?: Record<string, unknown>;
  action?: PageAction;
  actionProps?: Record<string, unknown>;
  /** Position relative to group (0-100 within group bounds) */
  relativePosition: {
    x: number; // Percentage offset from group center (-50 to 50)
    y: number; // Percentage from top of group (0-100)
    width: number; // Percentage of group width
    height: number; // Percentage of group height
  };
}

export interface Component {
  id: string;
  type: ComponentType;
  data?: string;
  props?: Record<string, unknown>;
  action?: PageAction;
  actionProps?: Record<string, unknown>;
  position?: ComponentPosition;
  /** For group components: the child components */
  children?: GroupChild[];
}

// ==========================================
// PAGE TYPES
// ==========================================

/**
 * Background configuration for a page
 */
export interface PageBackground {
  color?: string;
  image?: string;
}

export type PageTemplate = {
  id: string;
  title: string;
  description?: string;
  pageName?: string;
  background?: PageBackground;
  build: () => Component[];
};

// ==========================================
// DATABASE ENTITY TYPES
// ==========================================

export interface PageEntity {
  _id: Id<"pages">;
  quizId: Id<"quiz">;
  pageName?: string;
  components: Component[];
  background?: PageBackground;
  order?: number;
  userId: Id<"users">;
  _creationTime: number;
  pageType?: "page" | "onboarding";
  questionMode?: "single" | "multiple";
  //Store whether this page allows single selection or multiple selection.
}

/**
 * Result page entity from database
 */
export interface ResultEntity {
  _id: Id<"results">;
  quizId: Id<"quiz">;
  pageName?: string;
  components: Component[];
  background?: PageBackground;
  order?: number;
  userId: Id<"users">;
  _creationTime: number;
}

/**
 * Image entity from database
 */
export interface Image {
  _id: Id<"images">;
  name: string;
  userId: Id<"users">;
  storageId: Id<"_storage">;
  format?: string;
  size?: number;
  url?: string | null;
  _creationTime: number;
}

// ==========================================
// EDITOR TYPES
// ==========================================

/**
 * Grouped editor action callbacks passed through the component tree.
 * Built by `usePageEditor` and consumed by EditorPreviewPanel / PhonePreview.
 */
export interface EditorActions {
  // Component editing
  onComponentPositionChange?: (
    componentId: string,
    position: ComponentPosition,
  ) => void;
  onTextChange?: (componentId: string, text: string) => void;
  onUpdateProps?: (props: Record<string, unknown>) => void;
  onUpdateData?: (data: string) => void;
  onUpdateAction?: (
    action: PageAction | undefined,
    actionProps?: Record<string, unknown>,
  ) => void;
  onDeleteComponent?: () => void;
  onDropComponent?: (
    componentType: "image" | "text" | "shape" | "progressBar",
    dropPosition: { x: number; y: number },
    shapeVariant?: string,
  ) => void;
  onOpenImagePicker?: () => void;

  // Clipboard
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  canPaste?: boolean;

  // Undo / Redo
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Z-index
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  canBringForward?: boolean;
  canSendBackward?: boolean;

  // Multi-selection
  multiSelectedIds?: string[];
  onMultiSelect?: (ids: string[]) => void;
  onMergeComponents?: (ids: string[]) => void;
  onUnmergeGroup?: (groupId: string) => void;
}

// ==========================================
// RE-EXPORTS
// ==========================================

export type { Id } from "../../convex/_generated/dataModel";
