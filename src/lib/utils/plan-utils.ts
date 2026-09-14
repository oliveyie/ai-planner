import { parseISODateTime, toISODate } from "./date-utils";
import type { BusyBlock, Plan, Task } from "./types";

// Short status message for the Mr. Whimble chat box. The plan's own summary
// + phase/step breakdown is shown in PlanSummaryCard instead (built from the
// same `plan` data, so it can never drift) — this is just Whimble's reaction
// to *this* plan (LLM-written per-plan, not a hardcoded line — see
// plan-rules.ts §12 and whimble-voice.ts) plus any assumptions the user might
// want to correct. `plan.reaction` falls back to a generic line for any plan
// generated before this field existed.
export function buildPlanChatMessage(plan: Plan): string {
  const lines = [plan.reaction || "calendar's ready. look below."];

  if (plan.assumptions.length > 0) {
    lines.push("", ...plan.assumptions);
  }

  return lines.join("\n");
}

export function flattenTasks(plan: Plan): Task[] {
  return plan.phases.flatMap((phase) => phase.weeks.flatMap((week) => week.tasks));
}

// Immutably rebuilds a Plan with some tasks replaced (matched by id) — used
// wherever a task needs new fields written back into the nested phase/week
// structure (e.g. push-to-calendar setting syncedEventId) without touching
// tasks that weren't updated.
export function mapPlanTasks(plan: Plan, updates: Map<string, Task>): Plan {
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      weeks: phase.weeks.map((week) => ({
        ...week,
        tasks: week.tasks.map((task) => updates.get(task.id) ?? task),
      })),
    })),
  };
}

// Sibling to mapPlanTasks: same immutable phases→weeks→tasks rebuild, but
// removes the task instead of replacing it — used by the plan card's manual
// task deletion (a local edit, not an LLM regeneration).
export function removeTaskFromPlan(plan: Plan, taskId: string): Plan {
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      weeks: phase.weeks.map((week) => ({
        ...week,
        tasks: week.tasks.filter((task) => task.id !== taskId),
      })),
    })),
  };
}

// For the plan card's task list only (PlanSummaryCard, PlannerApp's drag
// handler) — NOT for the calendar (taskDateKey/groupTasksByDate below),
// which must always reflect real time regardless of manual reordering.
// `order` (set only by dragging to reorder in the list) sorts first when
// present; every explicitly-ordered task sorts before every task that
// hasn't been touched yet, which then falls back to its actual scheduled
// time — so a freshly generated plan (no manual reordering yet) displays
// exactly as before.
export function taskSortKey(task: Task): string {
  if (task.order !== undefined) {
    return `0:${String(task.order).padStart(10, "0")}`;
  }
  return `1:${task.scheduledStart ?? `${task.preferredDate}T99:99`}`;
}

export function taskDateKey(task: Task): string {
  if (task.scheduledStart) {
    return toISODate(parseISODateTime(task.scheduledStart));
  }
  return task.preferredDate;
}

export function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = taskDateKey(task);
    const list = map.get(key);
    if (list) {
      list.push(task);
    } else {
      map.set(key, [task]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""));
  }
  return map;
}

// BusyBlock times are real ISO 8601 datetimes from an external provider
// (with an offset/Z), unlike this app's own local-only date-utils format —
// parsed with the native Date constructor, same rationale as scheduler.ts.
export function groupBusyBlocksByDate(blocks: BusyBlock[]): Map<string, BusyBlock[]> {
  const map = new Map<string, BusyBlock[]>();
  for (const block of blocks) {
    const key = toISODate(new Date(block.start));
    const list = map.get(key);
    if (list) {
      list.push(block);
    } else {
      map.set(key, [block]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }
  return map;
}
