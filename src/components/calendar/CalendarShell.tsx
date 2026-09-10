"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  parseISODate,
} from "@/src/lib/date-utils";
import { getActiveGoal, getLatestPlan, saveGoal, savePlan } from "@/src/lib/db";
import { createExampleGoalAndPlan } from "@/src/lib/fixtures/example-plan";
import { flattenTasks, groupTasksByDate } from "@/src/lib/plan-utils";
import type { Goal, Plan } from "@/src/lib/types";
import { AgendaList } from "./AgendaList";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

type ViewMode = "week" | "month" | "agenda";

const VIEW_MODES: ViewMode[] = ["week", "month", "agenda"];

export function CalendarShell() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const initialized = useRef(false);

  useEffect(() => {
    // Guards against React Strict Mode's double-invoked effect in dev: without
    // this, two concurrent seed-if-empty calls can race into creating two
    // active goals. The ref (not a `cancelled`-flag/cleanup pair) is what
    // makes this safe — a cleanup-based flag would get set by Strict Mode's
    // simulated-unmount cleanup before this same run's async work resolves,
    // permanently suppressing the state update that ends the loading state.
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      let activeGoal = await getActiveGoal();
      let activePlan = activeGoal ? await getLatestPlan(activeGoal.id) : undefined;

      if (!activeGoal || !activePlan) {
        const seeded = createExampleGoalAndPlan(new Date());
        await saveGoal(seeded.goal);
        await savePlan(seeded.plan);
        activeGoal = seeded.goal;
        activePlan = seeded.plan;
      }

      setGoal(activeGoal);
      setPlan(activePlan);
      setAnchorDate(parseISODate(activeGoal.startDate));
      setLoading(false);
    })();
  }, []);

  const tasksByDate = useMemo(() => {
    if (!plan) return new Map();
    return groupTasksByDate(flattenTasks(plan));
  }, [plan]);

  if (loading || !goal || !plan) {
    return <div className="p-8 text-sm text-foreground/60">Loading your plan…</div>;
  }

  const label =
    view === "month"
      ? formatMonthLabel(anchorDate)
      : view === "week"
        ? formatWeekRangeLabel(anchorDate)
        : "All tasks";

  function shift(direction: 1 | -1) {
    setAnchorDate((current) =>
      view === "month" ? addMonths(current, direction) : addDays(current, direction * 7),
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{goal.title}</h1>
        <p className="text-sm text-foreground/70">{plan.summary}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            disabled={view === "agenda"}
            className="rounded border px-2 py-1 text-sm disabled:opacity-30"
          >
            ←
          </button>
          <span className="min-w-40 text-sm font-medium">{label}</span>
          <button
            onClick={() => shift(1)}
            disabled={view === "agenda"}
            className="rounded border px-2 py-1 text-sm disabled:opacity-30"
          >
            →
          </button>
        </div>

        <div className="flex gap-1 rounded border p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                view === mode ? "bg-foreground text-background" : ""
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {view === "week" && <WeekView anchorDate={anchorDate} tasksByDate={tasksByDate} />}
      {view === "month" && <MonthView anchorDate={anchorDate} tasksByDate={tasksByDate} />}
      {view === "agenda" && <AgendaList tasksByDate={tasksByDate} />}
    </div>
  );
}
