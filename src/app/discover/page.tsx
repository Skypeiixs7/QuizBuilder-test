"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import DiscoverQuizCard from "@/components/quiz/DiscoverQuizCard";
import { Sparkles, Search } from "lucide-react";
import ConvexUserButton from "@/components/auth/convex-user-button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DiscoverPage() {
  const router = useRouter();

  const quizzes = useQuery(
    api.quiz.getPublishedQuizzes
  );

  const [search, setSearch] =
    useState("");

  // Loading state — keep simple and centered
  if (quizzes === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        Loading quizzes...
      </div>
    );
  }

  // Empty state — same background as dashboard
  if (quizzes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        No quizzes available
      </div>
    );
  }

  const filtered =
    quizzes.filter((quiz) =>
      quiz.title
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  return (
    <div className="min-h-screen bg-slate-100">

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Header — identical structure to Dashboard */}

        <div className="flex items-center justify-between mb-10">

          <div className="flex items-center gap-4">

            <div
              className="
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-xl
                bg-slate-900
              "
            >
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>

            <div>

              <h1 className="text-xl font-bold text-slate-900">
                Discover
              </h1>

              <p className="text-sm text-slate-500">
                Browse public quizzes
              </p>

            </div>

          </div>

          {/* Search */}

          <div className="flex-1 max-w-md mx-8">

            <div className="relative">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search quizzes..."
                className="
                  w-full
                  pl-10
                  pr-4
                  py-2.5
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  focus:outline-none
                  focus:ring-2
                  focus:ring-slate-900
                "
              />

            </div>

          </div>

          <div className="flex items-center gap-3">

            <button
              onClick={() =>
                router.push("/quiz")
              }
              className="
                bg-slate-900
                text-white
                px-4
                py-2
                rounded-lg
                hover:bg-slate-800
                transition
              "
            >
              My Dashboard
            </button>

            <ConvexUserButton />

          </div>

        </div>

        {/* Grid — same spacing as dashboard */}

        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            lg:grid-cols-3
            gap-6
          "
        >
          {filtered.map((quiz) => (
            <DiscoverQuizCard
              key={quiz._id}
              quiz={quiz}
            />
          ))}
        </div>

      </div>

    </div>
  );
}