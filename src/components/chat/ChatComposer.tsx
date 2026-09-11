"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

export function ChatComposer({
  onSend,
}: {
  onSend: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = message.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSend(text);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          className="flex-1 resize-none rounded border px-3 py-2 text-sm"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Only do long runs on Sundays…"
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
      {submitting && <p className="text-sm text-foreground/60">Updating your plan…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
