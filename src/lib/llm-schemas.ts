// Schemas for what the LLM actually produces (SPEC.md §5 steps 2-3) — a
// semantic subset of the full domain model in src/lib/types.ts. Ids,
// `completed`, and the scheduling outcome (scheduledStart/End,
// schedulingStatus, googleEventId) are filled in server-side after parsing,
// never requested from the model: those are exactly the fields the scheduler
// (src/lib/scheduler.ts) is responsible for, deterministically.
//
// Two representations of the same shape live here on purpose:
// - zod schemas, for runtime validation of the parsed response.
// - hand-written JSON Schema, for OpenAI's strict structured-output mode,
//   which has stricter rules (every property required, optional fields
//   expressed as nullable, additionalProperties: false everywhere) than a
//   generic zod-to-JSON-schema conversion would produce.

import { z } from "zod";

export const llmTaskSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().nullable(),
  type: z.enum(["task", "milestone", "review", "rest", "other"]),
  preferredDate: z.string(),
  preferredDaysOfWeek: z.array(z.number().int().min(0).max(6)).nullable(),
});

export const llmWeekSchema = z.object({
  weekNumber: z.number().int(),
  startDate: z.string(),
  focus: z.string(),
  tasks: z.array(llmTaskSchema),
});

export const llmPhaseSchema = z.object({
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  weeks: z.array(llmWeekSchema),
});

export const llmPlanSchema = z.object({
  summary: z.string(),
  assumptions: z.array(z.string()),
  targetDate: z
    .string()
    .nullable()
    .describe("Only non-null if the goal didn't supply one and you had to estimate it."),
  phases: z.array(llmPhaseSchema),
});

export type LlmTask = z.infer<typeof llmTaskSchema>;
export type LlmWeek = z.infer<typeof llmWeekSchema>;
export type LlmPhase = z.infer<typeof llmPhaseSchema>;
export type LlmPlan = z.infer<typeof llmPlanSchema>;

export const critiqueResultSchema = z.object({
  approved: z.boolean(),
  notes: z.array(z.string()),
  revisedPlan: llmPlanSchema.nullable(),
});

export type CritiqueResult = z.infer<typeof critiqueResultSchema>;

const taskJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: ["string", "null"] },
    durationMinutes: { type: ["number", "null"] },
    type: { type: "string", enum: ["task", "milestone", "review", "rest", "other"] },
    preferredDate: { type: "string", description: "ISO date, YYYY-MM-DD" },
    preferredDaysOfWeek: {
      type: ["array", "null"],
      items: { type: "integer", minimum: 0, maximum: 6 },
      description: "0 = Sunday .. 6 = Saturday. Only set when a constraint restricts this task to specific days.",
    },
  },
  required: ["title", "description", "durationMinutes", "type", "preferredDate", "preferredDaysOfWeek"],
  additionalProperties: false,
} as const;

const weekJsonSchema = {
  type: "object",
  properties: {
    weekNumber: { type: "integer" },
    startDate: { type: "string", description: "ISO date, YYYY-MM-DD" },
    focus: { type: "string" },
    tasks: { type: "array", items: taskJsonSchema },
  },
  required: ["weekNumber", "startDate", "focus", "tasks"],
  additionalProperties: false,
} as const;

const phaseJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    startDate: { type: "string", description: "ISO date, YYYY-MM-DD" },
    endDate: { type: "string", description: "ISO date, YYYY-MM-DD" },
    weeks: { type: "array", items: weekJsonSchema },
  },
  required: ["name", "startDate", "endDate", "weeks"],
  additionalProperties: false,
} as const;

export const planJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    targetDate: {
      type: ["string", "null"],
      description: "ISO date. Only non-null if the goal didn't supply one and you had to estimate it.",
    },
    phases: { type: "array", items: phaseJsonSchema },
  },
  required: ["summary", "assumptions", "targetDate", "phases"],
  additionalProperties: false,
} as const;

export const critiqueJsonSchema = {
  type: "object",
  properties: {
    approved: { type: "boolean" },
    notes: { type: "array", items: { type: "string" } },
    revisedPlan: { anyOf: [planJsonSchema, { type: "null" }] },
  },
  required: ["approved", "notes", "revisedPlan"],
  additionalProperties: false,
} as const;
