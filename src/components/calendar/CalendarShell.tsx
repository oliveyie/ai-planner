"use client";

import { useState } from "react";
import { addDays, addMonths, formatMonthLabel, formatWeekRangeLabel } from "@/src/lib/date-utils";
import { flattenTasks, groupBusyBlocksByDate, groupTasksByDate } from "@/src/lib/plan-utils";
import type { BusyBlock, CalendarConnection, Goal, Plan } from "@/src/lib/types";
import { AgendaList } from "./AgendaList";
import { CalendarLegend } from "./CalendarLegend";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

type ViewMode = "week" | "month" | "agenda";

const VIEW_MODES: ViewMode[] = ["week", "month", "agenda"];

export function CalendarShell({
  goal,
  plan,
  busyBlocks = [],
  connections = [],
  onNewGoal,
  hideHeader = false,
}: {
  goal: Goal;
  plan: Plan;
  busyBlocks?: BusyBlock[];
  connections?: CalendarConnection[];
  onNewGoal?: () => void;
  hideHeader?: boolean;
}) {
  const [view, setView] = useState<ViewMode>("week");
  // Today, not goal.startDate: the latter can be days/weeks in the past by
  // the time this renders (e.g. a returning visit), which previously left
  // the default Week view stranded on the plan's start week — Month view
  // masked this by coincidence (still the current month) while Week didn't.
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  const tasksByDate = groupTasksByDate(flattenTasks(plan));
  const busyBlocksByDate = groupBusyBlocksByDate(busyBlocks);

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

  function goToToday() {
    setAnchorDate(new Date());
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {!hideHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-2">
          <h1 className="font-quicksand text-xl font-bold tracking-tight text-foreground">{goal.title}</h1>
          {onNewGoal && (
            <button
              onClick={onNewGoal}
              className="font-quicksand text-sm font-semibold text-clay-light underline underline-offset-2 hover:text-clay"
            >
              + New Goal
            </button>
          )}
        </header>
      )}

      <div className="flex h-full flex-col gap-3 rounded-3xl border border-[#EFE5D8] bg-surface-card/90 p-4 shadow-[0_6px_24px_rgba(215,190,170,0.06)] sm:p-5">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="font-quicksand text-sm font-bold text-foreground">
            {connections.length > 0 ? "Compare with your Calendar" : "Your Calendar"}
          </span>
          {connections.length > 0 && (
            <span className="rounded-full bg-sage px-2 py-0.5 font-quicksand text-[11px] font-bold text-sage-dark">
              Live Sync
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-2">
          <button
            onClick={goToToday}
            disabled={view === "agenda"}
            className="rounded-full border border-[#EFE5D8] bg-surface-card px-3.5 py-1.5 font-quicksand text-xs font-bold text-clay shadow-sm transition-colors hover:bg-surface-low hover:text-foreground disabled:opacity-30"
          >
            Today
          </button>
          <div className="flex items-center gap-2 rounded-full border border-[#EFE5D8] bg-surface-card px-3.5 py-1.5 shadow-sm">
            <button
              onClick={() => shift(-1)}
              disabled={view === "agenda"}
              aria-label="Previous"
              className="flex h-6 w-6 items-center justify-center rounded-full text-clay transition-colors hover:bg-surface-low hover:text-foreground disabled:opacity-30"
            >
              ←
            </button>
            <span className="min-w-32 px-1 text-center font-quicksand text-sm font-bold text-foreground">
              {label}
            </span>
            <button
              onClick={() => shift(1)}
              disabled={view === "agenda"}
              aria-label="Next"
              className="flex h-6 w-6 items-center justify-center rounded-full text-clay transition-colors hover:bg-surface-low hover:text-foreground disabled:opacity-30"
            >
              →
            </button>
          </div>

          <div className="inline-flex rounded-full border border-[#EDE2D4]/70 bg-surface-low p-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`rounded-full px-3 py-1 font-quicksand text-xs font-bold capitalize transition-all ${
                  view === mode ? "bg-surface-card text-foreground shadow-sm" : "text-clay hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <CalendarLegend busyBlocks={busyBlocks} showPlan />

        {view === "week" && (
          <WeekView anchorDate={anchorDate} tasksByDate={tasksByDate} busyBlocksByDate={busyBlocksByDate} />
        )}
        {view === "month" && (
          <MonthView anchorDate={anchorDate} tasksByDate={tasksByDate} busyBlocksByDate={busyBlocksByDate} />
        )}
        {view === "agenda" && <AgendaList tasksByDate={tasksByDate} busyBlocksByDate={busyBlocksByDate} />}
      </div>
    </div>
  );
}
