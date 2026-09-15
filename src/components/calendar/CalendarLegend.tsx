import { PLAN_FILTER_ID } from "@/src/lib/utils/plan-utils";
import { PLAN_TASK_COLOR } from "@/src/lib/utils/task-colors";
import type { BusyBlock } from "@/src/lib/utils/types";

// Deduped by calendarId, in first-seen order — one dot per distinct synced
// calendar currently contributing events, using each calendar's own real
// color (SPEC.md-adjacent: this is display-only, never fed into generation).
// `showPlan` adds a leading "Plan" entry for the single unified color every
// plan task renders in (see PLAN_TASK_COLOR) — only passed where a real plan
// exists to show (CalendarShell, not the pre-goal EmptyCalendarPreview).
//
// Clicking an entry isolates it (the caller filters every view down to just
// that source via plan-utils.ts's applyLegendFilter); clicking the
// already-active one clears the filter.
export function CalendarLegend({
  busyBlocks,
  showPlan = false,
  activeFilter = null,
  onToggleFilter,
}: {
  busyBlocks: BusyBlock[];
  showPlan?: boolean;
  activeFilter?: string | null;
  onToggleFilter?: (id: string) => void;
}) {
  const seen = new Map<string, { name: string; color: string }>();
  for (const block of busyBlocks) {
    if (!seen.has(block.calendarId)) {
      seen.set(block.calendarId, { name: block.calendarName, color: block.color });
    }
  }
  const calendars = Array.from(seen.entries());

  if (!showPlan && calendars.length === 0) return null;

  function entryClassName(id: string) {
    const dimmed = activeFilter !== null && activeFilter !== id;
    return `flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-opacity ${
      onToggleFilter ? "cursor-pointer hover:bg-surface-low" : ""
    } ${dimmed ? "opacity-40" : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs font-medium text-clay">
      {showPlan && (
        <button
          type="button"
          onClick={() => onToggleFilter?.(PLAN_FILTER_ID)}
          className={entryClassName(PLAN_FILTER_ID)}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAN_TASK_COLOR }} />
          <span>Plan</span>
        </button>
      )}
      {calendars.map(([id, cal]) => (
        <button type="button" key={id} onClick={() => onToggleFilter?.(id)} className={entryClassName(id)}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cal.color }} />
          <span>{cal.name}</span>
        </button>
      ))}
    </div>
  );
}
