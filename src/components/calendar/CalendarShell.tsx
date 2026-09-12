"use client";

import { useState } from "react";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  parseISODate,
} from "@/src/lib/date-utils";
import { flattenTasks, groupBusyBlocksByDate, groupTasksByDate } from "@/src/lib/plan-utils";
import { TASK_TYPE_STYLES } from "@/src/lib/task-colors";
import type { BusyBlock, CalendarConnection, CalendarProvider, Goal, Plan } from "@/src/lib/types";
import { AgendaList } from "./AgendaList";
import { MonthView } from "./MonthView";
import { PushControls } from "./PushControls";
import { WeekView } from "./WeekView";

type ViewMode = "week" | "month" | "agenda";

const VIEW_MODES: ViewMode[] = ["week", "month", "agenda"];

export function CalendarShell({
  goal,
  plan,
  busyBlocks = [],
  connections = [],
  onNewGoal,
  onPush,
}: {
  goal: Goal;
  plan: Plan;
  busyBlocks?: BusyBlock[];
  connections?: CalendarConnection[];
  onNewGoal?: () => void;
  onPush?: (provider: CalendarProvider) => Promise<void>;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(() => parseISODate(goal.startDate));

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
    <div className="flex flex-col gap-3">
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

      {onPush && <PushControls connections={connections} onPush={onPush} />}

      <div className="flex flex-col gap-3 rounded-3xl border border-[#EFE5D8] bg-surface-card/90 p-4 shadow-[0_6px_24px_rgba(215,190,170,0.06)] sm:p-5">
        <div className="flex flex-col items-start justify-between gap-3 px-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
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

          <div className="flex flex-wrap items-center gap-3 font-quicksand text-xs font-medium text-clay">
            {(Object.keys(TASK_TYPE_STYLES) as Array<keyof typeof TASK_TYPE_STYLES>).map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${TASK_TYPE_STYLES[type].dot}`} />
                <span>{TASK_TYPE_STYLES[type].label}</span>
              </div>
            ))}
          </div>
        </div>

        {view === "week" && (
          <WeekView anchorDate={anchorDate} tasksByDate={tasksByDate} busyBlocksByDate={busyBlocksByDate} />
        )}
        {view === "month" && <MonthView anchorDate={anchorDate} tasksByDate={tasksByDate} />}
        {view === "agenda" && <AgendaList tasksByDate={tasksByDate} />}
      </div>
    </div>
  );
}
