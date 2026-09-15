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
