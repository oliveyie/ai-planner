import { parseISODateTime, toISODate } from "./date-utils";
import type { BusyBlock, Plan, Task } from "./types";

// Deterministic (not LLM-generated) short status line for the Mr. Whimble
// chat box. The plan's own summary + phase/step breakdown is shown in
// PlanSummaryCard instead (built from the same `plan` data, so it can never
// drift) — this is just the "done" ping plus any assumptions the user might
// want to correct, in Whimble's voice (see whimble-voice.ts).
export function buildPlanChatMessage(plan: Plan): string {
  const lines = ["calendar's ready. look below."];

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
