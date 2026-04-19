import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

function logQuizPlayServer(
  label: string,
  payload: Record<string, unknown>,
) {
  console.log(`[quiz-play] ${label}`, payload);
}

/**
 * Quiz Play System - No Authentication Required
 *
 * This module handles quiz playing functionality that works for:
 * - Anonymous users (no login required)
 * - Authenticated users (optional user tracking)
 *
 * All functions support anonymous access for public quiz playing.
 */

export const getQuizForPlay = query({
  args: { id: v.id("quiz") },
  handler: async (ctx, args) => {
    // Completely public - no auth check needed
    const quiz = await ctx.db.get(args.id);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Get all pages and results for the quiz using explicit ordering
    const pages = (await Promise.all(quiz.pageIds.map((pid) => ctx.db.get(pid)))).filter(Boolean);
    const results = (await Promise.all(quiz.resultIds.map((rid) => ctx.db.get(rid)))).filter(Boolean);

    return {
      ...quiz,
      pages,
      results,
    };
  },
});

export const startQuizSession = mutation({
  args: {
    quizId: v.id("quiz"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // No auth required - anyone can play quizzes
    const userId = await getAuthUserId(ctx);

    const session = await ctx.db.insert("quizSessions", {
      quizId: args.quizId,
      userId: userId || undefined, // Optional - for anonymous users
      sessionId: args.sessionId,
      currentPageIndex: 0,
      startedAt: Date.now(),
      status: "in_progress",
    });

    return session;
  },
});

export const getQuizSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      return null; // Return null instead of throwing error
    }

    return session;
  },
});

export const updateQuizSession = mutation({
  args: {
    sessionId: v.string(),
    currentPageIndex: v.number(),
    status: v.optional(
      v.union(
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("abandoned"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("quizSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Quiz session not found");
    }

    const updateData: {
      currentPageIndex: number;
      status?: typeof args.status;
      completedAt?: number;
    } = {
      currentPageIndex: args.currentPageIndex,
    };

    if (args.status) {
      updateData.status = args.status;
      if (args.status === "completed") {
        updateData.completedAt = Date.now();
      }
    }

    await ctx.db.patch(session._id, updateData);
    return await ctx.db.get(session._id);
  },
});

export const recordQuizResponse = mutation({
  args: {
    sessionId: v.string(),
    quizId: v.id("quiz"),
    pageId: v.string(),
    answerBoxId: v.string(),
    resultMapping: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const responseId = await ctx.db.insert("quizResponses", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      pageId: args.pageId,
      answerBoxId: args.answerBoxId,
      resultMapping: args.resultMapping,
      timestamp: Date.now(),
    });

    return responseId;
  },
});

export const setQuizPageResponses = mutation({
  args: {
    sessionId: v.string(),
    quizId: v.id("quiz"),
    pageId: v.string(),
    responses: v.array(
      v.object({
        answerBoxId: v.string(),
        resultMapping: v.record(v.string(), v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existingResponses = await ctx.db
      .query("quizResponses")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const pageResponses = existingResponses.filter(
      (response) =>
        response.quizId === args.quizId && response.pageId === args.pageId,
    );

    logQuizPlayServer("set-page-responses:start", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      pageId: args.pageId,
      previousResponses: pageResponses.map((response) => ({
        responseId: response._id,
        answerBoxId: response.answerBoxId,
        resultMapping: response.resultMapping,
      })),
      nextResponses: args.responses,
    });

    for (const response of pageResponses) {
      await ctx.db.delete(response._id);
    }

    const insertedIds = [];
    for (const response of args.responses) {
      const responseId = await ctx.db.insert("quizResponses", {
        sessionId: args.sessionId,
        quizId: args.quizId,
        pageId: args.pageId,
        answerBoxId: response.answerBoxId,
        resultMapping: response.resultMapping,
        timestamp: Date.now(),
      });
      insertedIds.push(responseId);
    }

    logQuizPlayServer("set-page-responses:done", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      pageId: args.pageId,
      insertedIds,
    });

    return insertedIds;
  },
});

export const getSessionResponses = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return responses;
  },
});

export const calculateQuizResults = mutation({
  args: {
    sessionId: v.string(),
    quizId: v.id("quiz"),
  },
  handler: async (ctx, args) => {
    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }

    // Calculate total scores per result page
    const totalScores: Record<string, number> = {};

    // Initialize scores in the quiz's explicit result order.
    quiz.resultIds.forEach((resultPageId) => {
      totalScores[resultPageId] = 0;
    });

    logQuizPlayServer("calculate-results:responses", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      responses: responses.map((response) => ({
        responseId: response._id,
        pageId: response.pageId,
        answerBoxId: response.answerBoxId,
        resultMapping: response.resultMapping,
      })),
      resultIds: quiz.resultIds,
    });

    // Sum up scores from all responses
    responses.forEach((response) => {
      Object.entries(response.resultMapping).forEach(
        ([resultPageId, score]) => {
          if (totalScores[resultPageId] !== undefined) {
            totalScores[resultPageId] += score;
          }
        },
      );
    });

    // Determine the winning result page.
    // On ties, the earlier resultId in quiz.resultIds wins.
    let winningResultPageId = "";
    let highestScore = -Infinity;

    quiz.resultIds.forEach((resultPageId) => {
      const score = totalScores[resultPageId] ?? 0;
      if (score > highestScore) {
        highestScore = score;
        winningResultPageId = resultPageId;
      }
    });

    logQuizPlayServer("calculate-results:totals", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      totalScores,
      winningResultPageId,
      highestScore,
    });

    const resultId = await ctx.db.insert("quizResults", {
      sessionId: args.sessionId,
      quizId: args.quizId,
      resultPageId: winningResultPageId,
      totalScores,
      completedAt: Date.now(),
    });

    return {
      resultId,
      winningResultPageId,
      totalScores,
    };
  },
});

export const getQuizResults = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("quizResults")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    return result || null;
  },
});

export const getQuizAnalytics = query({
  args: { quizId: v.id("quiz") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.userId !== userId) {
      throw new Error("Unauthorized or quiz not found");
    }

    const sessions = await ctx.db
      .query("quizSessions")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    const results = await ctx.db
      .query("quizResults")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    const responses = await ctx.db
      .query("quizResponses")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .collect();

    return {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s) => s.status === "completed")
        .length,
      abandonedSessions: sessions.filter((s) => s.status === "abandoned")
        .length,
      results,
      responses,
      sessions,
    };
  },
});
