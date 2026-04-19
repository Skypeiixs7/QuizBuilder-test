"use client";

import { MousePointerClick, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Component, ComponentPosition, PageAction } from "@/types";
import { getManifestByType } from "@/lib/quizComponents";
import { useMemo } from "react";

export type EditorPageType = "quiz" | "result" | "onboarding";

interface ComponentToolbarProps {
  component: Component;
  onUpdateProps: (props: Record<string, unknown>) => void;
  onUpdateData: (data: string) => void;
  onUpdatePosition: (position: ComponentPosition) => void;
  onDelete: () => void;
  onOpenImagePicker?: () => void;
  onUpdateAction?: (action: PageAction | undefined, actionProps?: Record<string, unknown>) => void;
  pageType?: EditorPageType;
  onUnmerge?: () => void; // For group components
}

export default function ComponentToolbar({
  component,
  onUpdateProps,
  onUpdateData: _onUpdateData,
  onUpdatePosition: _onUpdatePosition,
  onDelete,
  onOpenImagePicker,
  onUpdateAction,
  pageType = "quiz",
  onUnmerge,
}: ComponentToolbarProps) {
  const manifest = getManifestByType(component.type);
  const isStartQuizActive = component.action === "startQuiz";
  const isButton = useMemo(
    () => Boolean(component.props?.isButton),
    [component.props?.isButton],
  );

  // Toggle button flag (action assignment now handled in Result Mapping tab)
  const handleToggleButton = () => {
    const nextValue = !isButton;
    onUpdateProps?.({ isButton: nextValue });
    if (!nextValue) {
      // Clear any existing action when turning off button mode
      onUpdateAction?.(undefined, undefined);
    }
  };

  // Onboarding page: toggle start quiz
  const handleToggleStartQuiz = () => {
    if (isStartQuizActive) {
      onUpdateAction?.(undefined, undefined);
    } else {
      onUpdateAction?.("startQuiz", undefined);
    }
  };

  if (!manifest) {
    // Fallback for unknown component types
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-lg">
        <span className="text-sm text-gray-500">Unknown component</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const ToolbarComponent = manifest.Toolbar;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-lg">
      <ToolbarComponent
        component={component}
        onUpdateProps={onUpdateProps}
        onOpenImagePicker={onOpenImagePicker}
        onUnmerge={onUnmerge}
        pageType={pageType}
      />

      {component.type !== "progressBar" && (
        <div className="h-6 w-px bg-gray-200" />
      )}

      {/* Button toggle */}
      {component.type !== "progressBar" && (
        <Button
          variant={isButton ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={handleToggleButton}
          title={isButton ? "Mark as regular element" : "Mark as button"}
        >
          <MousePointerClick className="h-4 w-4" />
          <span className="text-xs">Button</span>
        </Button>
      )}

      {component.type !== "progressBar" && (
        <div className="h-6 w-px bg-gray-200" />
      )}

      {/* Onboarding: Start Quiz Toggle */}
      {component.type !== "progressBar" && pageType === "onboarding" && (
        <Button
          variant={isStartQuizActive ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={handleToggleStartQuiz}
          title={isStartQuizActive ? "Remove Start Quiz action" : "Add Start Quiz action"}
        >
          <Play className="h-4 w-4" />
          <span className="text-xs">Start Quiz</span>
        </Button>
      )}

      <div className="h-6 w-px bg-gray-200" />

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-red-500 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
