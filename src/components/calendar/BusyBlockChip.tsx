import { formatTimeLabel } from "@/src/lib/utils/date-utils";
import type { BusyBlock } from "@/src/lib/utils/types";

// Read-only, from a connected calendar (SPEC.md §4/§6) — shows the real
// title when the provider returned one, falling back to just the time range
// for the rare case it didn't. The left accent uses the calendar's own real
// color (set via inline style, not a Tailwind class — it's a runtime value
// from the provider, which Tailwind's build-time class scanner can't see).
export function BusyBlockChip({
  block,
  compact = false,
  onClick,
  className = "",
}: {
  block: BusyBlock;
  compact?: boolean;
  onClick?: (block: BusyBlock) => void;
  className?: string;
}) {
  const start = new Date(block.start);
  const end = new Date(block.end);
  const time = `${formatTimeLabel(start)}–${formatTimeLabel(end)}`;

  return (
    <div
      className={`rounded-lg border border-dashed border-clay-light/40 bg-surface-low/60 px-1.5 py-1 text-[11px] text-clay ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ borderLeftWidth: 3, borderLeftColor: block.color, borderLeftStyle: "solid" }}
      title={block.calendarName}
      onClick={onClick ? () => onClick(block) : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(block);
              }
            }
          : undefined
      }
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
