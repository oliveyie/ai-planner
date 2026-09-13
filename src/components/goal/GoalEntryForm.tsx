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
    <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-[#F1E8DC] bg-surface-card p-5 shadow-[0_8px_30px_rgba(215,190,170,0.14)] sm:p-8">
      <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-peach/40 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-buttercup/50 blur-2xl" />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <h1 className="font-fraunces text-2xl font-semibold tracking-tight text-foreground">
          What are your goals?
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col items-center gap-2.5 rounded-2xl border border-[#EDE2D4] bg-surface-low/90 p-2 shadow-inner transition-all focus-within:border-coral/50 sm:flex-row"
        >
          <textarea
            className="w-full flex-1 resize-none border-0 bg-transparent px-4 py-2.5 text-sm text-foreground placeholder:text-clay-light focus:outline-none focus:ring-0 sm:text-base"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me your whim…"
            disabled={submitting}
          />
          {message.trim() && (
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-coral px-7 py-3 text-sm font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(249,124,86,0.3)] transition-all hover:bg-[#e86b45] hover:shadow-[0_6px_20px_rgba(249,124,86,0.4)] active:scale-95 disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Weaving it in… 🪄" : "Let's plan ✨"}
            </button>
          )}
        </form>

        {error && <p className="text-sm text-peach-dark">{error}</p>}
      </div>
    </div>
  );
}
