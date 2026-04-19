import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { componentSchema, pageBackgroundSchema } from "./schemas";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Must be logged in");
  return userId;
}

/**
 * Get all templates filtered by type
 */
export const getTemplates = query({
  args: {
    templateType: v.union(
      v.literal("quiz"),
      v.literal("result"),
      v.literal("onboarding"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("templates")
      .withIndex("by_userId_templateType", (q) =>
        q.eq("userId", userId).eq("templateType", args.templateType),
      )
      .collect();
  },
});

/**
 * Get a single template by ID
 */
export const getTemplate = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get all templates
 */
export const getAllTemplates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("templates")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Create a new template
 */
export const createTemplate = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.insert("templates", {
      title: args.title,
      description: args.description,
      pageName: args.pageName,
      background: args.background,
      components: args.components,
      templateType: args.templateType,
      userId,
    });
  },
});

/**
 * Update a template
 */
export const updateTemplate = mutation({
  args: {
    id: v.id("templates"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    pageName: v.optional(v.string()),
    background: v.optional(pageBackgroundSchema),
    components: v.optional(v.array(componentSchema)),
    templateType: v.optional(
      v.union(
        v.literal("quiz"),
        v.literal("result"),
        v.literal("onboarding"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Template not found");
    }
    await ctx.db.patch(id, updates);
    return id;
  },
});

/**
 * Delete a template
 */
export const deleteTemplate = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.delete(args.id);
  },
});

/**
 * Set template components
 */
export const setTemplateComponents = mutation({
  args: {
    id: v.id("templates"),
    components: v.array(componentSchema),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const template = await ctx.db.get(args.id);
    if (!template) {
      throw new Error("Template not found");
    }
    await ctx.db.patch(args.id, { components: args.components });
  },
});
