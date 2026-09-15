"use client";

import { useEffect, useRef, useState } from "react";
import { WhimbleMascot } from "@/src/components/whimble/WhimbleMascot";
import { CALENDAR_PROVIDER_NAMES } from "@/src/lib/providers/provider-labels";
import type { CalendarConnection, CalendarProvider } from "@/src/lib/utils/types";

export function AppHeader({
  connections = [],
  onDisconnect,
  onNewGoal,
}: {
  connections?: CalendarConnection[];
  onDisconnect?: (provider: CalendarProvider) => void;
  onNewGoal?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // First name only, per request — "Alex Rivera" (from the provider's
  // profile) reads as "Alex" here; falls back to "Guest" the same way the
  // full name did when no connection has a displayName yet.
  const fullName = connections.find((c) => c.displayName)?.displayName;
  const firstName = fullName?.split(" ")[0] ?? "Guest";

  function handleDisconnect(provider: CalendarProvider) {
    onDisconnect?.(provider);
    setMenuOpen(false);
  }

  const brandMark = (
    <>
      <WhimbleMascot size="sm" />
      <span className="font-fraunces font-semibold text-lg text-foreground tracking-tight">Whimble</span>
    </>
  );

  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-5">
      {onNewGoal ? (
        <button
          type="button"
          onClick={onNewGoal}
          title="Start a new whim"
          className="flex items-center gap-2.5 rounded-full border border-peach-dark/10 bg-surface-card px-3.5 py-1.5 shadow-sm transition-colors hover:bg-surface-low"
        >
          {brandMark}
        </button>
      ) : (
        <div className="flex items-center gap-2.5 rounded-full border border-peach-dark/10 bg-surface-card px-3.5 py-1.5 shadow-sm">
          {brandMark}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {connections.length === 0 && (
          <span className="flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/80 px-3.5 py-1.5 text-xs font-semibold text-amber-700 shadow-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Not connected yet
          </span>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full border border-[#eee4d5] bg-white/70 py-1 pl-2 pr-3 shadow-xs transition-colors hover:bg-white"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
              🌱
            </div>
            <span className="text-xs font-bold text-slate-700">{firstName}</span>
            <span className={`text-[10px] text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}>▾</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-[#eee4d5] bg-white p-1.5 shadow-lg">
              {connections.length > 0 ? (
                connections.map((connection) => (
                  <button
                    key={connection.provider}
                    onClick={() => handleDisconnect(connection.provider)}
                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-clay transition-colors hover:bg-surface-low hover:text-peach-dark"
                  >
                    Disconnect {CALENDAR_PROVIDER_NAMES[connection.provider]}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-clay-light">no calendar yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
