"use client";

import type {
  Component,
  PageBackground,
  ComponentPosition,
  PageAction,
} from "@/types";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { ComponentRenderer } from "./ComponentRenderer";
import ComponentToolbar, { type EditorPageType } from "./ComponentToolbar";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";

interface PhonePreviewProps {
  components?: Component[];
  background?: PageBackground;
  scale?: number;
  selectedComponentId?: string;
  selectedComponent?: Component | null;
  onComponentClick?: (component: Component) => void;
  onComponentHover?: (component: Component | null) => void;
  onBackgroundClick?: () => void;
  isEditable?: boolean;
  emptyStateContent?: React.ReactNode;
  className?: string;
  onInsertComponent?: (
    payload: unknown,
    destination: { parentId: string; index: number },
  ) => void;
  onComponentPositionChange?: (
    componentId: string,
    position: ComponentPosition,
  ) => void;
  roundedCorners?: boolean;
  contentClassName?: string;
  onTextChange?: (componentId: string, text: string) => void;
  onImageEdit?: (componentId: string) => void;
  onDropComponent?: (
    componentType: "image" | "text" | "shape" | "progressBar",
    dropPosition: { x: number; y: number },
    shapeVariant?: string,
  ) => void;
  // Toolbar props
  onUpdateProps?: (props: Record<string, unknown>) => void;
  onUpdateData?: (data: string) => void;
  onDeleteComponent?: () => void;
  onOpenImagePicker?: () => void;
  onUpdateAction?: (
    action: PageAction | undefined,
    actionProps?: Record<string, unknown>,
  ) => void;
  // Multi-selection props
  multiSelectedIds?: string[];
  onMultiSelect?: (ids: string[]) => void;
  onMergeComponents?: (ids: string[]) => void;
  // Unmerge callback for group components
  onUnmergeGroup?: (groupId: string) => void;
  // Page type for action filtering
  pageType?: EditorPageType;
  // Play mode action callback - triggered when clicking a component with an action
  onComponentAction?: (
    action: PageAction,
    actionProps?: Record<string, unknown>,
    component?: Component,
  ) => void;
  currentPageNumber?: number;
  totalPages?: number;
  // Frameless mode - removes phone frame styling for full-screen play mode
  frameless?: boolean;
  selectedAnswers?: Component[];
}

interface PreviewWrapperProps {
  isEditable: boolean;
  isSelected: boolean;
  isMultiSelected?: boolean; // True when component is part of multi-selection (hide toolbar)
  onComponentClick?: (component: Component) => void;
  onComponentHover?: (component: Component | null) => void;
  selectedComponentId?: string;
  editingComponentId?: string;
  onPositionChange?: (componentId: string, position: ComponentPosition) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onTextChange?: (componentId: string, text: string) => void;
  onStartEditing?: (componentId: string) => void;
  onImageEdit?: (componentId: string) => void;
  // Toolbar props
  onUpdateProps?: (props: Record<string, unknown>) => void;
  onUpdateData?: (data: string) => void;
  onDeleteComponent?: () => void;
  onOpenImagePicker?: () => void;
  onUpdateAction?: (
    action: PageAction | undefined,
    actionProps?: Record<string, unknown>,
  ) => void;
  // Page type for action filtering
  pageType?: EditorPageType;
  // Unmerge callback for group components
  onUnmerge?: () => void;
  // Clear multi-selection callback
  onClearMultiSelect?: () => void;
  // Play mode action callback
  onComponentAction?: (
    action: PageAction,
    actionProps?: Record<string, unknown>,
    component?: Component,
  ) => void;
  currentPageNumber?: number;
  totalPages?: number;
}

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

const VISIBILITY_MARGIN = 0.01;

// Clamp positions so that at least part of the component stays on-screen.
const clampXToVisibleRange = (x: number, width: number) => {
  const halfWidth = width / 2;
  const minX = -50 - halfWidth + VISIBILITY_MARGIN; // Keep right edge inside
  const maxX = 50 + halfWidth - VISIBILITY_MARGIN; // Keep left edge inside
  return Math.min(Math.max(x, minX), maxX);
};

const clampYToVisibleRange = (y: number, height: number) => {
  const minY = -height + VISIBILITY_MARGIN; // Keep bottom edge inside
  const maxY = 100 - VISIBILITY_MARGIN; // Keep top edge inside
  return Math.min(Math.max(y, minY), maxY);
};

function PreviewComponentWrapper({
  component,
  isEditable,
  isSelected,
  isMultiSelected,
  onComponentClick,
  onComponentHover,
  selectedComponentId,
  editingComponentId,
  onPositionChange,
  containerRef,
  onTextChange,
  onStartEditing,
  onImageEdit,
  onUpdateProps,
  onUpdateData,
  onDeleteComponent,
  onOpenImagePicker,
  onUpdateAction,
  pageType,
  onUnmerge,
  onClearMultiSelect,
  onComponentAction,
  currentPageNumber,
  totalPages,
}: PreviewWrapperProps & { component: Component }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [dragStart, setDragStart] = useState({
    mouseX: 0,
    mouseY: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const elementRef = useRef<HTMLDivElement>(null);
  const rotateStartRef = useRef<{
    startAngle: number;
    startRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  // Use position from component - should always exist after normalization
  // Position system: x=0 means horizontally centered, position refers to component's center-top
  const position = useMemo(
    () =>
      component.position ?? {
        x: 0,
        y: 10,
        width: 90,
        height: 15,
      },
    [component.position],
  );

  const rotation = position.rotation ?? 0;

  // Convert center-based position to CSS left/top
  // x: 0 = centered, negative = left of center, positive = right of center
  // The position.x represents where the CENTER of the component is relative to 50% (center of container)
  const cssLeft = 50 + position.x - position.width / 2;
  const cssTop = position.y;

  // Check if component has an action (for play mode cursor styling)
  const hasAction = Boolean(component.action);

  const interactiveClass = !isEditable
    ? hasAction
      ? "cursor-pointer hover:brightness-95 active:brightness-90 transition-all" // Play mode: actionable components get click feedback
      : ""
    : isMultiSelected
      ? "" // No individual outline for multi-selected components (unified box is shown instead)
      : isSelected
        ? "outline outline-2 outline-offset-2 outline-white shadow-lg"
        : "hover:outline hover:outline-1 hover:outline-offset-1 hover:outline-gray-300";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      // Only allow dragging if component is selected
      if (!isSelected) return;
      // Don't start drag if clicking on a resize handle
      const target = e.target as HTMLElement;
      if (target.dataset.resizeHandle || target.dataset.rotateHandle) return;
      e.stopPropagation();
      e.preventDefault(); // Prevent default to stop image dragging

      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });

      setIsDragging(true);
    },
    [
      isEditable,
      isSelected,
      position,
    ],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();

      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });
      setIsResizing(handle);
    },
    [isEditable, position],
  );

  const handleRotateStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();

      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

      rotateStartRef.current = {
        startAngle,
        startRotation: rotation,
        centerX,
        centerY,
      };
      setIsRotating(true);
    },
    [isEditable, rotation],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef?.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Calculate mouse delta as percentage of container
      const deltaXPercent =
        ((e.clientX - dragStart.mouseX) / containerRect.width) * 100;
      const deltaYPercent =
        ((e.clientY - dragStart.mouseY) / containerRect.height) * 100;

      if (isDragging) {
        // Move the component (position is center-based)
        const newX = dragStart.x + deltaXPercent;
        const newY = dragStart.y + deltaYPercent;

        // Clamp so component never goes fully offscreen
        const clampedX = clampXToVisibleRange(newX, dragStart.width);
        const clampedY = clampYToVisibleRange(newY, dragStart.height);

        onPositionChange?.(component.id, {
          ...position,
          x: clampedX,
          y: clampedY,
          rotation: position.rotation,
        });

      } else if (isResizing) {
        const newX = dragStart.x;
        let newY = dragStart.y;
        let newWidth = dragStart.width;
        let newHeight = dragStart.height;
        const maxWidth = component.type === "shape" ? Infinity : 100;

        // Handle resize based on which handle is being dragged
        if (isResizing.includes("e")) {
          // East (right edge) - increase width, keep center x the same means left edge moves left
          newWidth = Math.max(
            5,
            Math.min(maxWidth, dragStart.width + deltaXPercent * 2),
          );
        }
        if (isResizing.includes("w")) {
          // West (left edge) - increase width on the left side
          newWidth = Math.max(
            5,
            Math.min(maxWidth, dragStart.width - deltaXPercent * 2),
          );
        }
        if (isResizing.includes("s")) {
          // South (bottom edge) - increase height
          newHeight = Math.max(5, dragStart.height + deltaYPercent);
        }
        if (isResizing.includes("n")) {
          // North (top edge) - decrease height, move y
          const heightDelta = -deltaYPercent;
          newHeight = Math.max(5, dragStart.height + heightDelta);
          // Adjust y to keep the bottom edge in place
          newY = clampYToVisibleRange(dragStart.y - heightDelta, newHeight);
        }

        onPositionChange?.(component.id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
          rotation: position.rotation,
        });
      } else if (isRotating && rotateStartRef.current) {
        const { centerX, centerY, startAngle, startRotation } =
          rotateStartRef.current;
        const currentAngle = Math.atan2(
          e.clientY - centerY,
          e.clientX - centerX,
        );
        const delta = currentAngle - startAngle;
        let newRotation = startRotation + (delta * 180) / Math.PI;
        newRotation = ((newRotation % 360) + 360) % 360;

        onPositionChange?.(component.id, {
          ...position,
          rotation: newRotation,
        });
      }
    },
    [
      isDragging,
      isResizing,
      isRotating,
      containerRef,
      dragStart,
      position,
      component.id,
      component.type,
      onPositionChange,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
    setIsRotating(false);
    rotateStartRef.current = null;
  }, []);

  // Attach global mouse listeners when dragging or resizing
  useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp]);

  const RotationHandle =
    isEditable && isSelected && !isMultiSelected ? (
      <>
        <div
          data-rotate-handle="true"
          className="absolute -top-6 left-1/2 z-10 flex h-4 w-4 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-blue-500 bg-white shadow"
          onMouseDown={handleRotateStart}
        >
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
        <div className="absolute -top-2 left-1/2 z-10 h-3 w-px -translate-x-1/2 bg-blue-500" />
      </>
    ) : null;

  // Resize handle component (hide for multi-selected components - they use unified bounding box)
  const ResizeHandles =
    isEditable && isSelected && !isMultiSelected ? (
      <>
        {/* Corner handles */}
        <div
          data-resize-handle="nw"
          className="absolute -left-1.5 -top-1.5 z-10 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "nw")}
        />
        <div
          data-resize-handle="ne"
          className="absolute -right-1.5 -top-1.5 z-10 h-3 w-3 cursor-nesw-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "ne")}
        />
        <div
          data-resize-handle="sw"
          className="absolute -bottom-1.5 -left-1.5 z-10 h-3 w-3 cursor-nesw-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "sw")}
        />
        <div
          data-resize-handle="se"
          className="absolute -bottom-1.5 -right-1.5 z-10 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "se")}
        />
        {/* Edge handles */}
        <div
          data-resize-handle="n"
          className="absolute -top-1 left-1/2 z-10 h-2 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "n")}
        />
        <div
          data-resize-handle="s"
          className="absolute -bottom-1 left-1/2 z-10 h-2 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "s")}
        />
        <div
          data-resize-handle="w"
          className="absolute -left-1 top-1/2 z-10 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "w")}
        />
        <div
          data-resize-handle="e"
          className="absolute -right-1 top-1/2 z-10 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm bg-blue-500 hover:bg-blue-600"
          onMouseDown={(e) => handleResizeStart(e, "e")}
        />
      </>
    ) : null;

  // Show toolbar for selected components (not multi-selected)
  const showToolbar =
    isEditable &&
    isSelected &&
    !isMultiSelected &&
    onUpdateProps &&
    onDeleteComponent;

  const componentElement = (
    <div
      ref={elementRef}
      data-component-wrapper
      className={`absolute overflow-visible ${interactiveClass} ${isDragging ? "z-50 cursor-grabbing" : isResizing ? "z-50" : isEditable && isSelected ? "cursor-grab" : ""}`}
      style={{
        left: `${cssLeft}%`,
        top: `${cssTop}%`,
        width: `${position.width}%`,
        height: `${position.height}%`,
        userSelect: "none", // Prevent text selection while dragging
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "center center",
      }}
      onMouseDown={handleMouseDown}
      onDragStart={(e) => e.preventDefault()} // Prevent default drag behavior (especially for images)
      onClick={(event) => {
        event.stopPropagation();
        // Handle action clicks in play mode (non-editable)
        if (!isEditable) {
          if (component.action && onComponentAction) {
            onComponentAction(
              component.action,
              component.actionProps,
              component,
            );
          }
          return;
        }
        // Editor mode click handling
        onClearMultiSelect?.();
        onComponentClick?.(component);
      }}
      onDoubleClick={(event) => {
        if (!isEditable) return;
        event.stopPropagation();
        if (component.type === "text") {
          onStartEditing?.(component.id);
        } else if (component.type === "image") {
          onImageEdit?.(component.id);
        }
      }}
      onMouseEnter={() => {
        if (!isEditable) return;
        onComponentHover?.(component);
      }}
      onMouseLeave={() => {
        if (!isEditable) return;
        onComponentHover?.(null);
      }}
    >
      <div
        className={`h-full w-full ${editingComponentId === component.id && component.type === "text" ? "" : isEditable ? "pointer-events-none select-none" : "select-none"}`}
        style={{
          pointerEvents:
            editingComponentId === component.id && component.type === "text"
              ? "auto"
              : isEditable
                ? "none"
                : "auto", // Allow pointer events in play mode for actions
        }}
      >
        <ComponentRenderer
          component={component}
          selectedComponentId={selectedComponentId}
          editingComponentId={editingComponentId}
          isEditable={isEditable}
          onTextChange={onTextChange}
          currentPageNumber={currentPageNumber}
          totalPages={totalPages}
        />
        {isSelected && !isEditable && ( 
          <div
            className="
              absolute
              top-1
              right-1
              z-30
              w-6
              h-6
              rounded-full
              bg-black/70
              text-white
              flex
              items-center
              justify-center
              text-xs
              pointer-events-none 
            "
          >
            ✓
          </div>
        )}

      </div>
      {RotationHandle}
      {ResizeHandles}
    </div>
  );

  if (showToolbar) {
    return (
      <Popover open={true} modal={false}>
        <PopoverAnchor asChild>{componentElement}</PopoverAnchor>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={16}
          className="w-auto border-none bg-transparent p-0 shadow-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ComponentToolbar
              component={component}
              onUpdateProps={onUpdateProps}
              onUpdateData={onUpdateData ?? (() => undefined)}
              onUpdatePosition={() => undefined}
              onDelete={onDeleteComponent}
              onOpenImagePicker={onOpenImagePicker}
              onUpdateAction={onUpdateAction}
              pageType={pageType}
              onUnmerge={component.type === "group" ? onUnmerge : undefined}
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return componentElement;
}

export default function PhonePreview({
  components,
  background,
  scale = 0.4,
  selectedComponentId,
  selectedComponent,
  onComponentClick,
  onComponentHover,
  onBackgroundClick,
  isEditable = false,
  emptyStateContent,
  className = "",
  onInsertComponent,
  onComponentPositionChange,
  roundedCorners = true,
  contentClassName,
  onTextChange,
  onImageEdit,
  onDropComponent,
  onUpdateProps,
  onUpdateData,
  onDeleteComponent,
  onOpenImagePicker,
  onUpdateAction,
  multiSelectedIds = [],
  onMultiSelect,
  onMergeComponents,
  onUnmergeGroup,
  pageType = "quiz",
  onComponentAction,
  currentPageNumber,
  totalPages,
  frameless = false,
  selectedAnswers,
}: PhonePreviewProps) {
  const baseWidth = 390;
  const baseHeight = 844;
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(
    null,
  );
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  // Marquee selection state
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });
  // Flag to prevent click from clearing selection right after marquee completes
  const justCompletedMarqueeRef = useRef(false);

  const normalizedComponents = useMemo(() => components ?? [], [components]);

  // Clear editing mode when selection changes to a different component
  useEffect(() => {
    if (editingComponentId && selectedComponentId !== editingComponentId) {
      setEditingComponentId(null);
    }
  }, [selectedComponentId, editingComponentId]);

  useEffect(() => {
    const wrapperElement = previewWrapperRef.current;
    if (!wrapperElement) return;

    const targetElement = wrapperElement.parentElement ?? wrapperElement;

    const updateWidth = () => {
      const newWidth = targetElement.getBoundingClientRect().width;
      setAvailableWidth((prev) => {
        if (prev === null) return newWidth;
        return Math.abs(prev - newWidth) < 0.5 ? prev : newWidth;
      });
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  const effectiveScale = useMemo(() => {
    if (!availableWidth || availableWidth <= 0) {
      return scale;
    }
    const maxScale = availableWidth / baseWidth;
    return Math.min(scale, maxScale);
  }, [availableWidth, scale]);

  // Keyboard event handler for delete and arrow keys
  useEffect(() => {
    if (!isEditable || !selectedComponentId || !selectedComponent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys when editing text
      if (editingComponentId) return;

      // Don't handle if focus is on an input element
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      // Delete component with Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDeleteComponent?.();
        return;
      }

      // Move component with arrow keys
      const MOVE_STEP = 1; // 1% per key press
      const MOVE_STEP_LARGE = 5; // 5% when holding Shift
      const step = e.shiftKey ? MOVE_STEP_LARGE : MOVE_STEP;

      const position = selectedComponent.position;
      if (!position || !onComponentPositionChange) return;

      let newX = position.x;
      let newY = position.y;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newX = position.x - step;
          break;
        case "ArrowRight":
          e.preventDefault();
          newX = position.x + step;
          break;
        case "ArrowUp":
          e.preventDefault();
          newY = position.y - step;
          break;
        case "ArrowDown":
          e.preventDefault();
          newY = position.y + step;
          break;
        default:
          return;
      }

      // Clamp positions so the component never leaves the screen completely
      newX = clampXToVisibleRange(newX, position.width);
      newY = clampYToVisibleRange(newY, position.height);

      onComponentPositionChange(selectedComponentId, {
        ...position,
        x: newX,
        y: newY,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isEditable,
    selectedComponentId,
    selectedComponent,
    editingComponentId,
    onDeleteComponent,
    onComponentPositionChange,
  ]);

  const scaledWidth = baseWidth * effectiveScale;
  const scaledHeight = baseHeight * effectiveScale;

  const handleBackgroundClickInternal = useCallback(() => {
    // Skip if we just completed a marquee selection (click fires after mouseup)
    if (justCompletedMarqueeRef.current) {
      justCompletedMarqueeRef.current = false;
      return;
    }

    setEditingComponentId(null);
    onBackgroundClick?.();
    // Clear multi-selection when clicking background
    if (multiSelectedIds.length > 0) {
      onMultiSelect?.([]);
    }
  }, [onBackgroundClick, multiSelectedIds.length, onMultiSelect]);

  // Marquee selection handlers
  const handleMarqueeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isEditable || !onMultiSelect) return;

      // Check if we clicked directly on the container (background)
      // or on a child element that is part of a component
      const target = e.target as HTMLElement;
      const isClickOnComponent = target.closest("[data-component-wrapper]");
      if (isClickOnComponent) return;

      const rect = e.currentTarget.getBoundingClientRect();
      // Divide by scale to convert screen coordinates to unscaled coordinate system
      const x = (e.clientX - rect.left) / effectiveScale;
      const y = (e.clientY - rect.top) / effectiveScale;

      setIsMarqueeActive(true);
      setMarqueeStart({ x, y });
      setMarqueeEnd({ x, y });

      // Clear single selection when starting marquee
      onBackgroundClick?.();
    },
    [isEditable, onMultiSelect, onBackgroundClick, effectiveScale],
  );

  const handleMarqueeMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isMarqueeActive) return;

      const rect = e.currentTarget.getBoundingClientRect();
      // Divide by scale to convert screen coordinates to unscaled coordinate system
      const x = (e.clientX - rect.left) / effectiveScale;
      const y = (e.clientY - rect.top) / effectiveScale;

      setMarqueeEnd({ x, y });
    },
    [isMarqueeActive, effectiveScale],
  );

  const handleMarqueeEnd = useCallback(() => {
    if (!isMarqueeActive || !onMultiSelect) {
      setIsMarqueeActive(false);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setIsMarqueeActive(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    // Divide by scale to get unscaled dimensions (marquee coordinates are in unscaled space)
    const containerWidth = containerRect.width / effectiveScale;
    const containerHeight = containerRect.height / effectiveScale;

    // Normalize marquee rectangle
    const left = Math.min(marqueeStart.x, marqueeEnd.x);
    const right = Math.max(marqueeStart.x, marqueeEnd.x);
    const top = Math.min(marqueeStart.y, marqueeEnd.y);
    const bottom = Math.max(marqueeStart.y, marqueeEnd.y);

    // Convert marquee pixels to percentage coordinates
    const marqueeLeftPct = (left / containerWidth) * 100;
    const marqueeRightPct = (right / containerWidth) * 100;
    const marqueeTopPct = (top / containerHeight) * 100;
    const marqueeBottomPct = (bottom / containerHeight) * 100;

    // Find components that intersect with the marquee
    const selected = normalizedComponents.filter((comp) => {
      if (!comp.position) return false;
      const pos = comp.position;

      // Convert component center-based X to left position
      const compLeftPct = 50 + pos.x - pos.width / 2;
      const compRightPct = 50 + pos.x + pos.width / 2;
      const compTopPct = pos.y;
      const compBottomPct = pos.y + pos.height;

      // Check for intersection
      const intersectsX =
        compLeftPct < marqueeRightPct && compRightPct > marqueeLeftPct;
      const intersectsY =
        compTopPct < marqueeBottomPct && compBottomPct > marqueeTopPct;

      return intersectsX && intersectsY;
    });

    if (selected.length > 1) {
      onMultiSelect(selected.map((c) => c.id));
      // Prevent the subsequent click event from clearing the selection
      justCompletedMarqueeRef.current = true;
    }

    setIsMarqueeActive(false);
  }, [
    isMarqueeActive,
    marqueeStart,
    marqueeEnd,
    normalizedComponents,
    onMultiSelect,
    effectiveScale,
  ]);

  // Calculate marquee display rect
  const marqueeRect = isMarqueeActive
    ? {
        left: Math.min(marqueeStart.x, marqueeEnd.x),
        top: Math.min(marqueeStart.y, marqueeEnd.y),
        width: Math.abs(marqueeEnd.x - marqueeStart.x),
        height: Math.abs(marqueeEnd.y - marqueeStart.y),
      }
    : null;

  // Calculate bounding box for multi-selected components (in percentage coordinates)
  const multiSelectionBounds = useMemo(() => {
    if (multiSelectedIds.length < 2) return null;

    const selectedComponents = normalizedComponents.filter((c) =>
      multiSelectedIds.includes(c.id),
    );
    if (selectedComponents.length < 2) return null;

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    selectedComponents.forEach((comp) => {
      if (!comp.position) return;
      const pos = comp.position;

      // Convert center-based X to left/right positions
      const compLeft = 50 + pos.x - pos.width / 2;
      const compRight = 50 + pos.x + pos.width / 2;
      const compTop = pos.y;
      const compBottom = pos.y + pos.height;

      minLeft = Math.min(minLeft, compLeft);
      minTop = Math.min(minTop, compTop);
      maxRight = Math.max(maxRight, compRight);
      maxBottom = Math.max(maxBottom, compBottom);
    });

    if (!isFinite(minLeft)) return null;

    return {
      left: minLeft,
      top: minTop,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };
  }, [multiSelectedIds, normalizedComponents]);

  // Create background style
  const backgroundStyle: React.CSSProperties = {
    backgroundColor: background?.color ?? "white",
  };
  if (background?.image) {
    backgroundStyle.backgroundImage = `url(${background.image})`;
    backgroundStyle.backgroundSize = "cover";
    backgroundStyle.backgroundPosition = "center";
    backgroundStyle.backgroundRepeat = "no-repeat";
  }

  const defaultEmptyState = (
    <div className="flex h-full items-center justify-center text-gray-400">
      <div className="text-center">
        <div className="mb-4 text-4xl">📱</div>
        <p className="mb-2 text-lg">No content</p>
        <p className="text-sm">
          {isEditable
            ? "Drop components here to start building"
            : "Nothing to display"}
        </p>
      </div>
    </div>
  );

  const getPayloadFromEvent = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const json = event.dataTransfer.getData("application/json");
      if (json) {
        try {
          return JSON.parse(json);
        } catch {
          return undefined;
        }
      }
      const text = event.dataTransfer.getData("text/plain");
      if (text) {
        return text;
      }
      return undefined;
    },
    [],
  );

  const handleDropToDestination = useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      destination: { parentId: string; index: number },
    ) => {
      if (!isEditable) return;
      const payload = getPayloadFromEvent(event);
      if (payload === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      onInsertComponent?.(payload, destination);
    },
    [getPayloadFromEvent, isEditable, onInsertComponent],
  );

  const rootInsertionIndex = normalizedComponents.length;

  const handleBackgroundDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isEditable) return;

      // Check for component type drop from dock
      const componentType = event.dataTransfer.getData("componentType");
      if (
        componentType === "image" ||
        componentType === "text" ||
        componentType === "shape" ||
        componentType === "progressBar"
      ) {
        event.preventDefault();
        event.stopPropagation();

        // Calculate drop position relative to container
        const container = containerRef.current;
        if (container && onDropComponent) {
          const rect = container.getBoundingClientRect();
          // Account for scale
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;

          // Convert from CSS position to center-based position
          // The position.x represents offset from center (50%)
          // So if drop is at CSS left 30%, that's 30 - 50 = -20 for center-x
          const centerX = x - 50;

          // Get shape variant if dropping a shape
          const shapeVariant =
            componentType === "shape"
              ? event.dataTransfer.getData("shapeVariant") || undefined
              : undefined;

          onDropComponent(
            componentType,
            { x: centerX, y: Math.max(0, y) },
            shapeVariant,
          );
        }
        return;
      }

      handleDropToDestination(event, {
        parentId: "root",
        index: rootInsertionIndex,
      });
    },
    [handleDropToDestination, isEditable, rootInsertionIndex, onDropComponent],
  );

  // Screen content (the actual quiz display area)
  const screenContent = (
    <div
      className={`relative h-full w-full overflow-hidden ${!frameless && roundedCorners ? "rounded-[2rem]" : ""}`}
      style={backgroundStyle}
      onClick={handleBackgroundClickInternal}
      onDragOver={(e) => {
        if (!isEditable) return;
        if (
          e.dataTransfer.types.includes("componenttype") ||
          e.dataTransfer.types.includes("application/json") ||
          e.dataTransfer.types.includes("text/plain")
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleBackgroundDrop}
    >
      {/* Content Area */}
      <div
        ref={containerRef}
        className={`relative h-full w-full overflow-hidden ${contentClassName ?? ""}`}
        onMouseDown={handleMarqueeStart}
        onMouseMove={handleMarqueeMove}
        onMouseUp={handleMarqueeEnd}
        onMouseLeave={handleMarqueeEnd}
      >
        {/* Render each component on the page */}
        {/* This loop is responsible for displaying all UI elements */}
        {normalizedComponents.length > 0
          ? normalizedComponents.map((component) => {
          const isAnswerSelected =
            selectedAnswers?.some(
              (a) => a.id === component.id
            ) ?? false; 
            // Check whether the current component is selected as an answer
            // Used in play mode to visually indicate selected options

          return (
            <PreviewComponentWrapper
              key={component.id}
              component={component}
              isEditable={isEditable}
              isSelected={
                selectedComponentId === component.id ||
                multiSelectedIds.includes(component.id) ||
                isAnswerSelected
              }


                isMultiSelected={multiSelectedIds.includes(component.id)}
                onComponentClick={onComponentClick}
                onComponentHover={onComponentHover}
                selectedComponentId={selectedComponentId}
                editingComponentId={editingComponentId ?? undefined}
                onPositionChange={onComponentPositionChange}
                containerRef={containerRef}
                onTextChange={onTextChange}
                onStartEditing={setEditingComponentId}
                onImageEdit={onImageEdit}
                onUpdateProps={onUpdateProps}
                onUpdateData={onUpdateData}
                onDeleteComponent={onDeleteComponent}
                onOpenImagePicker={onOpenImagePicker}
                onUpdateAction={onUpdateAction}
                pageType={pageType}
                onUnmerge={
                  component.type === "group" && onUnmergeGroup
                    ? () => onUnmergeGroup(component.id)
                    : undefined
                }
                onClearMultiSelect={
                  multiSelectedIds.length > 0
                    ? () => onMultiSelect?.([])
                    : undefined
                }
                onComponentAction={onComponentAction}
                currentPageNumber={currentPageNumber}
                totalPages={totalPages}
              />
            );
          })
          : (emptyStateContent ?? defaultEmptyState)}

        {/* Marquee Selection Rectangle */}
        {isMarqueeActive && marqueeRect && (
          <div
            className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/10"
            style={{
              left: marqueeRect.left,
              top: marqueeRect.top,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
          />
        )}
      </div>

      {/* Multi-selection Bounding Box and Toolbar */}
      {multiSelectionBounds && onMergeComponents && (
        <Popover open={true} modal={false}>
          <PopoverAnchor asChild>
            <div
              className="pointer-events-none absolute z-40 border-2 border-dashed border-blue-500 bg-blue-500/5"
              style={{
                left: `${multiSelectionBounds.left}%`,
                top: `${multiSelectionBounds.top}%`,
                width: `${multiSelectionBounds.width}%`,
                height: `${multiSelectionBounds.height}%`,
              }}
            />
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            className="w-auto border-none bg-transparent p-0 shadow-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-lg">
                <span className="text-sm text-gray-600">
                  {multiSelectedIds.length} selected
                </span>
                <button
                  onClick={() => onMergeComponents(multiSelectedIds)}
                  className="rounded bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600"
                >
                  Merge
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  // Frameless mode: render content directly without phone frame wrapper
  if (frameless) {
    return (
      <div ref={previewWrapperRef} className={`h-full w-full ${className}`}>
        {screenContent}
      </div>
    );
  }

  // Normal mode: render with phone frame
  return (
    <div
      ref={previewWrapperRef}
      className={`flex flex-col items-center justify-center ${className}`}
    >
      {/* Layout box sized to scaled dimensions to prevent stretching */}
      <div
        className="relative overflow-visible"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Scaled content wrapper */}
        <div
          className="relative"
          style={{
            transform: `scale(${effectiveScale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Phone Frame */}
          <div
            className={`h-[844px] w-[390px] bg-black p-[6px] shadow-2xl ${roundedCorners ? "rounded-[2.5rem]" : ""}`}
          >
            {screenContent}
          </div>
        </div>
      </div>
    </div>
  );
}
