// Deterministic scheduling pass (SPEC.md §5 step 4). Takes tasks with a
// `preferredDate` (and optional `preferredDaysOfWeek`) and places each into
// an actual free slot against real busy blocks — deliberately not the LLM's
// job, since precise slot-fitting is exactly the kind of arithmetic LLMs are
// unreliable at.
//
// Busy blocks come from an external API (Google's freebusy, once step 2
// exists) and carry real ISO 8601 datetimes with offsets — parsed with the
// native `Date` constructor, not this app's simplified local-only
// date-utils parser, which is intended only for the datetimes this app
// produces and consumes itself (task titles/times).

import { addDays, startOfWeek, toISODateTime } from "./date-utils";
import type { BusyBlock, Task } from "./types";

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 21;
const STEP_MINUTES = 15;
const DEFAULT_DURATION_MINUTES = 30;

type Interval = { start: Date; end: Date };

function findSlotOnDate(date: Date, durationMinutes: number, occupied: Interval[]): Interval | null {
  const dayStart = new Date(date);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const durationMs = durationMinutes * 60_000;
  const stepMs = STEP_MINUTES * 60_000;

  for (let t = dayStart.getTime(); t + durationMs <= dayEnd.getTime(); t += stepMs) {
    const start = new Date(t);
    const end = new Date(t + durationMs);
    const overlaps = occupied.some((slot) => start < slot.end && end > slot.start);
    if (!overlaps) return { start, end };
  }
  return null;
}

function candidateDatesForTask(task: Task, preferredDate: Date): Date[] {
  const weekStart = startOfWeek(preferredDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allowed =
    task.preferredDaysOfWeek && task.preferredDaysOfWeek.length > 0
      ? weekDates.filter((d) => task.preferredDaysOfWeek!.includes(d.getDay()))
      : weekDates;

  return [...allowed].sort(
    (a, b) => Math.abs(a.getTime() - preferredDate.getTime()) - Math.abs(b.getTime() - preferredDate.getTime()),
  );
}

export function scheduleTasks(tasks: Task[], busyBlocks: BusyBlock[]): Task[] {
  const occupied: Interval[] = busyBlocks.map((block) => ({
    start: new Date(block.start),
    end: new Date(block.end),
  }));

  // Sort by preferred date so earlier tasks claim slots first, and so tasks
  // scheduled earlier in this pass become part of `occupied` for later ones
  // (two tasks landing on the same day must not double-book each other).
  const ordered = [...tasks].sort((a, b) => a.preferredDate.localeCompare(b.preferredDate));

  const scheduledById = new Map<string, Task>();

  for (const task of ordered) {
    const durationMinutes = task.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    const preferredDate = new Date(`${task.preferredDate}T00:00`);
    const candidates = candidateDatesForTask(task, preferredDate);

    let slot: Interval | null = null;
    for (const candidate of candidates) {
      slot = findSlotOnDate(candidate, durationMinutes, occupied);
      if (slot) break;
    }

    if (slot) {
      occupied.push(slot);
      scheduledById.set(task.id, {
        ...task,
        // toISODateTime, not toISOString: this app's task times are stored
        // and parsed as local wall-clock strings (see date-utils.ts), not UTC.
        scheduledStart: toISODateTime(slot.start),
        scheduledEnd: toISODateTime(slot.end),
        schedulingStatus: "scheduled",
      });
    } else {
      scheduledById.set(task.id, {
        ...task,
        scheduledStart: undefined,
        scheduledEnd: undefined,
        schedulingStatus: "conflict",
      });
    }
  }

  return tasks.map((task) => scheduledById.get(task.id)!);
}
