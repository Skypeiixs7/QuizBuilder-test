"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Component,
  Id,
  PageAction,
  PageEntity,
  ResultEntity,
} from "@/types";
import PhonePreview from "@/components/editor/PhonePreview";

type ResultMappingTabProps = {
  quizId: Id<"quiz"> | null;
};

const ACTION_OPTIONS: { value: PageAction | "none"; label: string }[] = [
  { value: "none", label: "No Action" },
  { value: "nextPage", label: "Next Page" },
  { value: "previousPage", label: "Previous Page" },
  { value: "startQuiz", label: "Start Quiz" },
  { value: "hyperlink", label: "Hyperlink" },
  { value: "answerBox", label: "Answer Box" },
];

export default function ResultMappingTab({ quizId }: ResultMappingTabProps) {
  const quizQuery = useQuery(
    api.quiz.getQuiz,
    quizId ? { id: quizId } : "skip",
  );

  const updateComponentAction = useMutation(api.quiz.updateComponentAction);

  const pages = useMemo(
    () => (quizQuery?.pages ?? []) as PageEntity[],
    [quizQuery?.pages],
  );
  const results = useMemo(
    () => (quizQuery?.results ?? []) as ResultEntity[],
    [quizQuery?.results],
  );

  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const setComponentSaving = useCallback((id: string, value: boolean) => {
    setSaving((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleActionChange = useCallback(
    async (component: Component, value: string) => {
      const action = value === "none" ? undefined : (value as PageAction);
      setComponentSaving(component.id, true);
      try {
        // Preserve existing props when switching to answerBox
        const actionProps =
          action === "answerBox"
            ? {
                resultMapping:
                  (component.actionProps?.resultMapping as Record<
                    string,
                    number
                  >) ?? {},
              }
            : action === "hyperlink"
              ? { url: (component.actionProps?.url as string) ?? "" }
              : undefined;

        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action,
          actionProps,
        });
        toast.success("Action updated");
      } catch (error) {
        console.error("Failed to update action", error);
        toast.error("Failed to update action");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleHyperlinkChange = useCallback(
    async (component: Component, url: string) => {
      const trimmed = url.trim();
      setComponentSaving(component.id, true);
      try {
        if (!trimmed) {
          await updateComponentAction({
            componentId: component.id as Id<"components">,
            action: undefined,
            actionProps: undefined,
          });
        } else {
          await updateComponentAction({
            componentId: component.id as Id<"components">,
            action: "hyperlink",
            actionProps: { url: trimmed },
          });
        }
        toast.success("Link updated");
      } catch (error) {
        console.error("Failed to update hyperlink", error);
        toast.error("Failed to update hyperlink");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  const handleResultWeightChange = useCallback(
    async (component: Component, resultId: string, value: string) => {
      const numeric = Number(value);
      const weight = Number.isFinite(numeric) ? numeric : 0;

      setComponentSaving(component.id, true);
      try {
        console.log("[result-mapping] update-weight", {
          componentId: component.id,
          resultId,
          weight,
          currentActionProps: component.actionProps,
        });
        await updateComponentAction({
          componentId: component.id as Id<"components">,
          action: "answerBox",
          actionProps: { resultMapping: { [resultId]: weight } },
        });
        toast.success("Result mapping updated");
      } catch (error) {
        console.error("Failed to update result weights", error);
        toast.error("Failed to update result weights");
      } finally {
        setComponentSaving(component.id, false);
      }
    },
    [setComponentSaving, updateComponentAction],
  );

  if (!quizId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Save the quiz first to manage mappings.
      </div>
    );
  }

  if (quizQuery === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Loading mappings...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      {pages.map((page) => {
        const buttons =
          (page.components ?? []).filter(
            (c) => (c.props as Record<string, unknown>)?.isButton,
          ) ?? [];

        return (
          <div key={page._id} className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-start gap-4 p-4">
              <div className="flex-shrink-0">
                <PhonePreview
                  components={page.components ?? []}
                  background={page.background}
                  isEditable={false}
                  scale={0.35}
                  pageType="quiz"
                  className="border"
                />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {page.pageName?.trim() || "Untitled Page"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {buttons.length} button
                      {buttons.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {buttons.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    No buttons on this page. Toggle components as buttons in the
                    editor to map actions.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {buttons.map((button) => {
                      const currentAction =
                        (button.action as PageAction | undefined) ?? "none";
                      const hyperlinkUrl =
                        (button.actionProps?.url as string | undefined) ?? "";
                      const resultMapping =
                        (button.actionProps?.resultMapping as Record<
                          string,
                          number
                        >) ?? {};
                      const isSaving = saving[button.id] ?? false;

                      // Ensure previewable position
                      const previewComponent: Component = {
                        ...button,
                        position: button.position ?? {
                          x: 0,
                          y: 10,
                          width: 80,
                          height: 12,
                        },
                      };

                      return (
                        <div
                          key={button.id}
                          className="rounded-md border px-3 py-2"
                        >
                          <div className="mb-3">
                            <div className="mb-1 text-xs font-medium text-gray-600">
                              Button preview
                            </div>
                            <div className="rounded border bg-white p-2">
                              <div className="h-32 w-full max-w-[220px]">
                                <PhonePreview
                                  components={[previewComponent]}
                                  background={{ color: "#ffffff" }}
                                  isEditable={false}
                                  scale={0.45}
                                  frameless
                                  pageType="quiz"
                                  className="h-full w-full"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                Action
                              </span>
                              <Select
                                value={currentAction}
                                onValueChange={(val) =>
                                  void handleActionChange(button, val)
                                }
                                disabled={isSaving}
                              >
                                <SelectTrigger className="h-8 w-44">
                                  <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ACTION_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {currentAction === "hyperlink" && (
                            <div className="mt-3 space-y-1.5">
                              <Label className="text-xs">URL</Label>
                              <Input
                                value={hyperlinkUrl}
                                placeholder="https://example.com"
                                onChange={(e) =>
                                  void handleHyperlinkChange(
                                    button,
                                    e.target.value,
                                  )
                                }
                                disabled={isSaving}
                                className="h-8"
                              />
                            </div>
                          )}

                          {currentAction === "answerBox" && (
                            <div className="mt-3 space-y-2">
                              {results.length === 0 ? (
                                <div className="rounded-md border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                  No result pages available. Create result pages
                                  before configuring answer box scores.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Result scores
                                  </Label>
                                  <div className="space-y-2">
                                    {results.map((result, index) => {
                                      const resultId = result._id as string;
                                      const score = Number.isFinite(
                                        resultMapping[resultId],
                                      )
                                        ? resultMapping[resultId]
                                        : 0;

                                      return (
                                        <div
                                          key={result._id}
                                          className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                                        >
                                          <div className="text-sm text-gray-700">
                                            {result.pageName?.trim() ||
                                              `Result ${index + 1}`}
                                          </div>
                                          <Input
                                            type="number"
                                            inputMode="numeric"
                                            className="h-8 w-full sm:w-24"
                                            value={score}
                                            onChange={(e) =>
                                              void handleResultWeightChange(
                                                button,
                                                resultId,
                                                e.target.value,
                                              )
                                            }
                                            disabled={isSaving}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
