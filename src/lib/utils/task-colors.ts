import type { TaskType } from "./types";

// All plan tasks render in one unified color on the calendar (Week/Month/
// Agenda), rather than one color per TaskType — keeps the calendar legend to
// a single "Plan" entry instead of a 5-color breakdown. Reuses the app's own
// coral brand accent so a plan task reads as distinctly "yours", unlike a
// synced calendar's own real (usually pastel) color.
export const PLAN_TASK_COLOR = "#ff7b54";

// Two states, keyed off Task.syncedEventId (set once a task is pushed to a
// connected calendar): a "draft" task — generated but not yet pushed
// anywhere — gets a bold, high-contrast treatment so it doesn't blend into
// the calendar's cream background; once it's synced (a real calendar
// commitment now exists elsewhere) it settles into a calmer, more muted
// look, freeing "bold" to mean "still needs your attention."
export const PLAN_TASK_CHIP_DRAFT_CLASS = "border-2 border-coral bg-coral/90 text-white shadow-sm";
export const PLAN_TASK_CHIP_SYNCED_CLASS = "border-coral/20 bg-peach/70 text-peach-dark";
// Kept for any caller that doesn't distinguish draft/synced.
export const PLAN_TASK_CHIP_CLASS = "border-coral/30 bg-peach text-peach-dark";

// Still used for the text-labeled type badges in PlanSummaryCard — those are
// self-labeled (the pill says "Milestone"), so a distinct color per type
// there doesn't need a legend to decode.
export const TASK_TYPE_STYLES: Record<TaskType, { chip: string; label: string }> = {
  task: {
    chip: "border-sky-dark/20 bg-sky/80 text-sky-dark",
    label: "Task",
  },
  milestone: {
    chip: "border-peach-dark/20 bg-peach/90 text-peach-dark",
    label: "Milestone",
  },
  review: {
    chip: "border-lavender-dark/20 bg-lavender/80 text-lavender-dark",
    label: "Review",
  },
  rest: {
    chip: "border-sage-dark/20 bg-sage/80 text-sage-dark",
    label: "Rest",
  },
  other: {
    chip: "border-buttercup-dark/20 bg-buttercup/90 text-buttercup-dark",
    label: "Other",
  },
};
