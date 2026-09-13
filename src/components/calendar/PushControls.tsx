"use client";

import { useState } from "react";
import { CALENDAR_PROVIDER_NAMES } from "@/src/lib/provider-labels";
import type { CalendarConnection, CalendarProvider } from "@/src/lib/types";

export function PushControls({
  connections,
  onPush,
}: {
  connections: CalendarConnection[];
  onPush: (provider: CalendarProvider) => Promise<void>;
}) {
  const [pushingProvider, setPushingProvider] = useState<CalendarProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successProvider, setSuccessProvider] = useState<CalendarProvider | null>(null);

  if (connections.length === 0) return null;

  async function handleClick(provider: CalendarProvider) {
    setPushingProvider(provider);
    setError(null);
    setSuccessProvider(null);
    try {
      await onPush(provider);
      setSuccessProvider(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushingProvider(null);
    }
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      <div className="flex flex-wrap gap-2">
        {connections.map((connection) => (
          <button
            key={connection.provider}
            onClick={() => handleClick(connection.provider)}
            disabled={pushingProvider !== null}
            className="rounded-full border border-coral/30 bg-peach/60 px-4 py-1.5 text-sm font-bold text-peach-dark shadow-sm transition-colors hover:bg-peach disabled:opacity-50"
          >
            {pushingProvider === connection.provider
              ? "Pushing…"
              : `Push to ${CALENDAR_PROVIDER_NAMES[connection.provider]}`}
          </button>
        ))}
      </div>
      {successProvider && (
        <p className="text-xs font-semibold text-sage-dark">
          sent to {CALENDAR_PROVIDER_NAMES[successProvider]}. whimble did it. 🌸
        </p>
      )}
      {error && <p className="text-xs font-semibold text-peach-dark">{error}</p>}
    </div>
  );
}
