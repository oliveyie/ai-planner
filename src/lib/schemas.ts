// zod schemas mirroring src/lib/types.ts (SPEC.md §4).
// Not used for LLM structured-output validation yet (that lands in build-order step 3) —
// written now so the shape is defined once and reused there.

import { z } from "zod";

export const taskTypeSchema = z.enum(["task", "milestone", "review", "rest", "other"]);

export const schedulingStatusSchema = z.enum(["scheduled", "conflict"]);

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  durationMinutes: z.number().optional(),
  type: taskTypeSchema,
  completed: z.boolean(),

  preferredDate: z.string(),
  preferredDaysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),

  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  schedulingStatus: schedulingStatusSchema,

  syncedEventId: z.string().optional(),
  syncedProvider: z.enum(["google", "microsoft"]).optional(),
});

export const weekSchema = z.object({
  id: z.string(),
  weekNumber: z.number().int(),
  startDate: z.string(),
  focus: z.string(),
  tasks: z.array(taskSchema),
});

export const phaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  weeks: z.array(weekSchema),
});

export const planSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  version: z.number().int(),
  summary: z.string(),
  assumptions: z.array(z.string()),
  phases: z.array(phaseSchema),
  generatedAt: z.string(),
});

export const goalSchema = z.object({
  id: z.string(),
  title: z.string(),
  targetDate: z.string().optional(),
  startDate: z.string(),
  constraints: z.array(z.string()),
  status: z.enum(["active", "published"]),
  createdAt: z.string(),
});

export const calendarProviderSchema = z.enum(["google", "microsoft"]);

export const calendarConnectionSchema = z.object({
  provider: calendarProviderSchema,
  connectedAt: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.string(),
});

export const busyBlockSchema = z.object({
  start: z.string(),
  end: z.string(),
  source: calendarProviderSchema,
});

export const chatMessageSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
  resultingPlanVersion: z.number().int().optional(),
});
