import { parseISODateTime, toISODate } from "./date-utils";
import type { Plan, Task } from "./types";

// Deterministic (not LLM-generated) prose outline of an already-generated
// plan, for the chat transcript shown before the calendar (see the "reveal
// order" decision in SPEC.md). Built from the same data the calendar renders,
// so it can never describe something different from what's actually
// scheduled — no extra LLM call, no risk of drift.
export function buildPlanOutlineMessage(plan: Plan): string {
  const phaseLines = plan.phases.map((phase) => {
    const weekCount = phase.weeks.length;
    return `- ${phase.name} (${phase.startDate} to ${phase.endDate}, ${weekCount} week${weekCount === 1 ? "" : "s"})`;
  });

  const lines = [plan.summary, "", "Phases:", ...phaseLines];

  if (plan.assumptions.length > 0) {
    lines.push("", ...plan.assumptions);
  }

  lines.push("", "I've laid it out on the calendar below.");

  return lines.join("\n");
}

export function flattenTasks(plan: Plan): Task[] {
  return plan.phases.flatMap((phase) => phase.weeks.flatMap((week) => week.tasks));
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
