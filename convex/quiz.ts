import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  componentSchema,
  pageBackgroundSchema,
  componentPositionSchema,
  pageTypeSchema,
} from "./schemas";
import type { Id, Doc } from "./_generated/dataModel";

type PageType = "page" | "result" | "onboarding";
type PageAction =
  | "nextPage"
  | "previousPage"
  | "answerBox"
  | "hyperlink"
  | "startQuiz";

interface ComponentPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GroupChild {
  id: string;
  type: string;
  data?: string;
  props?: Record<string, unknown>;
  action?: PageAction;
  actionProps?: Record<string, unknown>;
  relativePosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ComponentData {
  id: string;
  type: string;
  data?: string;
  props?: Record<string, unknown>;
  action?: PageAction;
  actionProps?: Record<string, unknown>;
  position: ComponentPosition;
  children?: GroupChild[];
}

async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

async function isAdminActor(
  ctx: QueryCtx | MutationCtx,
  actorId: Id<"users">,
): Promise<boolean> {
  const me = await ctx.db.get(actorId);
  return me?.role === "admin";
}

/** Owner or admin may access another user's quiz resources. */
async function canAccessUserResource(
  ctx: QueryCtx | MutationCtx,
  resourceOwnerId: Id<"users">,
  actorId: Id<"users">,
): Promise<boolean> {
  if (resourceOwnerId === actorId) {
    return true;
  }
  return (await isAdminActor(ctx, actorId)) === true;
}

async function requireOwnership<T extends { userId: Id<"users"> }>(
  ctx: QueryCtx | MutationCtx,
  resource: T | null,
  actorId: Id<"users">,
  _resourceName = "Resource",
): Promise<T> {
  if (!resource) {
    throw new Error("Unauthorized");
  }
  if (await canAccessUserResource(ctx, resource.userId, actorId)) {
    return resource;
  }
  throw new Error("Unauthorized");
}

function assertQuizEditable(quiz: Doc<"quiz">) {
  if (quiz.status === "published") {
    throw new Error(
      "Quiz is published and cannot be edited. Please close it first.",
    );
  }
}

async function getComponentsForPage(
  ctx: QueryCtx,
  pageId: string,
): Promise<ComponentData[]> {
  const allComponents = await ctx.db
    .query("components")
    .withIndex("by_pageId", (q) => q.eq("pageId", pageId))
    .collect();

  return allComponents.map((comp) => ({
    id: comp._id,
    type: comp.type,
    data: comp.data,
    props: comp.props,
    action: comp.action as PageAction | undefined,
    actionProps: comp.actionProps as Record<string, unknown> | undefined,
    position: comp.position,
    children: comp.children as GroupChild[] | undefined,
  }));
}

async function saveComponentsForPage(
  ctx: MutationCtx,
  pageId: string,
  pageType: PageType,
  userId: Id<"users">,
  components: ComponentData[],
): Promise<void> {
  for (const comp of components) {
    await ctx.db.insert("components", {
      pageId,
      pageType,
      type: comp.type,
      data: comp.data,
      props: comp.props,
      action: comp.action,
      actionProps: comp.actionProps,
      position: comp.position,
      children: comp.children,
      userId,
    });
  }
}

async function deleteComponentsForPage(
  ctx: MutationCtx,
  pageId: string,
): Promise<void> {
  const components = await ctx.db
    .query("components")
    .withIndex("by_pageId", (q) => q.eq("pageId", pageId))
    .collect();

  for (const comp of components) {
    await ctx.db.delete(comp._id);
  }
}

export const createQuiz = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const quizId = await ctx.db.insert("quiz", {
      title: args.title,
      description: args.description,
      userId,
      pageIds: [],
      resultIds: [],
      onboardingPageId: undefined,
      nextPageNumber: 1,
      nextResultNumber: 1,

      status: "draft",
      createdAt: Date.now(),
    });

    // Create onboarding page in the pages table with pageType: "onboarding"
    const onboardingPageId = await ctx.db.insert("pages", {
      quizId,
      pageName: "Onboarding",
      background: { color: "#0f172a" },
      userId,
      pageType: "onboarding",
    });

    await ctx.db.patch(quizId, { onboardingPageId });
    return quizId;
  },
});

export const getUserQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);

    const isAdmin = await isAdminActor(ctx, userId);
    const quizzes = isAdmin
      ? await ctx.db.query("quiz").order("desc").collect()
      : await ctx.db
          .query("quiz")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .order("desc")
          .collect();

    // Get page and result counts for each quiz, plus onboarding background
    const quizzesWithCounts = await Promise.all(
      quizzes.map(async (quiz) => {
        // Get onboarding page background if exists
        let onboardingBackground: { color?: string; image?: string } | null =
          null;
        if (quiz.onboardingPageId) {
          const onboardingPage = await ctx.db.get(quiz.onboardingPageId);
          if (onboardingPage?.background) {
            onboardingBackground = onboardingPage.background;
            // If there's an image storageId, get the URL
            if (
              onboardingBackground.image &&
              !onboardingBackground.image.startsWith("http")
            ) {
              try {
                const imageUrl = await ctx.storage.getUrl(
                  onboardingBackground.image as Id<"_storage">,
                );
                if (imageUrl) {
                  onboardingBackground = {
                    ...onboardingBackground,
                    image: imageUrl,
                  };
                }
              } catch {
                // If storage lookup fails, keep the original value
              }
            }
          }
        }

        let ownerDisplayName: string | undefined;
        if (isAdmin) {
          const owner = await ctx.db.get(quiz.userId);
          ownerDisplayName =
            owner?.username ??
            owner?.name ??
            owner?.email ??
            "unknown";
        }

        return {
          ...quiz,
          pageCount: quiz.pageIds.length,
          resultCount: quiz.resultIds.length,
          onboardingBackground,
          ...(isAdmin ? { ownerDisplayName } : {}),
        };
      }),
    );

    return quizzesWithCounts;
  },
});

export const getPublishedQuizzes = query({
  args: {},

  handler: async (ctx) => {

    /**
     * Fetch published quizzes for the Discover page.
     *
     * We also load:
     * - onboarding page background
     * - components belonging to that page
     *
     * This data is required for PhonePreview rendering.
     */

    const quizzes = await ctx.db
      .query("quiz")
      .withIndex("by_status", (q) =>
        q.eq("status", "published")
      )
      .order("desc")
      .collect();

    const results = await Promise.all(
      quizzes.map(async (quiz) => {

        let background = undefined;
        let components: any[] = [];

        if (quiz.onboardingPageId) {

          /**
           * Step 1: get onboarding page
           */

          const page = await ctx.db.get(
            quiz.onboardingPageId
          );

          if (page) {

            background = page.background;

            /**
             * Step 2: fetch components for this page
             */

            const pageComponents =
            await ctx.db
              .query("components")
              .withIndex("by_pageId", (q) =>
                q.eq(
                  "pageId",
                  quiz.onboardingPageId!.toString()
                )
              )
              .collect();

            components = pageComponents.map((component) => ({
              id: component._id,
              type: component.type,
              data: component.data,
              props: component.props,
              action: component.action as PageAction | undefined,
              actionProps:
                component.actionProps as Record<string, unknown> | undefined,
              position: component.position,
              children: component.children as GroupChild[] | undefined,
            }));
          }
        }

        return {
          _id: quiz._id,

          title: quiz.title,
          description: quiz.description,

          _creationTime: quiz._creationTime,

          /**
           * Required for PhonePreview
           */

          background,
          components,

          status: quiz.status,
        };
      })
    );

    return results;
  },
});
// Get a quiz for public viewing/playing (no auth required)

export const getPublicQuiz = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    if (quiz.status !== "published") {
      throw new Error("Quiz not available");
    }
    // Filter out onboarding pages from pageIds (they have pageType: "onboarding")
    const allPages = (
      await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
    ).filter(Boolean);
    const pages = allPages.filter((p) => p!.pageType !== "onboarding");
    const results = (
      await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
    ).filter(Boolean);

    // Get onboarding page from pages table
    const onboarding = quiz.onboardingPageId
      ? await ctx.db.get(quiz.onboardingPageId)
      : null;

    const pagesHydrated = await Promise.all(
      pages.map(async (p) => ({
        ...p!,
        components: await getComponentsForPage(ctx, p!._id),
      })),
    );

    const resultsHydrated = await Promise.all(
      results.map(async (r) => ({
        ...r!,
        components: await getComponentsForPage(ctx, r!._id),
      })),
    );

    const onboardingHydrated = onboarding
      ? {
          ...onboarding,
          components: await getComponentsForPage(ctx, onboarding._id),
        }
      : null;

    return {
      ...quiz,
      pages: pagesHydrated,
      results: resultsHydrated,
      onboardingPage: onboardingHydrated,
    };
  },
});

export const getQuiz = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );

    // Filter out onboarding pages from pageIds (they have pageType: "onboarding")
    const allPages = (
      await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))
    ).filter(Boolean);
    const pages = allPages.filter((p) => p!.pageType !== "onboarding");
    const results = (
      await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))
    ).filter(Boolean);

    // Get onboarding page from pages table
    const onboarding = quiz.onboardingPageId
      ? await ctx.db.get(quiz.onboardingPageId)
      : null;

    const pagesHydrated = await Promise.all(
      pages.map(async (p) => ({
        ...p!,
        components: await getComponentsForPage(ctx, p!._id),
      })),
    );

    const resultsHydrated = await Promise.all(
      results.map(async (r) => ({
        ...r!,
        components: await getComponentsForPage(ctx, r!._id),
      })),
    );

    const onboardingHydrated = onboarding
      ? {
          ...onboarding,
          components: await getComponentsForPage(ctx, onboarding._id),
        }
      : null;

    return {
      ...quiz,
      pages: pagesHydrated,
      results: resultsHydrated,
      onboardingPage: onboardingHydrated,
    };
  },
});

export const updateQuiz = mutation({
  args: {
    id: v.id("quiz"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const updateData: Partial<{
      title: string;
      description: string | undefined;
    }> = {};

    if (args.title !== undefined) updateData.title = args.title;
    if (args.description !== undefined)
      updateData.description = args.description;

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

// Delete a quiz and all its pages and results
export const deleteQuiz = mutation({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireOwnership(ctx, await ctx.db.get(args.id), userId, "Quiz");

    // Delete all pages (including onboarding pages) and results for this quiz
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.id))
      .collect();

    const results = await ctx.db
      .query("results")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.id))
      .collect();

    // Delete all pages (including onboarding) and their components
    for (const page of pages) {
      await deleteComponentsForPage(ctx, page._id);
      await ctx.db.delete(page._id);
    }

    // Delete all results and their components
    for (const result of results) {
      await deleteComponentsForPage(ctx, result._id);
      await ctx.db.delete(result._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const createPage = mutation({
  args: {
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const trimmedPageName = args.pageName?.trim();
    const nextPageNumber = quiz.nextPageNumber ?? (quiz.pageIds.length + 1);
    const pageName =
      trimmedPageName && trimmedPageName.length > 0
        ? trimmedPageName
        : `Page ${nextPageNumber}`;

    const pageId = await ctx.db.insert("pages", {
      quizId: args.quizId,
      pageName,
      background: args.background ?? { color: "#1e293b" },
      userId: quiz.userId,

      // default to "single" question mode for new pages
      questionMode: "single",
    });

    // Append to quiz.pageIds for explicit ordering
    await ctx.db.patch(args.quizId, {
      pageIds: [...quiz.pageIds, pageId],
      nextPageNumber: nextPageNumber + 1,
    });
    return pageId;
  },
});

    export const updatePage = mutation({
      args: {
      id: v.id("pages"),
      pageName: v.optional(v.string()),
      background: v.optional(pageBackgroundSchema),

      // new optional argument to update question mode
      questionMode: v.optional(
        v.union(
          v.literal("single"),
          v.literal("multiple")
        )
      ),
    },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(page.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const updateData: Partial<{
      pageName: string | undefined;
      background: typeof args.background;
      questionMode:
        | "single"
        | "multiple"
        | undefined;
        
    }> = {};

    if (args.pageName !== undefined) updateData.pageName = args.pageName;
    if (args.background !== undefined) updateData.background = args.background;
    if (args.questionMode !== undefined)updateData.questionMode = args.questionMode;

    console.log("[quiz:updatePage] request", {
      pageId: args.id,
      pageName: page.pageName,
      existingQuestionMode: page.questionMode,
      nextQuestionMode: args.questionMode,
      updateData,
    });

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const deletePage = mutation({
  args: { id: v.id("pages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await ctx.db.get(args.id);
    if (!page) {
      throw new Error("Page not found");
    }

    // Ensure the page still belongs to a quiz owned by the user
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(page.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    // Legacy pages may not have a userId set; ensure row owner matches quiz (or admin)
    if (
      page.userId &&
      !(await canAccessUserResource(ctx, page.userId, userId))
    ) {
      throw new Error("Unauthorized");
    }

    // Remove from quiz.pageIds to keep ordering state in sync
    const filtered = quiz.pageIds.filter((pid) => pid !== args.id);
    if (filtered.length !== quiz.pageIds.length) {
      await ctx.db.patch(page.quizId, { pageIds: filtered });
    }

    await deleteComponentsForPage(ctx, args.id);

    await ctx.db.delete(args.id);
  },
});

export const getPage = query({
  args: { id: v.id("pages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );
    const components = await getComponentsForPage(ctx, args.id);
    return { ...page, components };
  },
});

export const createResult = mutation({
  args: {
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    const trimmedPageName = args.pageName?.trim();
    const nextResultNumber = quiz.nextResultNumber ?? (quiz.resultIds.length + 1);
    const pageName =
      trimmedPageName && trimmedPageName.length > 0
        ? trimmedPageName
        : `Result ${nextResultNumber}`;

    const resultId = await ctx.db.insert("results", {
      quizId: args.quizId,
      pageName,
      background: args.background ?? { color: "#0f172a" },
      userId: quiz.userId,
    });

    // Append to quiz.resultIds for explicit ordering
    await ctx.db.patch(args.quizId, {
      resultIds: [...quiz.resultIds, resultId],
      nextResultNumber: nextResultNumber + 1,
    });
    return resultId;
  },
});

export const updateResult = mutation({
  args: {
    id: v.id("results"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(result.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    const updateData: Partial<{
      pageName: string | undefined;
      background: typeof args.background;
    }> = {};

    if (args.pageName !== undefined) updateData.pageName = args.pageName;
    if (args.background !== undefined) updateData.background = args.background;

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const deleteResult = mutation({
  args: { id: v.id("results") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(result.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    await deleteComponentsForPage(ctx, args.id);

    await ctx.db.delete(args.id);
    await ctx.db.patch(result.quizId, {
      resultIds: quiz.resultIds.filter((resultId) => resultId !== args.id),
    });
  },
});

export const getResult = query({
  args: { id: v.id("results") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );
    const components = await getComponentsForPage(ctx, args.id);
    return { ...result, components };
  },
});

export const reorderPages = mutation({
  args: {
    quizId: v.id("quiz"),
    pageIds: v.array(v.id("pages")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    // Verify all pages belong to this quiz and actor may edit them
    for (const pageId of args.pageIds) {
      const page = await ctx.db.get(pageId);
      if (!page || page.quizId !== args.quizId) {
        throw new Error("Invalid page ID in reorder list");
      }
      if (!(await canAccessUserResource(ctx, page.userId, userId))) {
        throw new Error("Invalid page ID in reorder list");
      }
    }

    // Update the explicit order list
    await ctx.db.patch(args.quizId, { pageIds: args.pageIds });
  },
});

export const reorderResults = mutation({
  args: {
    quizId: v.id("quiz"),
    resultIds: v.array(v.id("results")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );
    assertQuizEditable(quiz);

    // Verify all results belong to this quiz and actor may edit them
    for (const resultId of args.resultIds) {
      const result = await ctx.db.get(resultId);
      if (!result || result.quizId !== args.quizId) {
        throw new Error("Invalid result ID in reorder list");
      }
      if (!(await canAccessUserResource(ctx, result.userId, userId))) {
        throw new Error("Invalid result ID in reorder list");
      }
    }

    // Update the explicit order list
    await ctx.db.patch(args.quizId, { resultIds: args.resultIds });
  },
});

export const setPageComponents = mutation({
  args: { id: v.id("pages"), components: v.array(componentSchema) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(page.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    await deleteComponentsForPage(ctx, args.id);

    // Save new components with default positions if not provided
    const componentsWithPositions = args.components.map((comp, index) => ({
      ...comp,
      position: comp.position ?? {
        x: 0,
        y: 5 + index * 18,
        width: 90,
        height: 15,
      },
    }));

    await saveComponentsForPage(
      ctx,
      args.id,
      "page",
      page.userId,
      componentsWithPositions as ComponentData[],
    );
  },
});

export const setResultComponents = mutation({
  args: { id: v.id("results"), components: v.array(componentSchema) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const result = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Result",
    );

    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(result.quizId),
      userId,
      "Quiz",
    );

    assertQuizEditable(quiz);

    await deleteComponentsForPage(ctx, args.id);

    // Save new components with default positions if not provided
    const componentsWithPositions = args.components.map((comp, index) => ({
      ...comp,
      position: comp.position ?? {
        x: 0,
        y: 5 + index * 18,
        width: 90,
        height: 15,
      },
    }));

    await saveComponentsForPage(
      ctx,
      args.id,
      "result",
      result.userId,
      componentsWithPositions as ComponentData[],
    );
  },
});

export const updateOnboardingPage = mutation({
  args: {
    id: v.id("pages"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    // Verify this is an onboarding page
    if (page.pageType !== "onboarding") {
      throw new Error("This page is not an onboarding page");
    }

    const updateData: Partial<{
      pageName: string | undefined;
      background: typeof args.background;
    }> = {};

    if (args.pageName !== undefined) updateData.pageName = args.pageName;
    if (args.background !== undefined) updateData.background = args.background;

    await ctx.db.patch(args.id, updateData);
    return await ctx.db.get(args.id);
  },
});

export const getOnboardingPage = query({
  args: { id: v.id("pages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    // Verify this is an onboarding page
    if (page.pageType !== "onboarding") {
      throw new Error("This page is not an onboarding page");
    }

    const components = await getComponentsForPage(ctx, args.id);
    return { ...page, components };
  },
});

export const setOnboardingComponents = mutation({
  args: { id: v.id("pages"), components: v.array(componentSchema) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const page = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Page",
    );

    // Verify this is an onboarding page
    if (page.pageType !== "onboarding") {
      throw new Error("This page is not an onboarding page");
    }

    await deleteComponentsForPage(ctx, args.id);

    // Save new components with default positions if not provided
    const componentsWithPositions = args.components.map((comp, index) => ({
      ...comp,
      position: comp.position ?? {
        x: 0,
        y: 5 + index * 18,
        width: 90,
        height: 15,
      },
    }));

    await saveComponentsForPage(
      ctx,
      args.id,
      "onboarding",
      page.userId,
      componentsWithPositions as ComponentData[],
    );
  },
});

// Create an onboarding page for a quiz (used when quiz doesn't have one)
export const createOnboardingPage = mutation({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.quizId),
      userId,
      "Quiz",
    );

    // If quiz already has an onboarding page, return it
    if (quiz.onboardingPageId) {
      return quiz.onboardingPageId;
    }

    const onboardingPageId = await ctx.db.insert("pages", {
      quizId: args.quizId,
      pageName: "Onboarding",
      background: { color: "#0f172a" },
      userId: quiz.userId,
      pageType: "onboarding",
    });

    // Update quiz with the new onboarding page ID
    await ctx.db.patch(args.quizId, { onboardingPageId });

    return onboardingPageId;
  },
});

export const updateComponentPosition = mutation({
  args: {
    componentId: v.id("components"),
    position: componentPositionSchema,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    // This handles race conditions where position update fires after deletion
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.componentId, { position: args.position });
    return await ctx.db.get(args.componentId);
  },
});

export const updateComponentProps = mutation({
  args: {
    componentId: v.id("components"),
    props: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    // This handles race conditions where props update fires after deletion
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    const mergedProps = { ...(component.props ?? {}), ...args.props };
    await ctx.db.patch(args.componentId, { props: mergedProps });
    return await ctx.db.get(args.componentId);
  },
});

export const updateComponentData = mutation({
  args: {
    componentId: v.id("components"),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    // This handles race conditions where data update fires after deletion
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.componentId, { data: args.data });
    return await ctx.db.get(args.componentId);
  },
});

export const updateComponentAction = mutation({
  args: {
    componentId: v.id("components"),
    action: v.optional(
      v.union(
        v.literal("nextPage"),
        v.literal("previousPage"),
        v.literal("answerBox"),
        v.literal("hyperlink"),
        v.literal("startQuiz"),
      ),
    ),
    actionProps: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    // If component was already deleted, silently return null
    if (!component) {
      return null;
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    const nextActionProps =
      args.action === "answerBox" &&
      typeof args.actionProps === "object" &&
      args.actionProps !== null &&
      typeof (args.actionProps as { resultMapping?: unknown }).resultMapping ===
        "object" &&
      (args.actionProps as { resultMapping?: unknown }).resultMapping !== null
        ? {
            ...(typeof component.actionProps === "object" &&
            component.actionProps !== null
              ? component.actionProps
              : {}),
            resultMapping: {
              ...((typeof component.actionProps === "object" &&
              component.actionProps !== null &&
              typeof (component.actionProps as { resultMapping?: unknown })
                .resultMapping === "object" &&
              (component.actionProps as { resultMapping?: unknown })
                .resultMapping !== null
                ? (component.actionProps as {
                    resultMapping?: Record<string, number>;
                  }).resultMapping
                : {}) ?? {}),
              ...((args.actionProps as {
                resultMapping?: Record<string, number>;
              }).resultMapping ?? {}),
            },
          }
        : args.actionProps;

    await ctx.db.patch(args.componentId, {
      action: args.action,
      actionProps: nextActionProps,
    });
    return await ctx.db.get(args.componentId);
  },
});

export const createMergeGroup = mutation({
  args: {
    componentIds: v.array(v.id("components")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    if (args.componentIds.length < 2) {
      throw new Error("Need at least 2 components to merge");
    }

    // Fetch all components and verify ownership
    const components: Doc<"components">[] = [];
    for (const componentId of args.componentIds) {
      const component = await ctx.db.get(componentId);
      if (!component) {
        throw new Error("Component not found");
      }
      if (!(await canAccessUserResource(ctx, component.userId, userId))) {
        throw new Error("Unauthorized");
      }
      // Don't allow merging groups (no nested groups)
      if (component.type === "group") {
        throw new Error("Cannot merge group components");
      }
      components.push(component);
    }

    // All components must be on the same page
    const pageId = components[0]!.pageId;
    const pageType = components[0]!.pageType;
    for (const comp of components) {
      if (comp.pageId !== pageId) {
        throw new Error("All components must be on the same page");
      }
    }

    // Calculate bounding box in absolute coordinates
    // Position x is center-based: -50 to 50 where 0 is center
    // To get left edge: 50 + x - width/2
    // To get right edge: 50 + x + width/2
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    for (const comp of components) {
      const pos = comp.position;
      const left = 50 + pos.x - pos.width / 2;
      const right = 50 + pos.x + pos.width / 2;
      const top = pos.y;
      const bottom = pos.y + pos.height;

      minLeft = Math.min(minLeft, left);
      maxRight = Math.max(maxRight, right);
      minTop = Math.min(minTop, top);
      maxBottom = Math.max(maxBottom, bottom);
    }

    // Group bounds
    const groupWidth = maxRight - minLeft;
    const groupHeight = maxBottom - minTop;
    // Group center x in absolute terms: minLeft + groupWidth/2
    // Convert back to center-based: (minLeft + groupWidth/2) - 50
    const groupCenterX = minLeft + groupWidth / 2 - 50;
    const groupY = minTop;

    // Create children with positions relative to the group
    const children = components.map((comp) => {
      const pos = comp.position;
      // Component left edge in absolute terms
      const compLeft = 50 + pos.x - pos.width / 2;
      const compTop = pos.y;

      // Convert to relative position within group
      // relativeX: offset from group center as percentage of group width
      // Component center relative to group: (compLeft + pos.width/2) - (minLeft + groupWidth/2)
      const compCenterAbs = compLeft + pos.width / 2;
      const groupCenterAbs = minLeft + groupWidth / 2;
      const relativeX =
        groupWidth > 0
          ? ((compCenterAbs - groupCenterAbs) / groupWidth) * 100
          : 0;

      // relativeY: percentage from top of group
      const relativeY =
        groupHeight > 0 ? ((compTop - minTop) / groupHeight) * 100 : 0;

      // Width and height as percentage of group dimensions
      const relativeWidth =
        groupWidth > 0 ? (pos.width / groupWidth) * 100 : 100;
      const relativeHeight =
        groupHeight > 0 ? (pos.height / groupHeight) * 100 : 100;

      return {
        id: comp._id,
        type: comp.type,
        data: comp.data,
        props: comp.props,
        action: comp.action,
        actionProps: comp.actionProps,
        relativePosition: {
          x: relativeX,
          y: relativeY,
          width: relativeWidth,
          height: relativeHeight,
        },
      };
    });

    const groupId = await ctx.db.insert("components", {
      pageId,
      pageType,
      type: "group",
      children,
      position: {
        x: groupCenterX,
        y: groupY,
        width: groupWidth,
        height: groupHeight,
      },
      userId: components[0]!.userId,
    });

    for (const componentId of args.componentIds) {
      await ctx.db.delete(componentId);
    }

    return await ctx.db.get(groupId);
  },
});

export const unmergeGroup = mutation({
  args: {
    groupId: v.id("components"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }
    if (!(await canAccessUserResource(ctx, group.userId, userId))) {
      throw new Error("Unauthorized");
    }
    if (group.type !== "group") {
      throw new Error("Component is not a group");
    }
    if (!group.children || group.children.length === 0) {
      throw new Error("Group has no children");
    }

    const groupPos = group.position;
    // Group left edge in absolute terms
    const groupLeft = 50 + groupPos.x - groupPos.width / 2;
    const groupTop = groupPos.y;

    // Create individual components from children
    const createdIds: Id<"components">[] = [];
    for (const child of group.children) {
      const relPos = child.relativePosition;

      // Convert relative position back to absolute
      // Child width in absolute terms
      const childWidth = (relPos.width / 100) * groupPos.width;
      const childHeight = (relPos.height / 100) * groupPos.height;

      // Child center relative to group center, then convert to absolute
      // relativeX is percentage offset from group center
      const childCenterOffset = (relPos.x / 100) * groupPos.width;
      const childCenterAbs = groupLeft + groupPos.width / 2 + childCenterOffset;
      // Convert to center-based x: childCenterAbs - 50
      const childX = childCenterAbs - 50;

      // Child top in absolute terms
      const childY = groupTop + (relPos.y / 100) * groupPos.height;

      const newId = await ctx.db.insert("components", {
        pageId: group.pageId,
        pageType: group.pageType,
        type: child.type,
        data: child.data,
        props: child.props,
        action: child.action,
        actionProps: child.actionProps,
        position: {
          x: childX,
          y: childY,
          width: childWidth,
          height: childHeight,
        },
        userId: group.userId,
      });
      createdIds.push(newId);
    }

    await ctx.db.delete(args.groupId);

    return { success: true, componentIds: createdIds };
  },
});

export const deleteComponent = mutation({
  args: {
    componentId: v.id("components"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const component = await ctx.db.get(args.componentId);

    if (!component) {
      throw new Error("Component not found");
    }

    if (!(await canAccessUserResource(ctx, component.userId, userId))) {
      throw new Error("Unauthorized");
    }

    // Delete all children recursively
    const deleteRecursively = async (parentId: string) => {
      const children = await ctx.db
        .query("components")
        .withIndex("by_parentId", (q) => q.eq("parentId", parentId))
        .collect();

      for (const child of children) {
        await deleteRecursively(child._id);
        await ctx.db.delete(child._id);
      }
    };

    await deleteRecursively(args.componentId);
    await ctx.db.delete(args.componentId);
  },
});

export const createComponent = mutation({
  args: {
    pageId: v.string(),
    pageType: pageTypeSchema,
    parentId: v.optional(v.string()),
    type: v.string(),
    data: v.optional(v.string()),
    props: v.optional(v.record(v.string(), v.any())),
    action: v.optional(v.string()),
    actionProps: v.optional(v.any()),
    position: componentPositionSchema,
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    let contentOwnerId: Id<"users">;
    if (args.pageType === "result") {
      const result = await ctx.db.get(args.pageId as Id<"results">);
      const authorized = await requireOwnership(
        ctx,
        result,
        userId,
        "Result",
      );
      contentOwnerId = authorized.userId;
    } else {
      const page = await ctx.db.get(args.pageId as Id<"pages">);
      const authorized = await requireOwnership(
        ctx,
        page,
        userId,
        "Page",
      );
      contentOwnerId = authorized.userId;
    }

    const componentId = await ctx.db.insert("components", {
      pageId: args.pageId,
      pageType: args.pageType,
      parentId: args.parentId,
      type: args.type,
      data: args.data,
      props: args.props,
      action: args.action,
      actionProps: args.actionProps,
      position: args.position,
      userId: contentOwnerId,
    });

    return await ctx.db.get(componentId);
  },
});

export const publishQuiz = mutation({
  args: {
    id: v.id("quiz"),
  },

  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );

    if (quiz.status === "published") {
      return quiz;
    }

    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});
// Check the logged-in user,confirm that this quiz belongs to him,change the status to "published",record the publication time

export const closeQuiz = mutation({
  args: {
    id: v.id("quiz"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const quiz = await requireOwnership(
      ctx,
      await ctx.db.get(args.id),
      userId,
      "Quiz",
    );
    if (quiz.status === "closed") {
      return quiz;
    }
    await ctx.db.patch(args.id, {
      status: "closed",
      closedAt: Date.now(),
    });
    return await ctx.db.get(args.id);
  },
});
//add closeQuiz mutation to set quiz status to "closed" and record closedAt time.
