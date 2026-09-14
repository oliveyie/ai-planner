import { PLAN_TASK_COLOR } from "@/src/lib/utils/task-colors";
import type { BusyBlock } from "@/src/lib/utils/types";

// Deduped by calendarId, in first-seen order — one dot per distinct synced
// calendar currently contributing events, using each calendar's own real
// color (SPEC.md-adjacent: this is display-only, never fed into generation).
// `showPlan` adds a leading "Plan" entry for the single unified color every
// plan task renders in (see PLAN_TASK_COLOR) — only passed by CalendarShell,
// which is the only screen that ever has a real plan to show.
export function CalendarLegend({
  busyBlocks,
  showPlan = false,
}: {
  busyBlocks: BusyBlock[];
  showPlan?: boolean;
}) {
  const seen = new Map<string, { name: string; color: string }>();
  for (const block of busyBlocks) {
    if (!seen.has(block.calendarId)) {
      seen.set(block.calendarId, { name: block.calendarName, color: block.color });
    }
  }
  const calendars = Array.from(seen.entries());

  if (!showPlan && calendars.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-clay">
      {showPlan && (
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAN_TASK_COLOR }} />
          <span>Plan</span>
        </div>
      )}
      {calendars.map(([id, cal]) => (
        <div key={id} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cal.color }} />
          <span>{cal.name}</span>
        </div>
      ))}
    </div>
  );
}
