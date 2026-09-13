import type { CalendarConnection, CalendarProvider } from "@/src/lib/types";

const CONNECTION_LABELS: Record<CalendarProvider, string> = {
  google: "🌱 Google Cal connected",
  microsoft: "📅 Outlook connected",
};

export function AppHeader({
  connections = [],
  onDisconnect,
}: {
  connections?: CalendarConnection[];
  onDisconnect?: (provider: CalendarProvider) => void;
}) {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5">
      <div className="flex items-center gap-2.5 rounded-full border border-peach-dark/10 bg-surface-card px-3.5 py-1.5 shadow-sm">
        <div className="w-7 h-7 rounded-full bg-buttercup flex items-center justify-center text-base ring-2 ring-buttercup-dark/20">
          🟡
        </div>
        <span className="font-fraunces font-semibold text-lg text-foreground tracking-tight">WhimsyCal</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {connections.length > 0 ? (
          connections.map((connection) => (
            <span
              key={connection.provider}
              className="flex items-center gap-1.5 rounded-full border border-sage-dark/15 bg-sage/70 py-1.5 pl-3.5 pr-2 text-xs font-semibold text-sage-dark"
            >
              {CONNECTION_LABELS[connection.provider]}
              {onDisconnect && (
                <button
                  onClick={() => onDisconnect(connection.provider)}
                  title={`Disconnect ${connection.provider === "google" ? "Google" : "Outlook"} Calendar`}
                  aria-label={`Disconnect ${connection.provider === "google" ? "Google" : "Outlook"} Calendar`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-sage-dark/70 transition-colors hover:bg-sage-dark/15 hover:text-sage-dark"
                >
                  ×
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/80 px-3.5 py-1.5 text-xs font-semibold text-amber-700 shadow-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Not connected yet
          </span>
        )}

        <div className="flex items-center gap-2 rounded-full border border-[#eee4d5] bg-white/70 py-1 pl-2 pr-3 shadow-xs">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
            🌱
          </div>
          <span className="text-xs font-bold text-slate-700">Guest</span>
        </div>
      </div>
    </header>
  );
}
