// Hand-authored seed plan for build-order step 1 (SPEC.md / TASKS.md).
// No LLM involved — this is the fixture the calendar shell renders before
// generation exists (that's step 3).

import { addDays, startOfWeek, toISODate, toISODateTime } from "../date-utils";
import { makeId } from "../ids";
import type { Goal, Phase, Plan, Task, TaskType, Week } from "../types";

function scheduledTask(params: {
  weekStart: Date;
  dayOffset: number; // 0 = Sunday .. 6 = Saturday
  startHour: number;
  durationMinutes?: number;
  title: string;
  type: TaskType;
  description?: string;
}): Task {
  const date = addDays(params.weekStart, params.dayOffset);
  const start = new Date(date);
  start.setHours(params.startHour, 0, 0, 0);
  const end = params.durationMinutes
    ? new Date(start.getTime() + params.durationMinutes * 60_000)
    : undefined;

  return {
    id: makeId("task"),
    title: params.title,
    description: params.description,
    durationMinutes: params.durationMinutes,
    type: params.type,
    completed: false,
    preferredDate: toISODate(date),
    scheduledStart: toISODateTime(start),
    scheduledEnd: end ? toISODateTime(end) : undefined,
    schedulingStatus: "scheduled",
  };
}

export function createExampleGoalAndPlan(referenceDate: Date): { goal: Goal; plan: Plan } {
  const week1Start = startOfWeek(referenceDate);
  const week2Start = addDays(week1Start, 7);
  const week3Start = addDays(week1Start, 14);

  const week1: Week = {
    id: makeId("week"),
    weekNumber: 1,
    startDate: toISODate(week1Start),
    focus: "Building the habit",
    tasks: [
      scheduledTask({ weekStart: week1Start, dayOffset: 1, startHour: 7, title: "Rest day", type: "rest" }),
      scheduledTask({
        weekStart: week1Start,
        dayOffset: 2,
        startHour: 6,
        durationMinutes: 30,
        title: "Easy run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week1Start,
        dayOffset: 4,
        startHour: 6,
        durationMinutes: 30,
        title: "Easy run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week1Start,
        dayOffset: 6,
        startHour: 8,
        durationMinutes: 60,
        title: "Long run",
        type: "task",
        description: "Easy pace, conversational effort.",
      }),
    ],
  };

  const week2: Week = {
    id: makeId("week"),
    weekNumber: 2,
    startDate: toISODate(week2Start),
    focus: "Adding volume",
    tasks: [
      scheduledTask({ weekStart: week2Start, dayOffset: 1, startHour: 7, title: "Rest day", type: "rest" }),
      scheduledTask({
        weekStart: week2Start,
        dayOffset: 2,
        startHour: 6,
        durationMinutes: 35,
        title: "Easy run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week2Start,
        dayOffset: 4,
        startHour: 6,
        durationMinutes: 35,
        title: "Easy run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week2Start,
        dayOffset: 6,
        startHour: 8,
        durationMinutes: 75,
        title: "Long run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week2Start,
        dayOffset: 0,
        startHour: 18,
        durationMinutes: 15,
        title: "Weekly check-in",
        type: "review",
        description: "How did the week feel? Adjust next week if needed.",
      }),
    ],
  };

  const week3: Week = {
    id: makeId("week"),
    weekNumber: 3,
    startDate: toISODate(week3Start),
    focus: "Peak mileage",
    tasks: [
      scheduledTask({ weekStart: week3Start, dayOffset: 1, startHour: 7, title: "Rest day", type: "rest" }),
      scheduledTask({
        weekStart: week3Start,
        dayOffset: 2,
        startHour: 6,
        durationMinutes: 40,
        title: "Easy run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week3Start,
        dayOffset: 4,
        startHour: 6,
        durationMinutes: 40,
        title: "Easy run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week3Start,
        dayOffset: 6,
        startHour: 8,
        durationMinutes: 90,
        title: "Long run",
        type: "task",
      }),
      scheduledTask({
        weekStart: week3Start,
        dayOffset: 0,
        startHour: 8,
        durationMinutes: 50,
        title: "Tune-up 10K race",
        type: "milestone",
        description: "A race-pace effort to gauge fitness before the next block.",
      }),
    ],
  };

  const phase1: Phase = {
    id: makeId("phase"),
    name: "Base Building",
    startDate: week1.startDate,
    endDate: week2.startDate,
    weeks: [week1, week2],
  };

  const phase2: Phase = {
    id: makeId("phase"),
    name: "Peak",
    startDate: week3.startDate,
    endDate: toISODate(addDays(week3Start, 6)),
    weeks: [week3],
  };

  const goalId = makeId("goal");
  const now = new Date().toISOString();

  const goal: Goal = {
    id: goalId,
    title: "Run the Seattle Marathon",
    startDate: toISODate(week1Start),
    constraints: [],
    status: "active",
    createdAt: now,
  };

  const plan: Plan = {
    id: makeId("plan"),
    goalId,
    version: 1,
    summary:
      "A 3-week sample training block — base building into a peak week with a tune-up race.",
    assumptions: [
      "This is a hand-authored example plan seeded locally, not LLM-generated (build-order step 1 in SPEC.md).",
    ],
    phases: [phase1, phase2],
    generatedAt: now,
  };

  return { goal, plan };
}
