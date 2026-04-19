"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Play,
  Sparkles,
  FileText,
  Trophy,
  Calendar,
  Smartphone,
} from "lucide-react";
import type { Id, Component } from "@/types";
import ConvexUserButton from "@/components/auth/convex-user-button";
import PhonePreview from "@/components/editor/PhonePreview";

interface QuizWithPreview {
  _id: Id<"quiz">;
  title: string;
  description?: string;
  userId: Id<"users">;
  status: "draft" | "published" | "closed";
  _creationTime: number;
  pageCount?: number;
  resultCount?: number;
  pageIds?: Id<"pages">[];
  resultIds?: Id<"results">[];
  onboardingPageId?: Id<"pages">;
  onboardingBackground?: {
    color?: string;
    image?: string;
  } | null;
  /** Set when the viewer is admin: quiz owner label for the title suffix. */
  ownerDisplayName?: string;
}

function QuizTitleHeading({
  quiz,
  className,
}: {
  quiz: QuizWithPreview;
  /** e.g. font-semibold in dialogs so only the owner suffix stays italic/normal */
  className?: string;
}) {
  return (
    <span className={className}>
      {quiz.title}
      {quiz.ownerDisplayName ? (
        <span className="italic font-normal text-slate-500">
          {" "}
          ({quiz.ownerDisplayName})
        </span>
      ) : null}
    </span>
  );
}

interface QuizOnboardingPreviewProps {
  quizId: Id<"quiz">;
  fallbackBackground?: QuizWithPreview["onboardingBackground"];
}

function QuizOnboardingPreview({
  quizId,
  fallbackBackground,
}: QuizOnboardingPreviewProps) {
  const quizDetail = useQuery(api.quiz.getQuiz, { id: quizId });
  const onboarding = quizDetail?.onboardingPage as
    | {
        components?: Component[];
        background?: { color?: string; image?: string };
      }
    | null
    | undefined;

  if (!quizDetail) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div
        className="h-full w-full"
        style={{
          backgroundColor: fallbackBackground?.color || "#f1f5f9",
          backgroundImage: fallbackBackground?.image
            ? `url(${fallbackBackground.image})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!fallbackBackground?.color && !fallbackBackground?.image && (
          <div className="flex h-full w-full items-center justify-center">
            <Smartphone className="h-8 w-8 text-slate-300" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <PhonePreview
        components={onboarding.components ?? []}
        background={onboarding.background}
        isEditable={false}
        // Smaller scale so the full phone fits nicely inside the card
        scale={0.22}
        roundedCorners
        className="mx-auto"
        contentClassName="pointer-events-none"
      />
    </div>
  );
}

function AuthenticatedQuizContent() {
  const [deletingId, setDeletingId] = useState<Id<"quiz"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const creatingRef = useRef(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    quiz: QuizWithPreview | null;
  }>({
    isOpen: false,
    quiz: null,
  });

  const [closeDialog, setCloseDialog] = useState<{
  isOpen: boolean;
  quiz: QuizWithPreview | null;
}>({
  isOpen: false,
  quiz: null,
});
  const router = useRouter();

  const quizzesQuery = useQuery(api.quiz.getUserQuizzes);
  const deleteQuizMutation = useMutation(api.quiz.deleteQuiz);
  const createQuizMutation = useMutation(api.quiz.createQuiz);
  const publishQuizMutation = useMutation(api.quiz.publishQuiz);//add publish mutation
  const closeQuizMutation = useMutation(api.quiz.closeQuiz);//add closed mutation
  
  const quizzes = (quizzesQuery ?? []) as QuizWithPreview[];
  const isLoading = quizzesQuery === undefined;

  const handleCreateNew = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreating(true);
    try {
      const id = await createQuizMutation({
        title: "Untitled Quiz",
        description: undefined,
      });
      if (id) router.push(`/quiz/${id}`);
    } catch (error) {
      console.error("Error creating quiz:", error);
      toast.error("Failed to create quiz");
    } finally {
      setIsCreating(false);
      creatingRef.current = false;
    }
  };

  const handleEdit = (quizId: Id<"quiz">) => {
    router.push(`/quiz/${quizId}`);
  };

  const handlePlay = (quizId: Id<"quiz">) => {
    router.push(`/play/${quizId}`);
  };

  const handleDelete = (quiz: QuizWithPreview) => {
    setDeleteDialog({
      isOpen: true,
      quiz,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      isOpen: false,
      quiz: null,
    });
    setDeletingId(null);
  };

  const confirmDelete = async () => {
    if (!deleteDialog.quiz) return;

    const quiz = deleteDialog.quiz;
    setDeletingId(quiz._id);
    try {
      await deleteQuizMutation({ id: quiz._id });
      toast.success("Quiz deleted successfully");
      closeDeleteDialog();
    } catch (error) {
      console.error("Error deleting quiz:", error);
      toast.error("Failed to delete quiz");
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-emerald-500">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          <p className="font-medium text-slate-500">Loading your quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Vision Verse</h1>
              <p className="text-sm text-slate-500">Your quiz dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">

          <Button
            onClick={() => router.push("/discover")}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            Discover
          </Button>

          <Button
            onClick={() => void handleCreateNew()}
            disabled={isCreating}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Quiz
          </Button>

          <ConvexUserButton />

        </div>
                </header>

        {/* Quizzes Grid */}
        {quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-24">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100">
              <Sparkles className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              No quizzes yet
            </h3>
            <p className="mb-6 max-w-sm text-center text-slate-500">
              Create your first quiz and start engaging your audience with
              interactive content.
            </p>
            <Button
              onClick={() => void handleCreateNew()}
              disabled={isCreating}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Create your first quiz
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Your Quizzes
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => (
                <div
                  key={quiz._id}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-lg"
                >
                  {/* Phone Preview */}
                  <div className="p-6 pb-4">
                    <QuizOnboardingPreview
                      quizId={quiz._id}
                      fallbackBackground={quiz.onboardingBackground}
                    />
                  </div>

                  {/* Quiz Info */}
                  <div className="px-6 pb-4">
                    <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-emerald-600">
                      <span className="line-clamp-2 break-words">
                        <QuizTitleHeading quiz={quiz} />
                      </span>
                    </h3>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                      {quiz.description || "No description"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                     
                      <Badge
                        variant="secondary"
                        className={`border-0 text-xs ${
                        quiz.status === "published"
                        ? "bg-emerald-600 text-white"
                        : quiz.status === "draft"
                        ? "bg-amber-500 text-white"
                        : "bg-red-500 text-white"
                      }`}
                      >
                        {quiz.status}
                      </Badge>
                    
                      
                      <Badge
                        variant="secondary"
                        className="border-0 bg-slate-100 text-xs text-slate-600"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        {quiz.pageCount ?? 0} pages
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="border-0 bg-slate-100 text-xs text-slate-600"
                      >
                        <Trophy className="mr-1 h-3 w-3" />
                        {quiz.resultCount ?? 0} results
                      </Badge>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(quiz._creationTime).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-slate-100 px-6 pb-6 pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handlePlay(quiz._id)}
                         disabled={quiz.status !== "published"}
                         title={
                            quiz.status !== "published"
                              ? "Publish the quiz before playing"
                              : "Play quiz"
                        }
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Play
                      </Button>

                      
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(quiz._id)}
                      disabled={quiz.status === "published"}
                      title={
                        quiz.status === "published"
                          ? "Close the quiz before editing"
                          : "Edit quiz"
                      }
                      className="flex-1 border-slate-200 hover:bg-slate-50"
                    >
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                                          
                      {quiz.status !== "published" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => publishQuizMutation({ id: quiz._id })}
                        className="border-slate-200 hover:bg-slate-50"
                      >
                        Publish
                      </Button>
                      )}

                    {quiz.status === "published" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                        setCloseDialog({
                          isOpen: true,
                          quiz,
                        })
                      }
                        className="border-slate-200 hover:bg-slate-50"
                      >
                        Close
                      </Button>
                    )}


                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(quiz)}
                        disabled={deletingId === quiz._id}
                        className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        {deletingId === quiz._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.isOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center">Delete Quiz</DialogTitle>
            <DialogDescription className="text-center">
              Are you sure you want to delete{" "}
              <span className="text-slate-700">
                &quot;
                {deleteDialog.quiz ? (
                  <QuizTitleHeading
                    quiz={deleteDialog.quiz}
                    className="font-semibold"
                  />
                ) : null}
                &quot;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={!!deletingId}
              className="w-full sm:w-auto"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Quiz"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


              {/* Close Confirmation Dialog */}
          <Dialog
            open={closeDialog.isOpen}
            onOpenChange={() =>
              setCloseDialog({
                isOpen: false,
                quiz: null,
              })
            }
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">
                  Close Quiz
                </DialogTitle>

                <DialogDescription className="text-center">
                  Are you sure you want to close{" "}
                  <span className="text-slate-700">
                    &quot;
                    {closeDialog.quiz ? (
                      <QuizTitleHeading
                        quiz={closeDialog.quiz}
                        className="font-semibold"
                      />
                    ) : null}
                    &quot;
                  </span>
                  ? Users will no longer be able to play it.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() =>
                    setCloseDialog({
                      isOpen: false,
                      quiz: null,
                    })
                  }
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>

                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!closeDialog.quiz) return;

                    try {
                      await closeQuizMutation({
                        id: closeDialog.quiz._id,
                      });

                      toast.success("Quiz closed");

                      setCloseDialog({
                        isOpen: false,
                        quiz: null,
                      });
                    } catch (error) {
                      console.error("Error closing quiz:", error);
                      toast.error("Failed to close quiz");
                    }
                  }}
                  className="w-full sm:w-auto"
                >
                  Close Quiz
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
              </div>
  );
}

export default function QuizListPage() {
  return <AuthenticatedQuizContent />;
}
