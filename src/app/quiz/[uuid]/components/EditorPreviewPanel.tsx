"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import PhonePreview from "@/components/editor/PhonePreview";
import ComponentDock from "@/components/editor/ComponentDock";
import BackgroundPopover from "@/components/editor/BackgroundPopover";
import TemplatePickerDialog from "./TemplatePickerDialog";
import { api } from "../../../../../convex/_generated/api";
import type { Component, EditorActions, PageBackground, PageTemplate } from "@/types";
import type { EditorPageType } from "@/components/editor/ComponentToolbar";
import { toast } from "sonner";

type NavigationConfig = {
  activeIndex: number;
  totalCount: number;
  onNavigate: (index: number) => void;
};

type EditorPreviewPanelProps = {
  title: string;
  /** Pass page/result/onboarding entity — only used for truthiness checks */
  hasEntity: boolean;
  components: Component[];
  background?: PageBackground;

  // Navigation (optional — omitted for single-entity editors like onboarding)
  navigation?: NavigationConfig;

  // Page name
  pageName: string;
  pageNamePlaceholder?: string;
  onPageNameChange: (value: string) => void;
  onPageNameBlur?: () => void;

  // Selection & editing
  selectedComponentId: string | null;
  selectedComponent: Component | null;
  onComponentClick: (component: Component) => void;
  onBackgroundClick: () => void;
  editorActions: EditorActions;

  // Saving indicator
  isSaving?: boolean;

  // Templates
  templates: PageTemplate[];
  onApplyTemplate: (template: PageTemplate) => void;
  templateDialogTitle?: string;
  templateDialogDescription?: string;

  // Background
  onUpdateBackground?: (background: PageBackground) => void;

  // Delete
  onDelete?: () => void;
  isDeleting?: boolean;

  // Page type for PhonePreview
  pageType: EditorPageType;

  // Empty state
  emptyMessage?: string;

  questionMode?: "single" | "multiple";
  onQuestionModeChange?: (mode: "single" | "multiple") => void;
  isQuestionModeSaving?: boolean;
};

export default function EditorPreviewPanel({
  title,
  hasEntity,
  components,
  background,
  navigation,
  pageName,
  pageNamePlaceholder,
  onPageNameChange,
  onPageNameBlur,
  selectedComponentId,
  selectedComponent,
  onComponentClick,
  onBackgroundClick,
  editorActions,
  isSaving,
  templates,
  onApplyTemplate,
  templateDialogTitle = "Select a Template",
  templateDialogDescription = "Choose a template to apply. This will replace the current content.",
  onUpdateBackground,
  onDelete,
  isDeleting,
  pageType,
  emptyMessage = "Select an item to preview.",
  questionMode,
  onQuestionModeChange,
  isQuestionModeSaving = false,
}: EditorPreviewPanelProps) {
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSaveTemplateDialogOpen, setIsSaveTemplateDialogOpen] =
    useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const createTemplate = useMutation(api.templates.createTemplate);

  const handleTemplateSelect = useCallback(
    (template: PageTemplate) => {
      onApplyTemplate(template);
      setIsTemplateDialogOpen(false);
    },
    [onApplyTemplate],
  );

  useEffect(() => {
    if (!isSaveTemplateDialogOpen) return;
    const normalizedPageName = pageName.trim();
    const fallbackTitle = `${title} Template`;
    setTemplateTitle(normalizedPageName || fallbackTitle);
    setTemplateDescription("");
  }, [isSaveTemplateDialogOpen, pageName, title]);

  const handleSaveCurrentPageAsTemplate = useCallback(async () => {
    const normalizedTitle = templateTitle.trim();
    if (!normalizedTitle) {
      toast.error("Template title is required");
      return;
    }

    setIsSavingTemplate(true);
    try {
      await createTemplate({
        title: normalizedTitle,
        description: templateDescription.trim() || undefined,
        pageName: pageName.trim() || undefined,
        background,
        components,
        templateType: pageType,
      });
      toast.success("Template saved");
      setIsSaveTemplateDialogOpen(false);
    } catch (error) {
      console.error("Failed to save template", error);
      toast.error("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    background,
    components,
    createTemplate,
    pageName,
    pageType,
    templateDescription,
    templateTitle,
  ]);

  const canNavigatePrev = navigation ? navigation.activeIndex > 0 : false;
  const canNavigateNext = navigation
    ? navigation.activeIndex < Math.max(navigation.totalCount - 1, 0)
    : false;

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!navigation || navigation.totalCount <= 0) return;
      if (direction === "prev") {
        if (!canNavigatePrev) return;
        navigation.onNavigate(
          Math.max(navigation.activeIndex - 1, 0),
        );
      } else {
        if (!canNavigateNext) return;
        navigation.onNavigate(
          Math.min(navigation.activeIndex + 1, navigation.totalCount - 1),
        );
      }
    },
    [navigation, canNavigatePrev, canNavigateNext],
  );

  const {
    onComponentPositionChange,
    onTextChange,
    onUpdateProps,
    onUpdateData,
    onUpdateAction,
    onDeleteComponent,
    onDropComponent,
    onOpenImagePicker,
    onCopy,
    onCut,
    onPaste,
    onDuplicate,
    onUndo,
    onRedo,
    onBringForward,
    onSendBackward,
    onBringToFront,
    onSendToBack,
    canUndo,
    canRedo,
    canPaste,
    canBringForward,
    canSendBackward,
    multiSelectedIds = [],
    onMultiSelect,
    onMergeComponents,
    onUnmergeGroup,
  } = editorActions;

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <CardHeader className="border-b bg-gray-50 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {pageType === "quiz" && questionMode && onQuestionModeChange && (
            <select
              value={questionMode}
              onChange={(e) =>
                onQuestionModeChange(
                  e.target.value as
                    | "single"
                    | "multiple"
                )
              }
              disabled={isQuestionModeSaving}
              className="border px-2 py-1 text-sm rounded"
            >
              <option value="single">
                Single choice
              </option>
              <option value="multiple">
                Multiple choice
              </option>
            </select>
          )} 
          {/* Keep the multiple-choice buttons only on the quiz page. */}

          <CardTitle className="text-sm font-semibold text-gray-700">
            {title}
          </CardTitle>
          <div className="flex flex-1 items-center gap-2">
            {navigation && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleNavigate("prev")}
                disabled={!canNavigatePrev}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
            )}
            <div className="flex flex-1 justify-center">
              {hasEntity && (
                <Input
                  value={pageName}
                  onChange={(event) => onPageNameChange(event.target.value)}
                  onBlur={onPageNameBlur}
                  placeholder={pageNamePlaceholder}
                  className="h-8 w-64 text-center text-sm"
                />
              )}
            </div>
            {navigation && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleNavigate("next")}
                disabled={!canNavigateNext}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          {hasEntity && (
            <div className="ml-auto flex items-center gap-2">
              {isSaving && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
              <BackgroundPopover
                background={background}
                onBackgroundChange={(bg) => onUpdateBackground?.(bg)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTemplateDialogOpen(true)}
                className="gap-1"
              >
                <LayoutTemplate className="h-4 w-4" />
                Use Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveTemplateDialogOpen(true)}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                Save Template
              </Button>
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent
        className="relative flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto bg-gray-50 p-4"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          const isBackgroundClickEvent =
            target === e.currentTarget ||
            target.dataset.backgroundArea === "true" ||
            target.closest("[data-background-area]") === target;
          if (isBackgroundClickEvent) {
            onBackgroundClick?.();
          }
        }}
      >
        {hasEntity ? (
          <>
            <ComponentDock pageType={pageType} />
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className="flex min-w-fit flex-1 items-center justify-center py-8"
                  data-background-area="true"
                >
                  <PhonePreview
                    components={components}
                    background={background}
                    scale={0.6}
                    selectedComponentId={selectedComponentId ?? undefined}
                    selectedComponent={selectedComponent}
                    onComponentClick={onComponentClick}
                    onBackgroundClick={onBackgroundClick}
                    isEditable
                    onComponentPositionChange={onComponentPositionChange}
                    onTextChange={onTextChange}
                    onDropComponent={onDropComponent}
                    onUpdateProps={onUpdateProps}
                    onUpdateData={onUpdateData}
                    onDeleteComponent={onDeleteComponent}
                    onOpenImagePicker={onOpenImagePicker}
                    multiSelectedIds={multiSelectedIds}
                    onMultiSelect={onMultiSelect}
                    onMergeComponents={onMergeComponents}
                    onUnmergeGroup={onUnmergeGroup}
                    onUpdateAction={onUpdateAction}
                    pageType={pageType}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                {onUndo !== undefined && (
                  <>
                    <ContextMenuItem onClick={onUndo} disabled={!canUndo}>
                      Undo
                      <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={onRedo} disabled={!canRedo}>
                      Redo
                      <ContextMenuShortcut>⌘⇧Z</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem
                  onClick={onCopy}
                  disabled={!selectedComponent}
                >
                  Copy
                  <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onCut}
                  disabled={!selectedComponent}
                >
                  Cut
                  <ContextMenuShortcut>⌘X</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={onPaste} disabled={!canPaste}>
                  Paste
                  <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onDuplicate}
                  disabled={!selectedComponent}
                >
                  Duplicate
                  <ContextMenuShortcut>⌘D</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onBringToFront}
                  disabled={!selectedComponent || !canBringForward}
                >
                  Bring to Front
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onBringForward}
                  disabled={!selectedComponent || !canBringForward}
                >
                  Bring Forward
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onSendBackward}
                  disabled={!selectedComponent || !canSendBackward}
                >
                  Send Backward
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={onSendToBack}
                  disabled={!selectedComponent || !canSendBackward}
                >
                  Send to Back
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={onDeleteComponent}
                  disabled={!selectedComponent}
                  className="text-red-600 focus:text-red-600"
                >
                  Delete
                  <ContextMenuShortcut>⌫</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            {emptyMessage}
          </div>
        )}
      </CardContent>

      <TemplatePickerDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates}
        title={templateDialogTitle}
        description={templateDialogDescription}
        onSelect={handleTemplateSelect}
      />

      <Dialog
        open={isSaveTemplateDialogOpen}
        onOpenChange={(open) => {
          if (!isSavingTemplate) {
            setIsSaveTemplateDialogOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Page as Template</DialogTitle>
            <DialogDescription>
              Save the current page layout, background, and components as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-title">Template Title</Label>
              <Input
                id="template-title"
                value={templateTitle}
                onChange={(event) => setTemplateTitle(event.target.value)}
                placeholder="Template title"
                disabled={isSavingTemplate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder="Optional description"
                rows={3}
                disabled={isSavingTemplate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveTemplateDialogOpen(false)}
              disabled={isSavingTemplate}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveCurrentPageAsTemplate()}
              disabled={isSavingTemplate}
              className="gap-2"
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
