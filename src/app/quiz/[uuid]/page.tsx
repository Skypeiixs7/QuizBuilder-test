"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PencilIcon, ArrowLeft, Loader2, FileText, ListChecks, MousePointerClick } from "lucide-react";
import ConvexUserButton from "@/components/auth/convex-user-button";
import QuizPagesTab from "./QuizPagesTab";
import ResultPagesTab from "./ResultPagesTab";
import OnboardingTab from "./components/OnboardingTab";
import ResultMappingTab from "./ResultMappingTab";
import type { Id } from "@/types";

export default function QuizEditorPage() {
  const params = useParams();
  const uuid = params?.uuid as string;
  const router = useRouter();

  const [quizId, setQuizId] = useState<Id<"quiz"> | null>(null);
  const [quizTitle, setQuizTitle] = useState("Untitled Quiz");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("onboarding");
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const lastSavedTitleRef = useRef<string>("Untitled Quiz");

  const quizQuery = useQuery(
    api.quiz.getQuiz,
    uuid && uuid !== "new" ? { id: uuid as Id<"quiz"> } : "skip",
  );
  const createQuizMutation = useMutation(api.quiz.createQuiz);
  const updateQuizMutation = useMutation(api.quiz.updateQuiz);

  // Guard to ensure we only create once on the /quiz/new route (avoid StrictMode double effects)
  const hasCreatedRef = useRef(false);

  useEffect(() => {
    if (uuid === "new") {
      setIsLoading(false);
      return;
    }

    if (!quizQuery) {
      return;
    }

    try {
      setQuizId(quizQuery._id);
      const resolvedTitle = quizQuery.title?.trim() || "Untitled Quiz";
      lastSavedTitleRef.current = resolvedTitle;
      setQuizTitle(resolvedTitle);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading quiz:", error);
      toast.error("Failed to load quiz");
      router.push("/quiz");
    }
  }, [uuid, quizQuery, router]);

  const handleTitleCommit = useCallback(async () => {
    const trimmed = quizTitle.trim();
    const normalized = trimmed.length === 0 ? "Untitled Quiz" : trimmed;

    if (quizTitle !== normalized) {
      setQuizTitle(normalized);
    }

    if (!quizId) {
      return;
    }

    if (normalized === lastSavedTitleRef.current) {
      return;
    }

    setIsSavingTitle(true);
    try {
      await updateQuizMutation({
        id: quizId,
        title: normalized,
      });
      lastSavedTitleRef.current = normalized;
    } catch (error) {
      console.error("Failed to update quiz title:", error);
      toast.error("Failed to update quiz title");
      setQuizTitle(lastSavedTitleRef.current);
    } finally {
      setIsSavingTitle(false);
    }
  }, [quizId, quizTitle, updateQuizMutation]);

  // Create a new quiz exactly once when navigating to /quiz/new
  useEffect(() => {
    if (uuid !== "new") return;
    if (hasCreatedRef.current) return;
    // Avoid duplicate creation in StrictMode/dev
    hasCreatedRef.current = true;

    const doCreate = async () => {
      try {
        const result = await createQuizMutation({
          title: quizTitle.trim() || "Untitled Quiz",
        });
        if (result) {
          setQuizId(result);
          router.replace(`/quiz/${result}`);
        }
      } catch (error) {
        console.error("Error creating quiz:", error);
        toast.error("Failed to create quiz");
        // Allow retry on subsequent mounts if needed
        hasCreatedRef.current = false;
      }
    };

    void doCreate();
  }, [uuid, quizTitle, createQuizMutation, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
          <p className="text-gray-500">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-100">
      {/* Top Toolbar */}
      <div className="relative flex flex-row border-b bg-white px-4 py-2">
        {/* Left side controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push("/quiz")}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Center content */}
        <div className="absolute left-1/2 -translate-x-1/2 transform">
          <div className="flex flex-col items-center gap-2">
            {/* Quiz Title with Edit Icon */}
            <div className="group flex items-center gap-2">
              {isEditingTitle ? (
                <Input
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    void handleTitleCommit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setIsEditingTitle(false);
                      void handleTitleCommit();
                    } else if (e.key === "Escape") {
                      setQuizTitle(lastSavedTitleRef.current);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="max-w-xs text-center"
                  autoFocus
                  disabled={isSavingTitle}
                />
              ) : (
                <div
                  onClick={() => setIsEditingTitle(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1 transition-colors hover:border-blue-500"
                >
                  <span className="font-medium">
                    {quizTitle || "Quiz Editor"}
                  </span>
                  <PencilIcon className="h-3 w-3 text-gray-400" />
                </div>
              )}
              {isSavingTitle && (
                <span className="text-xs text-gray-500">Saving...</span>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 transform">
          <div className="flex items-center gap-3">
            <ConvexUserButton />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-4">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 min-h-0 flex-col overflow-hidden"
          >
            <div className="mb-4">
              <TabsList>
                <TabsTrigger
                  value="onboarding"
                  className="flex items-center gap-2"
                >
                  <ListChecks className="h-4 w-4" />
                  Onboarding
                </TabsTrigger>
                <TabsTrigger value="pages" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Quiz Pages
                </TabsTrigger>
                <TabsTrigger
                  value="result-pages"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Result Pages
                </TabsTrigger>
                <TabsTrigger
                  value="result-mapping"
                  className="flex items-center gap-2"
                >
                  <MousePointerClick className="h-4 w-4" />
                  Result Mapping
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="onboarding"
              className="mt-0 flex-1 overflow-hidden min-h-0"
            >
              <OnboardingTab quizId={quizId} />
            </TabsContent>

            <TabsContent
              value="pages"
              className="mt-0 flex-1 overflow-hidden min-h-0"
            >
              <QuizPagesTab
                quizId={quizId}
                activePageIndex={activePageIndex}
                onActivePageChange={(index) => setActivePageIndex(index)}
              />
            </TabsContent>

            <TabsContent
              value="result-pages"
              className="mt-0 flex-1 overflow-hidden min-h-0"
            >
              <ResultPagesTab
                quizId={quizId}
                activeResultIndex={activeResultIndex}
                onActiveResultIndexChange={(index) =>
                  setActiveResultIndex(index)
                }
              />
            </TabsContent>

            <TabsContent
              value="result-mapping"
              className="mt-0 flex-1 overflow-hidden min-h-0"
            >
              <ResultMappingTab quizId={quizId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
