import { formatTimeLabel } from "@/src/lib/date-utils";
import type { BusyBlock } from "@/src/lib/types";

// Read-only, from a connected calendar (SPEC.md §4/§6) — shows the real
// title when the provider returned one, falling back to just the time range
// for the rare case it didn't. The left accent uses the calendar's own real
// color (set via inline style, not a Tailwind class — it's a runtime value
// from the provider, which Tailwind's build-time class scanner can't see).
export function BusyBlockChip({ block, compact = false }: { block: BusyBlock; compact?: boolean }) {
  const start = new Date(block.start);
  const end = new Date(block.end);
  const time = `${formatTimeLabel(start)}–${formatTimeLabel(end)}`;

  return (
    <div
      className="rounded-lg border border-dashed border-clay-light/40 bg-surface-low/60 px-1.5 py-1 text-[11px] text-clay"
      style={{ borderLeftWidth: 3, borderLeftColor: block.color, borderLeftStyle: "solid" }}
      title={block.calendarName}
    >
      {block.title ? (
        <>
          <div className="truncate">{block.title}</div>
          {!compact && <div className="opacity-70">{time}</div>}
        </>
      ) : (
        time
      )}
    </div>
  );
}
