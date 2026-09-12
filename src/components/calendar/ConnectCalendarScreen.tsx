"use client";

export function ConnectCalendarScreen({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <div>
        <h1 className="text-xl font-semibold">Connect your calendar</h1>
        <p className="text-sm text-foreground/60">
          WhimsyCal can schedule around what you already have going on. Connect one or both —
          this is optional, and you can always skip it for now.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href="/api/auth/google/start"
          className="rounded border px-4 py-2 text-center text-sm font-medium hover:bg-foreground/5"
        >
          Connect Google Calendar
        </a>
        <a
          href="/api/auth/microsoft/start"
          className="rounded border px-4 py-2 text-center text-sm font-medium hover:bg-foreground/5"
        >
          Connect Outlook Calendar
        </a>
      </div>

      <button onClick={onSkip} className="text-sm text-foreground/60 underline underline-offset-2">
        Skip for now
      </button>
    </div>
  );
}
