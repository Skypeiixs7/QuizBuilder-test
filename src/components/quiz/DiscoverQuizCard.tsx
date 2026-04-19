"use client";

import { useRouter } from "next/navigation";
import PhonePreview from "@/components/editor/PhonePreview";


type Props = {
  quiz: {
    _id: string;
    title: string;
    description?: string;
    _creationTime?: number;
    components?: any[];
    background?: any;
  };
};

export default function DiscoverQuizCard({
  quiz,
}: Props) {
  const router = useRouter();

  const handlePlay = () => {
    router.push(`/play/${quiz._id}`);
  };

  return (
    <div
      className="
        border
        border-slate-200
        rounded-xl
        bg-white
        shadow-sm
        p-5
        transition
        hover:shadow-md
      "
    >
      {/* Phone preview  */}

      <div className="flex justify-center mb-6">

        <PhonePreview
          components={quiz.components ?? []}
          background={quiz.background}
          scale={0.28}
          isEditable={false}
          roundedCorners={true}
        />

      </div>

      {/* Quiz name */}

      <h3 className="text-lg font-semibold text-slate-900">
        {quiz.title}
      </h3>

      {/* Description */}

      <p className="mt-1 text-sm text-slate-500">
        {quiz.description || "No description"}
      </p>

      {/* Creation date */}

      {quiz._creationTime && (
        <p className="mt-3 text-xs text-slate-400">
          {new Date(
            quiz._creationTime
          ).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      {/* Play button */}

      <button
        onClick={handlePlay}
        className="
          mt-4
          w-full
          bg-blue-600
          text-white
          py-2
          rounded-lg
          hover:bg-blue-700
          transition
        "
      >
        Play Quiz
      </button>

    </div>
  );
}