// Server-only. Generation pipeline per SPEC.md §5 steps 2-4: generate a
// semantic plan, run a bounded critique-and-revise pass, then hand the
// result to the deterministic scheduler. Never imported from a client
// component — only from the app/api/plan/generate and app/api/plan/refine
// route handlers.

import OpenAI from "openai";
import type { ZodType } from "zod";
import { makeId } from "../utils/ids";
import {
  critiqueJsonSchema,
  critiqueResultSchema,
  llmPlanSchema,
  planJsonSchema,
  type LlmPhase,
  type LlmPlan,
  type LlmTask,
  type LlmWeek,
} from "../schemas/llm-schemas";
import { scheduleTasks } from "../calendar/scheduler";
import type { BusyBlock, Goal, Phase, Plan, Task, Week } from "../utils/types";
import {GENERATE_SYSTEM_PROMPT, REFINE_SYSTEM_PROMPT, CRITIQUE_SYSTEM_PROMPT} from "./prompts"

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (see .env.local)");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

type ChatMessage = { role: "system" | "user"; content: string };
type GoalInput = Pick<Goal, "id" | "title" | "startDate" | "targetDate" | "constraints">;

async function callStructured<T>(
  schema: ZodType<T>,
  jsonSchema: Record<string, unknown>,
  jsonSchemaName: string,
  messages: ChatMessage[],
): Promise<T> {
  const client = getClient();

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: jsonSchemaName, schema: jsonSchema, strict: true },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error(`Model returned no content for ${jsonSchemaName}`);
    }

    const parsed = schema.safeParse(JSON.parse(content));
    if (parsed.success) {
      return parsed.data;
    }

    if (attempt === 0) {
      messages = [
        ...messages,
        { role: "system", content: `Your previous response failed schema validation: ${parsed.error.message}. Try again, correcting these issues.` },
      ];
      continue;
    }

    throw new Error(`${jsonSchemaName} failed validation after retry: ${parsed.error.message}`);
  }

  throw new Error(`${jsonSchemaName}: unreachable`);
}


function buildGenerateMessages(goal: GoalInput): ChatMessage[] {
  return [
    { role: "system", content: GENERATE_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        title: goal.title,
        startDate: goal.startDate,
        targetDate: goal.targetDate ?? null,
        constraints: goal.constraints,
      }),
    },
  ];
}


function buildRefineMessages(goal: GoalInput, currentPlan: LlmPlan): ChatMessage[] {
  return [
    { role: "system", content: REFINE_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        goal: {
          title: goal.title,
          startDate: goal.startDate,
          targetDate: goal.targetDate ?? null,
          constraints: goal.constraints,
        },
        currentPlan,
      }),
    },
  ];
}

// Deterministic, not LLM judgment — same reasoning as the scheduler (§5):
// precise date-range arithmetic is exactly what LLMs are unreliable at
// self-auditing, so check it in code and hand the model a concrete list of
// violations to fix rather than trusting it to notice them unprompted.
function findDateRangeViolations(plan: LlmPlan, startDate: string, targetDate: string | null): string[] {
  const violations: string[] = [];

  for (const phase of plan.phases) {
    if (phase.startDate < startDate) {
      violations.push(`Phase "${phase.name}" starts ${phase.startDate}, before the goal's start date ${startDate}.`);
    }
    if (targetDate && phase.endDate > targetDate) {
      violations.push(`Phase "${phase.name}" ends ${phase.endDate}, after the target date ${targetDate}.`);
    }
    for (const week of phase.weeks) {
      for (const task of week.tasks) {
        if (task.preferredDate < startDate) {
          violations.push(`Task "${task.title}" is dated ${task.preferredDate}, before the start date ${startDate}.`);
        }
        if (targetDate && task.preferredDate > targetDate) {
          violations.push(`Task "${task.title}" is dated ${task.preferredDate}, after the target date ${targetDate}.`);
        }
      }
    }
  }

  return violations;
}

function buildCritiqueMessages(
  goal: GoalInput,
  draft: LlmPlan,
  programmaticallyDetectedDateIssues: string[],
): ChatMessage[] {
  return [
    { role: "system", content: CRITIQUE_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        goal: {
          title: goal.title,
          startDate: goal.startDate,
          targetDate: goal.targetDate ?? null,
          constraints: goal.constraints,
        },
        draftPlan: draft,
        programmaticallyDetectedDateIssues,
      }),
    },
  ];
}

function toDomainTask(llmTask: LlmTask): Task {
  return {
    id: makeId("task"),
    title: llmTask.title,
    description: llmTask.description ?? undefined,
    durationMinutes: llmTask.durationMinutes ?? undefined,
    type: llmTask.type,
    completed: false,
    preferredDate: llmTask.preferredDate,
    preferredDaysOfWeek: llmTask.preferredDaysOfWeek ?? undefined,
    schedulingStatus: "conflict", // placeholder; overwritten by scheduleTasks below
  };
}

function toDomainWeek(llmWeek: LlmWeek): Week {
  return {
    id: makeId("week"),
    weekNumber: llmWeek.weekNumber,
    startDate: llmWeek.startDate,
    focus: llmWeek.focus,
    tasks: llmWeek.tasks.map(toDomainTask),
  };
}

function toDomainPhase(llmPhase: LlmPhase): Phase {
  return {
    id: makeId("phase"),
    name: llmPhase.name,
    startDate: llmPhase.startDate,
    endDate: llmPhase.endDate,
    weeks: llmPhase.weeks.map(toDomainWeek),
  };
}

// The reverse direction, for feeding the current plan back into the refine
// prompt as context — strips ids/scheduling fields, same rationale as
// toDomainTask/Week/Phase: the LLM only ever sees/produces the semantic shape.
function toLlmTaskForPrompt(task: Task): LlmTask {
  return {
    title: task.title,
    description: task.description ?? null,
    durationMinutes: task.durationMinutes ?? null,
    type: task.type,
    preferredDate: task.preferredDate,
    preferredDaysOfWeek: task.preferredDaysOfWeek ?? null,
  };
}

function toLlmWeekForPrompt(week: Week): LlmWeek {
  return {
    weekNumber: week.weekNumber,
    startDate: week.startDate,
    focus: week.focus,
    tasks: week.tasks.map(toLlmTaskForPrompt),
  };
}

function toLlmPhaseForPrompt(phase: Phase): LlmPhase {
  return {
    name: phase.name,
    startDate: phase.startDate,
    endDate: phase.endDate,
    weeks: phase.weeks.map(toLlmWeekForPrompt),
  };
}

function toLlmPlanForPrompt(goal: GoalInput, plan: Plan): LlmPlan {
  return {
    summary: plan.summary,
    reaction: plan.reaction,
    assumptions: plan.assumptions,
    targetDate: goal.targetDate ?? null,
    phases: plan.phases.map(toLlmPhaseForPrompt),
  };
}

// Shared tail for both generate and refine: critique-and-revise (bounded to
// one pass), the date-range safety net, then the deterministic scheduler.
async function critiqueAndFinalize(
  goal: GoalInput,
  draft: LlmPlan,
  busyBlocks: BusyBlock[],
  version: number,
): Promise<{ plan: Plan; resolvedTargetDate?: string }> {
  const draftViolations = findDateRangeViolations(draft, goal.startDate, goal.targetDate ?? draft.targetDate ?? null);

  const critique = await callStructured(
    critiqueResultSchema,
    critiqueJsonSchema,
    "critique",
    buildCritiqueMessages(goal, draft, draftViolations),
  );

  let finalLlmPlan = !critique.approved && critique.revisedPlan ? critique.revisedPlan : draft;

  // Safety net: the critique pass is instructed to fix every listed
  // violation, but nothing forces that to actually happen. Re-check the plan
  // that's about to ship, and if problems remain, say so plainly rather than
  // silently shipping dates that contradict the plan's own stated timeline.
  const remainingViolations = findDateRangeViolations(
    finalLlmPlan,
    goal.startDate,
    goal.targetDate ?? finalLlmPlan.targetDate ?? null,
  );
  if (remainingViolations.length > 0) {
    finalLlmPlan = {
      ...finalLlmPlan,
      assumptions: [
        ...finalLlmPlan.assumptions,
        `heads up: ${remainingViolations.length} date${remainingViolations.length === 1 ? "" : "s"} might sit outside plan timeframe. say so, whimble fix.`,
      ],
    };
  }

  const phases = finalLlmPlan.phases.map(toDomainPhase);
  const allTasks = phases.flatMap((phase) => phase.weeks.flatMap((week) => week.tasks));
  const scheduled = scheduleTasks(allTasks, busyBlocks);
  const scheduledById = new Map(scheduled.map((task) => [task.id, task]));
  for (const phase of phases) {
    for (const week of phase.weeks) {
      week.tasks = week.tasks.map((task) => scheduledById.get(task.id)!);
    }
  }

  const plan: Plan = {
    id: makeId("plan"),
    goalId: goal.id,
    version,
    summary: finalLlmPlan.summary,
    reaction: finalLlmPlan.reaction,
    assumptions: finalLlmPlan.assumptions,
    phases,
    generatedAt: new Date().toISOString(),
  };

  return { plan, resolvedTargetDate: finalLlmPlan.targetDate ?? undefined };
}

export async function generatePlan(
  goal: GoalInput,
  busyBlocks: BusyBlock[],
): Promise<{ plan: Plan; resolvedTargetDate?: string }> {
  const draft = await callStructured(llmPlanSchema, planJsonSchema, "plan", buildGenerateMessages(goal));
  return critiqueAndFinalize(goal, draft, busyBlocks, 1);
}

export async function refinePlan(
  goal: GoalInput,
  currentPlan: Plan,
  busyBlocks: BusyBlock[],
): Promise<{ plan: Plan; resolvedTargetDate?: string }> {
  const currentLlmPlan = toLlmPlanForPrompt(goal, currentPlan);
  const draft = await callStructured(
    llmPlanSchema,
    planJsonSchema,
    "plan",
    buildRefineMessages(goal, currentLlmPlan),
  );
  return critiqueAndFinalize(goal, draft, busyBlocks, currentPlan.version + 1);
}
