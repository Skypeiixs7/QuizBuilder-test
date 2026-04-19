"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import PagesPanel from "./components/PagesPanel";
import EditorPreviewPanel from "./components/EditorPreviewPanel";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import { usePageEditor } from "@/hooks/usePageEditor";
import { useTemplates } from "@/hooks/useTemplates";
import type { Component, Id, PageEntity } from "@/types";

type QuizPagesTabProps = {
  quizId: Id<"quiz"> | null;
  activePageIndex?: number;
  onActivePageChange?: (index: number) => void;
};

export default function QuizPagesTab({
  quizId,
  activePageIndex,
  onActivePageChange,
}: QuizPagesTabProps) {
  const updatePage = useMutation(api.quiz.updatePage);
  const setPageComponents = useMutation(api.quiz.setPageComponents);
  const deletePage = useMutation(api.quiz.deletePage);
  const reorderPages = useMutation(api.quiz.reorderPages);

  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const pages = useMemo<PageEntity[]>(
    () => (quizQuery?.pages ?? []) as PageEntity[],
    [quizQuery?.pages],
  );
  const isLoading = quizQuery === undefined;

  const [internalIndex, setInternalIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localQuestionMode, setLocalQuestionMode] = useState<
    "single" | "multiple" | null
  >(null);
  const [isSavingQuestionMode, setIsSavingQuestionMode] = useState(false);

  const isControlled =
    typeof activePageIndex === "number" &&
    typeof onActivePageChange === "function";
  const currentIndex = isControlled ? (activePageIndex ?? 0) : internalIndex;

  const previousIndexRef = useRef(currentIndex);

  const setIndex = useCallback(
    (nextIndex: number) => {
      const clampedIndex = Math.max(0, nextIndex);
      if (isControlled) {
        if (activePageIndex !== clampedIndex) {
          onActivePageChange?.(clampedIndex);
        }
      } else {
        setInternalIndex(clampedIndex);
      }
    },
    [activePageIndex, isControlled, onActivePageChange],
  );

  useEffect(() => {
    if (pages.length === 0) {
      setIndex(0);
      return;
    }
    if (currentIndex > pages.length - 1) {
      setIndex(pages.length - 1);
    }
  }, [pages, currentIndex, setIndex]);

  const currentPage = pages[currentIndex];
  const questionMode =
    localQuestionMode ?? currentPage?.questionMode ?? "single";

  const editor = usePageEditor({
    quizId,
    pageType: "page",
    entity: currentPage,
    setComponentsMutation: setPageComponents,
    updateEntityMutation: updatePage,
    enableClipboard: true,
    enableZIndex: true,
    enableUndoRedo: true,
  });

  // Reset selection when page changes
  const { editing: editingHook, setLocalPageName, setMultiSelectedIds } = editor;
  useEffect(() => {
    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = currentIndex;
    if (previousIndex !== currentIndex) {
      editingHook.selectComponent(null);
      setLocalPageName(null);
      setMultiSelectedIds([]);
    }
  }, [currentIndex, editingHook, setLocalPageName, setMultiSelectedIds]);

  useEffect(() => {
    setLocalQuestionMode(currentPage?.questionMode ?? "single");
  }, [currentPage?._id, currentPage?.questionMode]);

  const templates = useTemplates("quiz");

  const handleDeletePage = useCallback(async () => {
    if (!currentPage) return;
    if (!window.confirm(`Delete "${currentPage.pageName ?? "this page"}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deletePage({ id: currentPage._id });
      toast.success("Page deleted");
    } catch (error) {
      console.error("Failed to delete page", error);
      toast.error("Failed to delete page");
    } finally {
      setIsDeleting(false);
    }
  }, [deletePage, currentPage]);

  const handleQuestionModeChange = useCallback(
    async (mode: "single" | "multiple") => {
      if (!currentPage || isSavingQuestionMode) {
        console.log("[question-mode] skip-change", {
          hasCurrentPage: Boolean(currentPage),
          isSavingQuestionMode,
          requestedMode: mode,
        });
        return;
      }

      const previousMode = currentPage.questionMode ?? "single";
      console.log("[question-mode] change-request", {
        pageId: currentPage._id,
        pageName: currentPage.pageName ?? `Page ${currentIndex + 1}`,
        previousMode,
        requestedMode: mode,
      });

      if (mode === previousMode) {
        setLocalQuestionMode(mode);
        console.log("[question-mode] no-op", {
          pageId: currentPage._id,
          mode,
        });
        return;
      }

      setLocalQuestionMode(mode);
      setIsSavingQuestionMode(true);

      try {
        await updatePage({
          id: currentPage._id,
          questionMode: mode,
        });
        console.log("[question-mode] change-success", {
          pageId: currentPage._id,
          savedMode: mode,
        });
        toast.success("Question type updated");
      } catch (error) {
        console.error("Failed to update question type", error);
        console.log("[question-mode] change-failed", {
          pageId: currentPage._id,
          previousMode,
          requestedMode: mode,
        });
        setLocalQuestionMode(previousMode);
        toast.error("Failed to update question type");
      } finally {
        setIsSavingQuestionMode(false);
      }
    },
    [currentIndex, currentPage, isSavingQuestionMode, updatePage],
  );

  const handleReorderPages = useCallback(
    async (fromIndex: number, insertionIndex: number) => {
      if (!quizId) return;

      const normalizedToIndex =
        fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;

      if (
        fromIndex === normalizedToIndex ||
        fromIndex < 0 ||
        insertionIndex < 0 ||
        fromIndex >= pages.length ||
        insertionIndex > pages.length
      ) {
        return;
      }

      const nextPages = [...pages];
      const [movedPage] = nextPages.splice(fromIndex, 1);
      if (!movedPage) return;
      nextPages.splice(normalizedToIndex, 0, movedPage);

      const currentPageId = currentPage?._id;

      try {
        await reorderPages({
          quizId,
          pageIds: nextPages.map((page) => page._id),
        });

        if (currentPageId) {
          const nextIndex = nextPages.findIndex((page) => page._id === currentPageId);
          if (nextIndex !== -1) {
            setIndex(nextIndex);
          }
        }
      } catch (error) {
        console.error("Failed to reorder pages", error);
        toast.error("Failed to reorder pages");
      }
    },
    [currentPage?._id, pages, quizId, reorderPages, setIndex],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Save the quiz first to manage pages.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pages...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-2">
      <PagesPanel
        quizId={quizId}
        pages={pages}
        activeIndex={currentIndex}
        onSelectPage={(index) => setIndex(index)}
        onReorderPages={(fromIndex, toIndex) =>
          void handleReorderPages(fromIndex, toIndex)}
      />

      <EditorPreviewPanel
        title="Preview"
        hasEntity={!!currentPage}
        components={editor.displayComponents}
        background={editor.currentBackground}
        navigation={{
          activeIndex: currentIndex,
          totalCount: pages.length,
          onNavigate: (index) => setIndex(index),
        }}
        pageName={editor.currentPageName}
        pageNamePlaceholder={`Page ${currentIndex + 1}`}
        onPageNameChange={(value) => editor.setLocalPageName(value)}
        onPageNameBlur={editor.handlePageNameBlur}
        selectedComponentId={editor.editing.selectedId}
        selectedComponent={editor.editing.selectedComponent}
        onComponentClick={(component: Component) =>
          editor.editing.selectComponent(component.id)
        }
        onBackgroundClick={editor.handleDeselectComponent}
        editorActions={editor.editorActions}
        isSaving={editor.isSaving}
        templates={templates}
        onApplyTemplate={editor.handleApplyTemplate}
        templateDialogTitle="Select a Page Template"
        templateDialogDescription="Choose a template to apply to this page. This will replace the current content."
        onUpdateBackground={editor.handleUpdateBackground}
        onDelete={() => void handleDeletePage()}
        isDeleting={isDeleting}
        pageType="quiz"
        emptyMessage="Select a page to preview."
        questionMode={questionMode}
        onQuestionModeChange={(mode) => void handleQuestionModeChange(mode)}
        isQuestionModeSaving={isSavingQuestionMode}
      />

      <ImagePickerDialog
        isOpen={editor.isImagePickerOpen}
        onClose={() => editor.setIsImagePickerOpen(false)}
        images={editor.imagesQuery ?? []}
        onImageSelect={editor.handleImageSelect}
      />
    </div>
  );
}
