import type { TaskType } from "./types";

// Shared between TaskChip and CalendarShell's legend so the two can't drift.
export const TASK_TYPE_STYLES: Record<TaskType, { chip: string; dot: string; label: string }> = {
  task: {
    chip: "border-sky-dark/20 bg-sky/80 text-sky-dark",
    dot: "bg-sky-dark/70",
    label: "Task",
  },
  milestone: {
    chip: "border-peach-dark/20 bg-peach/90 text-peach-dark",
    dot: "bg-peach-dark/70",
    label: "Milestone",
  },
  review: {
    chip: "border-lavender-dark/20 bg-lavender/80 text-lavender-dark",
    dot: "bg-lavender-dark/70",
    label: "Review",
  },
  rest: {
    chip: "border-sage-dark/20 bg-sage/80 text-sage-dark",
    dot: "bg-sage-dark/70",
    label: "Rest",
  },
  other: {
    chip: "border-buttercup-dark/20 bg-buttercup/90 text-buttercup-dark",
    dot: "bg-buttercup-dark/70",
    label: "Other",
  },
};
