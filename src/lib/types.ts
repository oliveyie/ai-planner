// Data model per SPEC.md §4.

export type Goal = {
  id: string;
  title: string;
  targetDate?: string; // ISO date
  startDate: string; // ISO date
  constraints: string[];
  status: "active" | "published";
  createdAt: string;
};

export type Plan = {
  id: string;
  goalId: string;
  version: number;
  summary: string;
  assumptions: string[];
  phases: Phase[];
  generatedAt: string;
};

export type Phase = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeks: Week[];
};

export type Week = {
  id: string;
  weekNumber: number;
  startDate: string;
  focus: string;
  tasks: Task[];
};

export type TaskType = "task" | "milestone" | "review" | "rest" | "other";

export type SchedulingStatus = "scheduled" | "conflict";

export type Task = {
  id: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  type: TaskType;
  completed: boolean;

  preferredDate: string; // ISO date
  preferredDaysOfWeek?: number[]; // 0 = Sunday

  scheduledStart?: string; // ISO datetime
  scheduledEnd?: string; // ISO datetime
  schedulingStatus: SchedulingStatus;

  googleEventId?: string;
};

export type CalendarConnection = {
  provider: "google";
  connectedAt: string;
};

export type BusyBlock = {
  start: string; // ISO datetime
  end: string; // ISO datetime
  source: "google";
};

export type ChatMessage = {
  id: string;
  goalId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  resultingPlanVersion?: number;
};
