// Shared overlay shell, factored out of PlanSummaryCard's original expand
// modal — backdrop, a centered box capped at 85vh with its own scroll (not
// the backdrop wrapper, which clips a centered flex item's own start/end),
// and a close button that stays fixed in place rather than scrolling away
// with the content. PlanSummaryCard keeps its own inline copy (already
// verified, not worth the regression risk to swap in place); every new modal
// should use this one instead of copy-pasting the shell again.
export function Modal({
  onClose,
  children,
  maxWidthClassName = "max-w-2xl",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1c18]/40 p-4 backdrop-blur-sm sm:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex max-h-[85vh] w-full ${maxWidthClassName} flex-col rounded-3xl border border-[#EFE5D8] bg-surface-card shadow-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-card text-clay-light shadow-sm transition-colors hover:bg-surface-low hover:text-foreground"
        >
          ×
        </button>
        <div className="flex flex-col gap-4 overflow-y-auto p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
