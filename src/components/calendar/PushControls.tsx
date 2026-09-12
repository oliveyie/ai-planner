"use client";

import { useState } from "react";
import type { CalendarConnection, CalendarProvider } from "@/src/lib/types";

const PROVIDER_LABELS: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  microsoft: "Outlook Calendar",
};

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
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {connections.map((connection) => (
          <button
            key={connection.provider}
            onClick={() => handleClick(connection.provider)}
            disabled={pushingProvider !== null}
            className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
          >
            {pushingProvider === connection.provider
              ? "Pushing…"
              : `Push to ${PROVIDER_LABELS[connection.provider]}`}
          </button>
        ))}
      </div>
      {successProvider && (
        <p className="text-xs text-green-600">Pushed to {PROVIDER_LABELS[successProvider]}.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
