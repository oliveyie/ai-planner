import type { TaskType } from "./types";

// All plan tasks render in one unified color on the calendar (Week/Month/
// Agenda), rather than one color per TaskType — keeps the calendar legend to
// a single "Plan" entry instead of a 5-color breakdown. Reuses the app's own
// coral brand accent so a plan task reads as distinctly "yours", unlike a
// synced calendar's own real (usually pastel) color.
export const PLAN_TASK_COLOR = "#ff7b54";
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
