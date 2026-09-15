// Data model per SPEC.md §4.

export type Goal = {
  id: string;
  title: string;
  targetDate?: string; // ISO date
  startDate: string; // ISO date
  constraints: string[];
  status: "active" | "published" | "archived";
  createdAt: string;

  // Set the first time a plan is pushed to a given provider; reused on every
  // later push so a goal always has at most one dedicated calendar per provider.
  externalCalendarIds?: Partial<Record<"google" | "microsoft", string>>;
  // Every event id currently live on each provider for this goal, from the
  // most recent push — compared against the new set on each push so events
  // for tasks that no longer exist (e.g. after a refine) get deleted.
  syncedEventIds?: Partial<Record<"google" | "microsoft", string[]>>;
};

export type Plan = {
  id: string;
  goalId: string;
  version: number;
  shortTitle: string;
  summary: string;
  reaction: string;
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

  // Manual display-order override for the plan card's task list, set only by
  // dragging to reorder there (PlannerApp.handleTaskDragEnd) — deliberately
  // independent of scheduledStart/preferredDate, so reordering the list never
  // touches a task's actual time. Absent until a task in its phase has been
  // manually reordered at least once; see plan-utils.ts's taskSortKey.
  order?: number;

  syncedEventId?: string;
  syncedProvider?: "google" | "microsoft";
};

export type CalendarProvider = "google" | "microsoft";

export type CalendarConnection = {
  provider: CalendarProvider;
  connectedAt: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string; // ISO datetime; past this, accessToken must be refreshed before use.
  displayName?: string; // from the provider's profile endpoint; absent for connections made before this field existed
};

export type BusyBlock = {
  start: string; // ISO datetime
  end: string; // ISO datetime
  source: CalendarProvider;
  title?: string; // the real event title, read from the connected calendar
  calendarId: string; // which specific calendar within the provider this came from (a provider can have several)
  calendarName: string; // display name for the legend, e.g. "Work", "Personal"
  color: string; // hex — the user's own color for that calendar where the provider exposes one, else a deterministic fallback
};

export type ChatMessage = {
  id: string;
  goalId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  resultingPlanVersion?: number;
};
