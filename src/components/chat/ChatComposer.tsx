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
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 rounded-2xl border border-[#EDE2D4] bg-surface-low/90 p-2 shadow-inner transition-all focus-within:border-coral/50"
      >
        <textarea
          className="flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-clay-light focus:outline-none focus:ring-0"
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
          className="whitespace-nowrap rounded-full bg-coral px-5 py-2.5 font-quicksand text-sm font-bold text-white shadow-[0_4px_16px_rgba(249,124,86,0.3)] transition-all hover:bg-[#e86b45] active:scale-95 disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {submitting && <p className="font-quicksand text-sm text-clay">Updating your plan…</p>}
      {error && <p className="font-quicksand text-sm text-peach-dark">{error}</p>}
    </div>
  );
}
