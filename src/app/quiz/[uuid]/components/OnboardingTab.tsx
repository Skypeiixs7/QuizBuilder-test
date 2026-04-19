"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X } from "lucide-react";
import EditorPreviewPanel from "./EditorPreviewPanel";
import ImagePickerDialog from "@/components/quiz/ImagePickerDialog";
import { api } from "../../../../../convex/_generated/api";
import { usePageEditor } from "@/hooks/usePageEditor";
import { useTemplates } from "@/hooks/useTemplates";
import type {
  Component,
  PageEntity,
  ResultEntity,
} from "@/types";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface OnboardingTabProps {
  quizId: Id<"quiz"> | null;
}

export default function OnboardingTab({ quizId }: OnboardingTabProps) {
  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const createResult = useMutation(api.quiz.createResult);
  const updateResult = useMutation(api.quiz.updateResult);
  const deleteResult = useMutation(api.quiz.deleteResult);
  const updateOnboardingPage = useMutation(api.quiz.updateOnboardingPage);
  const setOnboardingComponents = useMutation(api.quiz.setOnboardingComponents);
  const createOnboardingPage = useMutation(api.quiz.createOnboardingPage);

  const [isCreatingResult, setIsCreatingResult] = useState(false);
  const [isCreatingOnboarding, setIsCreatingOnboarding] = useState(false);

  const onboardingPage = quizQuery?.onboardingPage as
    | PageEntity
    | null
    | undefined;

  const editor = usePageEditor({
    quizId,
    pageType: "onboarding",
    entity: onboardingPage,
    setComponentsMutation: setOnboardingComponents,
    updateEntityMutation: updateOnboardingPage,
    enableClipboard: true,
    enableZIndex: true,
    enableUndoRedo: false,
  });

  const templates = useTemplates("onboarding");

  const results = useMemo(
    () => ((quizQuery?.results ?? []) as ResultEntity[]) ?? [],
    [quizQuery?.results],
  );

  const handleCreateOnboarding = useCallback(async () => {
    if (!quizId || isCreatingOnboarding) return;
    setIsCreatingOnboarding(true);
    try {
      await createOnboardingPage({ quizId });
      toast.success("Onboarding page created");
    } catch (error) {
      console.error("Failed to create onboarding page:", error);
      toast.error("Failed to create onboarding page");
    } finally {
      setIsCreatingOnboarding(false);
    }
  }, [quizId, createOnboardingPage, isCreatingOnboarding]);

  const handleCreateResult = useCallback(async () => {
    if (!quizId || isCreatingResult) return;

    setIsCreatingResult(true);
    const defaultName = `Result ${results.length + 1}`;
    try {
      await createResult({
        quizId,
        pageName: defaultName,
      });
      toast.success("Result created");
    } catch (error) {
      console.error("Failed to create result", error);
      toast.error("Failed to create result");
    } finally {
      setIsCreatingResult(false);
    }
  }, [createResult, isCreatingResult, quizId, results.length]);

  const handleRenameResult = useCallback(
    async (id: Id<"results">, name: string) => {
      try {
        await updateResult({
          id,
          pageName: name,
        });
        toast.success("Result updated");
      } catch (error) {
        console.error("Failed to update result", error);
        toast.error("Failed to update result");
      }
    },
    [updateResult],
  );

  const handleDeleteResult = useCallback(
    async (id: Id<"results">) => {
      try {
        await deleteResult({ id });
        toast.success("Result deleted");
      } catch (error) {
        console.error("Failed to delete result", error);
        toast.error("Failed to delete result");
      }
    },
    [deleteResult],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white">
        <p className="max-w-sm text-center text-sm text-gray-600">
          Save the quiz before configuring onboarding.
        </p>
      </div>
    );
  }

  if (quizQuery === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading onboarding...
        </div>
      </div>
    );
  }

  if (quizQuery === null) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50">
        <p className="text-sm text-red-600">
          Unable to load quiz details. Please try again later.
        </p>
      </div>
    );
  }

  // If no onboarding page exists, show create button instead of EditorPreviewPanel
  if (!onboardingPage) {
    return (
      <div className="flex h-full min-h-0 gap-4">
        <ResultsSidebar
          results={results}
          onCreateResult={handleCreateResult}
          onRenameResult={handleRenameResult}
          onDeleteResult={handleDeleteResult}
          isCreating={isCreatingResult}
        />

        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-gray-500">
              No onboarding page exists yet.
            </div>
            <Button
              onClick={() => void handleCreateOnboarding()}
              disabled={isCreatingOnboarding}
              className="gap-2"
            >
              {isCreatingOnboarding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Onboarding Page
                </>
              )}
            </Button>
          </div>
        </div>

        <ImagePickerDialog
          isOpen={editor.isImagePickerOpen}
          onClose={() => editor.setIsImagePickerOpen(false)}
          images={editor.imagesQuery ?? []}
          onImageSelect={editor.handleImageSelect}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      <ResultsSidebar
        results={results}
        onCreateResult={handleCreateResult}
        onRenameResult={handleRenameResult}
        onDeleteResult={handleDeleteResult}
        isCreating={isCreatingResult}
      />

      <EditorPreviewPanel
        title="Onboarding Preview"
        hasEntity={true}
        components={editor.displayComponents}
        background={editor.currentBackground}
        pageName={editor.currentPageName}
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
        templateDialogTitle="Select an Onboarding Template"
        templateDialogDescription="Choose a template to apply to the onboarding page. This will replace the current content."
        onUpdateBackground={editor.handleUpdateBackground}
        pageType="onboarding"
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

// ============================================
// Sub-components for onboarding results sidebar
// ============================================

type ResultsSidebarProps = {
  results: ResultEntity[];
  onCreateResult: () => void;
  onRenameResult: (id: Id<"results">, name: string) => Promise<void>;
  onDeleteResult: (id: Id<"results">) => Promise<void>;
  isCreating: boolean;
};

function ResultsSidebar({
  results,
  onCreateResult,
  onRenameResult,
  onDeleteResult,
  isCreating,
}: ResultsSidebarProps) {
  return (
    <Card className="flex w-72 min-w-[18rem] flex-col">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Result Outcomes
          </CardTitle>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => onCreateResult()}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto py-4">
        {results.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white/60 px-4 py-8 text-center">
            <h3 className="text-sm font-medium text-gray-900">
              No results yet
            </h3>
          </div>
        ) : (
          results.map((result, index) => (
            <ResultListItem
              key={result._id}
              index={index}
              result={result}
              onRename={onRenameResult}
              onDelete={onDeleteResult}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

type ResultListItemProps = {
  result: ResultEntity;
  index: number;
  onRename: (id: Id<"results">, name: string) => Promise<void>;
  onDelete: (id: Id<"results">) => Promise<void>;
};

function ResultListItem({
  result,
  index,
  onRename,
  onDelete,
}: ResultListItemProps) {
  const [name, setName] = useState(result.pageName ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setName(result.pageName ?? "");
  }, [result._id, result.pageName]);

  const commitName = useCallback(async () => {
    const trimmed = name.trim();
    const current = (result.pageName ?? "").trim();
    if (trimmed === current) return;

    setIsSaving(true);
    try {
      await onRename(result._id, trimmed);
    } finally {
      setIsSaving(false);
    }
  }, [name, onRename, result._id, result.pageName]);

  const handleDelete = useCallback(async () => {
    if (isDeleting) return;
    if (!window.confirm("Delete this result? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(result._id);
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, onDelete, result._id]);

  const label = name.trim().length > 0 ? name.trim() : `Result ${index + 1}`;

  return (
    <div className="relative text-sm">
      <Input
        value={name}
        placeholder={label}
        aria-label="Result name"
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void commitName()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commitName();
          }
          if (event.key === "Escape") {
            setName(result.pageName ?? "");
          }
        }}
        disabled={isSaving || isDeleting}
        className="h-9 pr-8 text-sm"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        className="absolute right-0 top-0 h-6 w-6 text-gray-400 hover:text-red-600"
        aria-label="Delete result"
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
