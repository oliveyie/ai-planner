"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

const QUICK_SPARKS = [
  {
    emoji: "🏃",
    label: "5k without wheezing",
    seed: "Run a 5k without dying or wheezing, 3 gentle intervals a week",
    color: "peach" as const,
  },
  {
    emoji: "📚",
    label: "Actually finish a book",
    seed: "Actually finish a book before buying 5 more, 15 mins every evening",
    color: "buttercup" as const,
  },
  {
    emoji: "🚀",
    label: "Ship a side project",
    seed: "Ship a small side project, working on it a little each weekend",
    color: "sage" as const,
  },
  {
    emoji: "🥐",
    label: "Master French pastries",
    seed: "Master French pastries and bake croissants without burning the house down",
    color: "lavender" as const,
  },
];

const CHIP_STYLES = {
  peach: "bg-peach/70 hover:bg-peach text-peach-dark border-peach-dark/10",
  buttercup: "bg-buttercup/80 hover:bg-buttercup text-buttercup-dark border-buttercup-dark/15",
  sage: "bg-sage/80 hover:bg-sage text-sage-dark border-sage-dark/15",
  lavender: "bg-lavender/80 hover:bg-lavender text-lavender-dark border-lavender-dark/15",
};

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
    <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[#F1E8DC] bg-surface-card p-5 shadow-[0_8px_30px_rgba(215,190,170,0.14)] sm:p-8">
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
            placeholder="e.g., Run a 5k without wheezing, bake sourdough like a pro…"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-coral px-7 py-3 text-sm font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(249,124,86,0.3)] transition-all hover:bg-[#e86b45] hover:shadow-[0_6px_20px_rgba(249,124,86,0.4)] active:scale-95 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Weaving it in… 🪄" : "Let's plan ✨"}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="mr-1 text-xs font-bold text-clay-light">Quick sparks:</span>
          {QUICK_SPARKS.map((spark) => (
            <button
              key={spark.label}
              type="button"
              onClick={() => setMessage(spark.seed)}
              disabled={submitting}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${CHIP_STYLES[spark.color]}`}
            >
              {spark.emoji} {spark.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-peach-dark">{error}</p>}
      </div>
    </div>
  );
}
