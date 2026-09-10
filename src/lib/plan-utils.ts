import { parseISODateTime, toISODate } from "./date-utils";
import type { Plan, Task } from "./types";

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
