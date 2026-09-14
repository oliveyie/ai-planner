"use client";

import { Modal } from "@/src/components/ui/Modal";
import { CALENDAR_PROVIDER_NAMES } from "@/src/lib/providers/provider-labels";
import { formatTimeLabel } from "@/src/lib/utils/date-utils";
import type { BusyBlock } from "@/src/lib/utils/types";

// View-only — BusyBlockChip's own header comment establishes these events are
// read from a connected calendar with no update/delete API, so unlike
// TaskDetailModal this has no edit or delete affordance.
export function BusyBlockDetailModal({ block, onClose }: { block: BusyBlock; onClose: () => void }) {
  const start = new Date(block.start);
  const end = new Date(block.end);

  return (
    <Modal onClose={onClose}>
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
    </Modal>
  );
}
