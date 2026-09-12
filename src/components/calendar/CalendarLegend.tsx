import type { BusyBlock } from "@/src/lib/types";

// Deduped by calendarId, in first-seen order — one dot per distinct synced
// calendar currently contributing events, using each calendar's own real
// color (SPEC.md-adjacent: this is display-only, never fed into generation).
export function CalendarLegend({ busyBlocks }: { busyBlocks: BusyBlock[] }) {
  const seen = new Map<string, { name: string; color: string }>();
  for (const block of busyBlocks) {
    if (!seen.has(block.calendarId)) {
      seen.set(block.calendarId, { name: block.calendarName, color: block.color });
    }
  }
  const calendars = Array.from(seen.entries());

  if (calendars.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 font-quicksand text-xs font-medium text-clay">
      <span className="font-bold text-clay-light">Synced:</span>
      {calendars.map(([id, cal]) => (
        <div key={id} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cal.color }} />
          <span>{cal.name}</span>
        </div>
      ))}
    </div>
  );
}
