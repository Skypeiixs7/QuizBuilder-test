import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import {
  componentSchema,
  pageBackgroundSchema,
  componentPositionSchema,
  pageTypeSchema,
} from "./schemas";

export default defineSchema({
  ...authTables,
  // Extend auth `users` with a handle chosen at email/password sign-up (Convex Auth pattern).
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("username", ["username"])
    .index("by_role", ["role"]),

  // Application tables
  quiz: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
    // Explicit references to pages/results for ordering
    pageIds: v.array(v.id("pages")),
    resultIds: v.array(v.id("results")),
    onboardingPageId: v.optional(v.id("pages")),
    nextPageNumber: v.optional(v.number()),
    nextResultNumber: v.optional(v.number()),

    status: v.union(
    v.literal("draft"),
    v.literal("published"),
    v.literal("closed")
  ),
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  //Added status field to the quiz table to track the lifecycle state of each quiz.
  }).index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // Pages table - stores individual quiz pages and onboarding pages (without embedded components)
  pages: defineTable({
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    userId: v.id("users"),
    // Page type: "page" for quiz pages, "onboarding" for onboarding page
    pageType: v.optional(v.union(v.literal("page"), v.literal("onboarding"))),
    questionMode: v.optional(
      v.union(
        v.literal("single"),
        v.literal("multiple")
      )
    ),
  })
    .index("by_quizId", ["quizId"])
    .index("by_userId", ["userId"]),

  // Results table - stores quiz result pages (without embedded components)
  results: defineTable({
    quizId: v.id("quiz"),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    userId: v.id("users"),
  })
    .index("by_quizId", ["quizId"])
    .index("by_userId", ["userId"]),

  // Components table - stores individual components with position data
  components: defineTable({
    // Reference to the page this component belongs to
    pageId: v.string(), // Can be pages, results, or onboardingPages ID
    pageType: pageTypeSchema, // "page", "result", or "onboarding"

    // Parent component ID (null for root-level components)
    parentId: v.optional(v.string()),

    // Component data
    type: v.string(), // "image" | "text" | "shape" | "group"
    data: v.optional(v.string()),
    props: v.optional(v.record(v.string(), v.any())),
    action: v.optional(v.string()),
    actionProps: v.optional(v.any()),

    // For group components: array of child components with relative positions
    children: v.optional(v.array(v.any())),

    // Position relative to parent container (percentages 0-100)
    position: componentPositionSchema,

    // Owner
    userId: v.id("users"),
  })
    .index("by_pageId", ["pageId"])
    .index("by_parentId", ["parentId"])
    .index("by_userId", ["userId"]),

  images: defineTable({
    name: v.string(),
    userId: v.id("users"),
    storageId: v.id("_storage"), // Convex file storage reference
    format: v.optional(v.string()),
    size: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  // Quiz sessions table - track user progress through quizzes
  quizSessions: defineTable({
    quizId: v.id("quiz"),
    userId: v.optional(v.id("users")), // Optional for anonymous users
    sessionId: v.string(), // Unique session identifier
    currentPageIndex: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("abandoned"),
    ),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_quizId", ["quizId"])
    .index("by_userId", ["userId"]),

  // Quiz responses table - individual answer selections
  quizResponses: defineTable({
    sessionId: v.string(),
    quizId: v.id("quiz"),
    pageId: v.string(),
    answerBoxId: v.string(),
    resultMapping: v.record(v.string(), v.number()), // The scoring applied
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_quizId", ["quizId"]),

  // Quiz results table - final calculated results
  quizResults: defineTable({
    sessionId: v.string(),
    quizId: v.id("quiz"),
    resultPageId: v.string(),
    totalScores: v.record(v.string(), v.number()), // Final scores per result page
    completedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_quizId", ["quizId"]),

  // Templates table - stores page templates for quiz, result, and onboarding pages
  templates: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    components: v.array(componentSchema),
    templateType: v.union(
      v.literal("quiz"),
      v.literal("result"),
      v.literal("onboarding"),
    ),
    userId: v.id("users"),
  })
    .index("by_templateType", ["templateType"])
    .index("by_userId", ["userId"])
    .index("by_userId_templateType", ["userId", "templateType"]),
});
