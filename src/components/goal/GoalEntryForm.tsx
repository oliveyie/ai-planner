"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

export function GoalEntryForm({
  onSubmit,
}: {
  onSubmit: (title: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitGoal() {
    const title = message.trim();
    if (!title || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitGoal();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitGoal();
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 p-8">
      <div>
        <h1 className="text-xl font-semibold">Hi, any new goals?</h1>
        <p className="text-sm text-foreground/60">
          A race, a project, a skill — anything with enough shape to break into steps.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          className="flex-1 resize-none rounded border px-3 py-2 text-sm"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Run the Seattle Marathon this spring"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {submitting && <p className="text-sm text-foreground/60">Generating your plan…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
