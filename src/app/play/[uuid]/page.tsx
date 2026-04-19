"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import PhonePreview from "@/components/editor/PhonePreview";
import { Button } from "@/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import type { Component, Id, PageAction, PageBackground } from "@/types";
import { toast } from "sonner";

type PlayPage = {
  _id: Id<"pages"> | string;
  components?: Component[];
  background?: PageBackground;
  pageName?: string;

  // new fields for quiz play
  questionMode?: "single" | "multiple";
};

const createClientSessionId = () =>
  `session_${crypto.randomUUID()}`;

const logQuizPlayDebug = (
  label: string,
  payload?: Record<string, unknown>,
) => {
  console.log(`[quiz-play] ${label}`, payload ?? {});
};

export default function PlayQuizPage() {
  const params = useParams();
  const uuid = params?.uuid as string | undefined;

  const [sessionId] = useState<string>(() => createClientSessionId());
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [resultPage, setResultPage] = useState<PlayPage | null>(null);
  const [selectedAnswers, setSelectedAnswers] =useState<Component[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isCalculatingResults, setIsCalculatingResults] = useState(false);

  const quizQuery = useQuery(
    api.quiz.getPublicQuiz,
    uuid ? { id: uuid as Id<"quiz"> } : "skip",
  );

  const startSession = useMutation(api.quizPlay.startQuizSession);
  const updateSession = useMutation(api.quizPlay.updateQuizSession);
  const setQuizPageResponses = useMutation(api.quizPlay.setQuizPageResponses);
  const calculateResults = useMutation(api.quizPlay.calculateQuizResults);

  const pages = useMemo<PlayPage[]>(
    () => ((quizQuery?.pages ?? []) as PlayPage[]),
    [quizQuery?.pages],
  );

  const results = useMemo<PlayPage[]>(
    () => ((quizQuery?.results ?? []) as PlayPage[]),
    [quizQuery?.results],
  );

  const onboardingPage = useMemo<PlayPage | null>(
    () => (quizQuery?.onboardingPage ? (quizQuery.onboardingPage as PlayPage) : null),
    [quizQuery?.onboardingPage],
  );

  const totalQuestions = pages.length;
  const currentQuestionPage = totalQuestions > 0 ? pages[currentPageIndex] : undefined;
  const questionMode =currentQuestionPage?.questionMode ?? "single";
  const shouldShowOnboarding = !quizStarted && Boolean(onboardingPage);
  const displayPage = shouldShowOnboarding && onboardingPage
    ? onboardingPage
    : quizCompleted && resultPage
      ? resultPage
      : currentQuestionPage;

  const displayComponents = useMemo(
    () => (displayPage?.components ?? []) as Component[],
    [displayPage?.components],
  );

  const isLoading = quizQuery === undefined;
  const quizNotFound = quizQuery === null;

  const pageDebugSummary = useMemo(
    () =>
      pages.map((page, index) => ({
        index,
        pageId: String(page._id),
        pageName: page.pageName ?? `Page ${index + 1}`,
        questionMode: page.questionMode ?? "single",
        componentCount: page.components?.length ?? 0,
      })),
    [pages],
  );

  const currentPageDebug = useMemo(
    () =>
      currentQuestionPage
        ? {
            index: currentPageIndex,
            pageId: String(currentQuestionPage._id),
            pageName: currentQuestionPage.pageName ?? `Page ${currentPageIndex + 1}`,
            questionMode,
            componentIds:
              currentQuestionPage.components?.map((component) => component.id) ?? [],
            answerBoxIds:
              currentQuestionPage.components
                ?.filter((component) => component.action === "answerBox")
                .map((component) => component.id) ?? [],
          }
        : null,
    [currentPageIndex, currentQuestionPage, questionMode],
  );

  const handleStartQuiz = useCallback(async () => {
    if (quizStarted) return;
    if (!quizQuery || !sessionId) return;

    try {
      logQuizPlayDebug("quiz-pages", {
        quizId: quizQuery._id,
        totalQuestions,
        pages: pageDebugSummary,
      });
      logQuizPlayDebug("start-session", {
        quizId: quizQuery._id,
        sessionId,
      });
      await startSession({
        quizId: quizQuery._id,
        sessionId,
      });
      setQuizStarted(true);
      setQuizCompleted(false);
      setResultPage(null);
      setCurrentPageIndex(0);
    } catch (error) {
      console.error("Error starting quiz", error);
    }
  }, [
    pageDebugSummary,
    quizQuery,
    quizStarted,
    sessionId,
    startSession,
    totalQuestions,
  ]);

  const handleGoToPage = useCallback(
    async (nextIndex: number) => {
      if (quizCompleted) return;
      if (pages.length === 0) return;
      const clamped = Math.max(0, Math.min(nextIndex, pages.length - 1));

      logQuizPlayDebug("navigate-page", {
        fromIndex: currentPageIndex,
        toIndex: clamped,
        nextPage:
          pages[clamped]
            ? {
                pageId: String(pages[clamped]!._id),
                pageName:
                  pages[clamped]!.pageName ?? `Page ${clamped + 1}`,
                questionMode: pages[clamped]!.questionMode ?? "single",
              }
            : null,
      });

      setCurrentPageIndex(clamped);
      setSelectedAnswers([]);

      if (!sessionId) return;
      try {
        await updateSession({
          sessionId,
          currentPageIndex: clamped,
        });
      } catch (error) {
        console.error("Failed to update quiz session", error);
      }
    },
    [currentPageIndex, pages, quizCompleted, sessionId, updateSession],
  );

  const handleFinishQuiz = useCallback(async () => {
    if (quizCompleted) return;
    if (!sessionId || !quizQuery) {
      setQuizCompleted(true);
      return;
    }

    try {
      await updateSession({
        sessionId,
        currentPageIndex,
        status: "completed",
      });
    } catch (error) {
      console.error("Failed to finalize session", error);
    }

    if (results.length > 0) {
      setIsCalculatingResults(true);
      try {
        const outcome = await calculateResults({
          sessionId,
          quizId: quizQuery._id,
        });
        if (outcome && outcome.winningResultPageId) {
          const matched = results.find(
            (page) => String(page._id) === String(outcome.winningResultPageId),
          );
          if (matched) {
            setResultPage(matched);
          }
        }
      } catch (error) {
        console.error("Failed to calculate quiz results", error);
      } finally {
        setIsCalculatingResults(false);
      }
    }

    setQuizCompleted(true);
  }, [
    calculateResults,
    currentPageIndex,
    quizCompleted,
    quizQuery,
    results,
    sessionId,
    updateSession,
  ]);

  const handleAnswerBoxAction = useCallback(
      async (
        actionProps?: Record<string, unknown>,
        component?: Component
      ) => {
        if (!quizQuery || !sessionId || quizCompleted) return;

        setIsProcessingAction(true);

        try {
          const resultMapping =
            (actionProps?.resultMapping ??
              {}) as Record<string, number>;

          const pageId =
            currentQuestionPage?._id?.toString() ??
            `page-${currentPageIndex}`;

          // ========================
          // SINGLE
          // ========================

          if (questionMode === "single") {
            logQuizPlayDebug("single-answer-submit", {
              sessionId,
              quizId: quizQuery._id,
              pageId,
              answerBoxId: component?.id ?? "unknown",
              resultMapping,
            });
            await setQuizPageResponses({
              sessionId,
              quizId: quizQuery._id,
              pageId,
              responses: [
                {
                  answerBoxId: component?.id ?? "unknown",
                  resultMapping,
                },
              ],
            });

            const isLastPage =
              currentPageIndex >= pages.length - 1;

            if (isLastPage) {
              await handleFinishQuiz();
            } else {
              await handleGoToPage(
                currentPageIndex + 1
              );
            }

            return;
          }

          // ========================
          // MULTIPLE
          // ========================

          if (questionMode === "multiple") {
            setSelectedAnswers((prev) => {
              const exists = prev.some(
                (a) => a.id === component?.id
              );

              const nextSelectedAnswers = exists
                ? prev.filter(
                    (a) => a.id !== component?.id
                  )
                : [...prev, component!];

              logQuizPlayDebug("multiple-answer-toggle", {
                sessionId,
                quizId: quizQuery._id,
                pageId,
                toggledAnswerBoxId: component?.id ?? "unknown",
                toggledResultMapping: resultMapping,
                selectedAnswerBoxIds: nextSelectedAnswers.map(
                  (answer) => answer.id,
                ),
                selectedResultMappings: nextSelectedAnswers.map((answer) => ({
                  answerBoxId: answer.id,
                  resultMapping:
                    (answer.actionProps?.resultMapping ??
                      {}) as Record<string, number>,
                })),
              });

              return nextSelectedAnswers;
            });
          }
        } catch (error) {
          console.error("Failed to record answer", error);
        } finally {
          setIsProcessingAction(false);
        }
      },
      [
        currentPageIndex,
        currentQuestionPage,
        handleFinishQuiz,
        handleGoToPage,
        pages.length,
        quizCompleted,
        quizQuery,
        setQuizPageResponses,
        sessionId,
        questionMode,
      ]
    );
  
  const submitMultipleAnswers =
    useCallback(async () => {
    if (!quizQuery || !sessionId)
      return;

    const pageId =
      currentQuestionPage?._id?.toString() ??
      `page-${currentPageIndex}`;

    const responses = selectedAnswers.map((answer) => ({
      answerBoxId: answer.id,
      resultMapping:
        (answer.actionProps?.resultMapping ?? {}) as Record<string, number>,
    }));

    logQuizPlayDebug("multiple-answer-submit", {
      sessionId,
      quizId: quizQuery._id,
      pageId,
      selectedAnswerBoxIds: selectedAnswers.map((answer) => answer.id),
      responses,
    });

    await setQuizPageResponses({
      sessionId,
      quizId: quizQuery._id,
      pageId,
      responses,
    });

    setSelectedAnswers([]);

    const isLastPage =
      currentPageIndex >= pages.length - 1;

    if (isLastPage) {
      await handleFinishQuiz();
    } else {
      await handleGoToPage(
        currentPageIndex + 1
      );
    }
  }, [
    currentPageIndex,
    currentQuestionPage,
    handleFinishQuiz,
    handleGoToPage,
    pages.length,
    quizQuery,
    selectedAnswers,
    setQuizPageResponses,
    sessionId,
  ]);

  const handleComponentAction = useCallback(
    async (
      action: PageAction,
      actionProps?: Record<string, unknown>,
      component?: Component,
    ) => {
      // Prevent multiple actions while processing
      if (isProcessingAction || isCalculatingResults) return;

      logQuizPlayDebug("component-action", {
        action,
        componentId: component?.id,
        currentPage: currentPageDebug,
        actionProps,
      });

      switch (action) {
        case "startQuiz":
          await handleStartQuiz();
          break;

        case "nextPage":
          if (!quizStarted) {
            await handleStartQuiz();
          } else if (!quizCompleted) {
            if (questionMode === "multiple") {
              if (selectedAnswers.length === 0) {
                toast.error("Select at least one answer before continuing");
                break;
              }

              await submitMultipleAnswers();
              break;
            }

            const isLastPage = currentPageIndex >= pages.length - 1;
            if (isLastPage) {
              await handleFinishQuiz();
            } else {
              await handleGoToPage(currentPageIndex + 1);
            }
          }
          break;

        case "previousPage":
          if (quizStarted && !quizCompleted && currentPageIndex > 0) {
            await handleGoToPage(currentPageIndex - 1);
          }
          break;

        case "answerBox":
          await handleAnswerBoxAction(actionProps, component);
          break;

        case "hyperlink": {
          const url = actionProps?.url as string | undefined;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
          }
          break;
        }

        default:
          console.warn("Unknown action:", action);
      }
    },
    [
      currentPageIndex,
      handleAnswerBoxAction,
      handleFinishQuiz,
      handleGoToPage,
      handleStartQuiz,
      isCalculatingResults,
      isProcessingAction,
      currentPageDebug,
      pages.length,
      quizCompleted,
      quizStarted,
      questionMode,
      selectedAnswers.length,
      submitMultipleAnswers,
    ],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading quiz...
        </div>
      </div>
    );
  }

  if (quizNotFound) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        <div className="rounded-2xl bg-white/10 px-6 py-8 text-center text-white/80">
          <h1 className="text-xl font-semibold">Quiz not found</h1>
          <p className="mt-2 text-sm">Double-check the link and try again.</p>
        </div>
      </div>
    );
  }

  if (totalQuestions === 0 && !onboardingPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        <div className="rounded-2xl bg-white/10 px-6 py-8 text-center text-white/80">
          <h1 className="text-xl font-semibold">No pages yet</h1>
          <p className="mt-2 text-sm">This quiz doesn&apos;t have any content yet.</p>
        </div>
      </div>
    );
  }

  if (!quizStarted && !onboardingPage) {
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black px-4">
        <div className="w-full max-w-md space-y-6 rounded-3xl bg-white/10 p-8 text-center text-white shadow-xl">
          <div>
            <h1 className="text-3xl font-semibold text-white">{quizQuery?.title}</h1>
            {quizQuery?.description ? (
              <p className="mt-3 text-sm text-white/80">{quizQuery.description}</p>
            ) : null}
          </div>
          <p className="text-sm text-white/60">
            {totalQuestions} {totalQuestions === 1 ? "question" : "questions"} • Interactive quiz
          </p>
          <Button
            onClick={handleStartQuiz}
            size="lg"
            className="w-full"
            disabled={!sessionId}
          >
            Start Quiz
          </Button>
        </div>
      </div>
    );
  }

  // Desktop: show phone preview with frame
  // Mobile: frameless full-screen view
  const desktopQuizFrame = displayPage ? (
    <div className="relative">
      <PhonePreview
        components={displayComponents}
        background={displayPage.background}
        scale={1}
        roundedCorners={false}
        onComponentAction={handleComponentAction}
          // New props for answer selection state
        selectedAnswers={selectedAnswers}
        currentPageNumber={Math.min(currentPageIndex + 1, Math.max(totalQuestions, 1))}
        totalPages={Math.max(totalQuestions, 1)}
      />
      {(isCalculatingResults || isProcessingAction) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex items-center gap-2 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            {isCalculatingResults ? "Calculating results..." : "Processing..."}
          </div>
        </div>
      )}
    </div>
  ) : null;

  const mobileQuizFrame = displayPage ? (
    <div className="relative h-full w-full">
      <PhonePreview
        components={displayComponents}
        background={displayPage.background}
        frameless
        onComponentAction={handleComponentAction}
        currentPageNumber={Math.min(currentPageIndex + 1, Math.max(totalQuestions, 1))}
        totalPages={Math.max(totalQuestions, 1)}
      />
      {(isCalculatingResults || isProcessingAction) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex items-center gap-2 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            {isCalculatingResults ? "Calculating results..." : "Processing..."}
          </div>
        </div>
      )}
    </div>
  ) : null;

  const emptyState = (
    <div className="flex h-full items-center justify-center bg-white/10 px-6 py-8 text-center text-white/80">
      {quizCompleted
        ? "No result page was configured for this quiz."
        : shouldShowOnboarding
          ? "This quiz's onboarding page is empty."
          : "Nothing to display on this page yet."}
    </div>
  );

  return (
    <div className="fixed inset-0 h-screen min-h-[100dvh] w-full overflow-hidden bg-black overscroll-none">
      {/* Desktop layout - centered with phone frame */}
      <div className="hidden h-screen grid-cols-3 bg-black md:grid">
        <div />
        <div className="flex h-screen flex-col items-center justify-center">
          {desktopQuizFrame ?? emptyState}
        </div>
        <div />
      </div>
      {/* Mobile layout - full screen, no frame, no scroll */}
      <div className="fixed inset-0 h-[100dvh] min-h-[100dvh] w-full overflow-hidden overscroll-none md:hidden">
        {mobileQuizFrame ?? emptyState}
      </div>
    </div>
  );
}
