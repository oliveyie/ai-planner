import { formatTimeLabel } from "@/src/lib/date-utils";
import type { BusyBlock } from "@/src/lib/types";

// Read-only, from a connected calendar (SPEC.md §4/§6) — shows the real
// title when the provider returned one, falling back to just the time range
// for the rare case it didn't.
export function BusyBlockChip({ block }: { block: BusyBlock }) {
  const start = new Date(block.start);
  const end = new Date(block.end);
  const time = `${formatTimeLabel(start)}–${formatTimeLabel(end)}`;

  return (
    <div className="rounded border border-dashed border-foreground/20 bg-foreground/5 px-1.5 py-1 text-xs text-foreground/50">
      {block.title ? (
        <>
          <div className="truncate">{block.title}</div>
          <div className="opacity-70">{time}</div>
        </>
      ) : (
        time
      )}
    </div>
  );
}
