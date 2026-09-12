import { formatTimeLabel } from "@/src/lib/date-utils";
import type { BusyBlock } from "@/src/lib/types";

// Deliberately untitled (SPEC.md §4/§6/§8): only ever shows a time range,
// never event content — that's out of scope by design, not an oversight.
export function BusyBlockChip({ block }: { block: BusyBlock }) {
  const start = new Date(block.start);
  const end = new Date(block.end);

  return (
    <div className="rounded border border-dashed border-foreground/20 bg-foreground/5 px-1.5 py-1 text-xs text-foreground/50">
      {formatTimeLabel(start)}–{formatTimeLabel(end)}
    </div>
  );
}
