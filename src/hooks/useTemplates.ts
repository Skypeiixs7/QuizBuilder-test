"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Component, PageTemplate } from "@/types";

type TemplateType = "quiz" | "result" | "onboarding";

const BLANK_CONFIGS: Record<
  TemplateType,
  { id: string; background: string }
> = {
  quiz: { id: "blank", background: "#1e293b" },
  result: { id: "result-blank", background: "#0f172a" },
  onboarding: { id: "onboarding-blank", background: "#0f172a" },
};

export function useTemplates(templateType: TemplateType): PageTemplate[] {
  const convexTemplates = useQuery(api.templates.getTemplates, {
    templateType,
  });

  return useMemo<PageTemplate[]>(() => {
    const config = BLANK_CONFIGS[templateType];

    const blankTemplate: PageTemplate = {
      id: config.id,
      title: "Blank Page",
      description: "Start with an empty canvas",
      pageName: "",
      background: { color: config.background },
      build: () => [],
    };

    if (!convexTemplates) {
      return [blankTemplate];
    }

    const converted = convexTemplates.map((t) => ({
      id: t._id,
      title: t.title,
      description: t.description,
      pageName: t.pageName,
      background: t.background,
      build: () => t.components as Component[],
    }));

    return [blankTemplate, ...converted];
  }, [convexTemplates, templateType]);
}
