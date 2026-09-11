// Server-only. Generation pipeline per SPEC.md §5 steps 2-4: generate a
// semantic plan, run a bounded critique-and-revise pass, then hand the
// result to the deterministic scheduler. Never imported from a client
// component — only from the app/api/plan/generate and app/api/plan/refine
// route handlers.

import OpenAI from "openai";
import type { ZodType } from "zod";
import { makeId } from "./ids";
import {
  critiqueJsonSchema,
  critiqueResultSchema,
  llmPlanSchema,
  planJsonSchema,
  type LlmPhase,
  type LlmPlan,
  type LlmTask,
  type LlmWeek,
} from "./llm-schemas";
import { scheduleTasks } from "./scheduler";
import type { BusyBlock, Goal, Phase, Plan, Task, Week } from "./types";

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

// Shared between the initial generation prompt and the refine prompt, so the
// two paths can never drift on things like date-range rules.
const PLAN_RULES = `Rules:
- All dates are ISO strings, "YYYY-MM-DD".
- Honor every constraint listed, exactly.
- If the goal did not specify a target date, estimate a reasonable one from context (typical timelines for this kind of goal) and put it in "targetDate". If the goal did specify one, set "targetDate" to null.
- Date consistency is a hard requirement, not a suggestion: every phase's startDate/endDate and every task's preferredDate MUST fall between the goal's startDate and your chosen targetDate (inclusive), with no exceptions. Before responding, check this yourself: does your last phase's endDate line up with targetDate, and does every date you wrote actually fall inside that span? If your "summary" states a duration (e.g. "3 months"), the actual dates you produce must match that duration — don't let phases drift past what you just said the timeline was.
- Record anything you had to assume due to missing information (target date, experience level, availability, etc.) in "assumptions", each phrased as an invitation for the user to correct it rather than a caveat — e.g. "Assumed a beginner starting point — tell me your current level and I can tailor this further."
- Use the "type" field on each task appropriately: "task" for a normal concrete activity, "milestone" for a fixed checkpoint/deadline, "review" for a periodic check-in, "rest" for a deliberate break.
- Only set "preferredDaysOfWeek" on a task when a constraint specifically restricts which days it can happen on.`;

const GENERATE_SYSTEM_PROMPT = `You are a planning assistant. Given a high-level goal, produce a phased, dated plan broken into concrete tasks that could be placed on a calendar.

The goal can be about anything: fitness, a creative or technical project, learning a skill, career, or something else entirely. Do not assume it is fitness-related unless the goal itself implies that. Choose phase names, week focuses, and task titles appropriate to this specific goal — for example, "Research"/"Prototype"/"Polish" for a project, "Fundamentals"/"Practice"/"Refinement" for a skill, or training-specific phases for a fitness goal. Never reuse fitness vocabulary for a non-fitness goal.

${PLAN_RULES}`;

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

const REFINE_SYSTEM_PROMPT = `You are updating an existing plan based on new feedback from the user, for the same goal as before (never assume it's fitness-related unless it actually is).

You will receive the goal, the full ordered list of constraints the user has given so far (including the newest one), and the current plan. Produce an updated plan that satisfies every constraint while changing as little else as possible — keep phase names, structure, and any unaffected tasks the same where the new constraint doesn't require touching them.

${PLAN_RULES}`;

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

const CRITIQUE_SYSTEM_PROMPT = `You are reviewing a generated plan for quality before it is shown to the user. Check, in this order:

1. Date-range correctness — a hard requirement, not a judgment call. The user message includes "programmaticallyDetectedDateIssues": a list computed in code, not by you. If it is non-empty, you MUST set approved: false and return a revisedPlan that fixes every single listed issue (adjust phase/week/task dates so everything fits within the goal's actual startDate..targetDate span — compress or restructure phases as needed), even if nothing else about the plan is wrong. Do not second-guess or ignore this list; it is ground truth.
2. Internal consistency — does the plan's own prose (summary, assumptions) match the actual dates used? (e.g. don't say "3 months" if the phases actually span a year.)
3. Does the phase/week/task structure genuinely fit this specific goal, rather than reading like a generic or fitness-flavored template applied to a non-fitness goal?
4. Are task durations and cadence reasonable for this kind of goal?
5. Were all of the goal's constraints actually honored?

If everything looks right (including an empty programmaticallyDetectedDateIssues list), respond with approved: true, empty notes, and revisedPlan: null.
Otherwise respond with approved: false, a brief explanation in notes, and a corrected full plan in revisedPlan that fixes every issue found (same schema as the draft plan).`;

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
        `Note: ${remainingViolations.length} task/phase date${remainingViolations.length === 1 ? "" : "s"} may fall outside the intended timeframe and weren't fully corrected — let me know if you'd like specific dates adjusted.`,
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
