"use client";

import { Popover } from "@/src/components/ui/Popover";
import { CALENDAR_PROVIDER_NAMES } from "@/src/lib/providers/provider-labels";
import { formatTimeLabel } from "@/src/lib/utils/date-utils";
import type { BusyBlock } from "@/src/lib/utils/types";

// View-only — BusyBlockChip's own header comment establishes these events are
// read from a connected calendar with no update/delete API, so unlike
// TaskDetailModal this has no edit or delete affordance. Renders as a small
// popover next to the clicked chip (anchorRect is that chip's own DOMRect),
// same treatment as TaskDetailModal, rather than a full-screen centered modal.
export function BusyBlockDetailModal({
  block,
  anchorRect,
  onClose,
}: {
  block: BusyBlock;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const start = new Date(block.start);
  const end = new Date(block.end);

  return (
    <Popover anchorRect={anchorRect} onClose={onClose}>
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: block.color }}
          aria-hidden="true"
        />
        <span className="text-xs font-bold text-clay">
          {block.calendarName} · {CALENDAR_PROVIDER_NAMES[block.source]}
        </span>
      </div>

      <h2 className="font-fraunces text-xl font-semibold tracking-tight text-foreground">
        {block.title || "Busy"}
      </h2>

      <p className="text-sm font-semibold text-clay">
        {start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} ·{" "}
        {formatTimeLabel(start)} – {formatTimeLabel(end)}
      </p>

      <p className="text-xs text-clay-light">Synced from {CALENDAR_PROVIDER_NAMES[block.source]} — read-only.</p>
    </Popover>
  );
}
