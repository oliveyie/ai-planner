"use client";

const WIDTH = 320; // keep in sync with the w-80 class below
const GAP = 8; // breathing room between the anchor and the popover
const MARGIN = 8; // never touch the very edge of the viewport

// A smaller panel anchored next to whatever was clicked, instead of Modal's
// centered full-screen overlay — used for a task's detail popup, which reads
// better appearing right next to the task than taking over the screen.
// Positioning is a one-shot estimate from the anchor's rect at open time
// (no live remeasuring/repositioning on scroll) — acceptable for a popover
// that's dismissed by clicking away, same tradeoff most lightweight popovers
// make. An invisible (not dimmed/blurred) full-screen layer still catches
// outside clicks to close it.
export function Popover({
  anchorRect,
  onClose,
  children,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;

  const spaceRight = viewportWidth - anchorRect.right;
  const spaceLeft = anchorRect.left;
  const placeRight = spaceRight >= WIDTH + GAP || spaceRight >= spaceLeft;

  const left = placeRight
    ? Math.min(anchorRect.right + GAP, viewportWidth - WIDTH - MARGIN)
    : Math.max(anchorRect.left - WIDTH - GAP, MARGIN);

  // Align with the anchor's top, clamped so the popover never runs off the
  // bottom (or top) of the viewport — max-h-[70vh] + its own scroll handles
  // content taller than the remaining space either way.
  const top = Math.min(Math.max(anchorRect.top, MARGIN), viewportHeight - MARGIN - 120);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ top, left }}
        className="fixed z-50 flex max-h-[70vh] w-80 flex-col overflow-y-auto rounded-2xl border border-[#EFE5D8] bg-surface-card p-4 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-surface-card text-clay-light shadow-sm transition-colors hover:bg-surface-low hover:text-foreground"
        >
          ×
        </button>
        <div className="flex flex-col gap-3 pr-5">{children}</div>
      </div>
    </>
  );
}
