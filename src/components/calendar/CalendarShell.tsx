"use client";

import { useState } from "react";
import { addDays, addMonths, formatMonthLabel, formatWeekRangeLabel } from "@/src/lib/utils/date-utils";
import { flattenTasks, groupBusyBlocksByDate, groupTasksByDate } from "@/src/lib/utils/plan-utils";
import { CALENDAR_PROVIDER_LABELS } from "@/src/lib/providers/provider-labels";
import type { BusyBlock, CalendarConnection, CalendarProvider, Goal, Plan } from "@/src/lib/utils/types";
import { AgendaList } from "./AgendaList";
import { CalendarLegend } from "./CalendarLegend";
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
  hideHeader = false,
}: {
  goal: Goal;
  plan: Plan;
  busyBlocks?: BusyBlock[];
  connections?: CalendarConnection[];
  onNewGoal?: () => void;
  onPush?: (provider: CalendarProvider) => Promise<void>;
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
          <h1 className="font-fraunces text-xl font-semibold tracking-tight text-foreground">{goal.title}</h1>
          {onNewGoal && (
            <button
              onClick={onNewGoal}
              className="text-sm font-semibold text-clay-light underline underline-offset-2 hover:text-clay"
            >
              + New Goal
            </button>
          )}
        </header>
      )}

      <div className="flex h-full flex-col gap-3 rounded-3xl border border-[#EFE5D8] bg-surface-card/90 p-4 shadow-[0_6px_24px_rgba(215,190,170,0.06)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 px-2">
          <span className="text-sm font-bold text-foreground">
            {connections.length > 0 ? "whimble's calendar 4 u (draft)" : "Your Calendar"}
          </span>
          {onPush && connections.length > 0 && <PushControls connections={connections} onPush={onPush} />}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-2">
          <button
            onClick={goToToday}
            disabled={view === "agenda"}
            className="rounded-full border border-[#EFE5D8] bg-surface-card px-3.5 py-1.5 text-xs font-bold text-clay shadow-sm transition-colors hover:bg-surface-low hover:text-foreground disabled:opacity-30"
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
            <span className="min-w-32 px-1 text-center text-sm font-bold text-foreground">
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
                className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-all ${
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

        {connections.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-2">
            {connections.map((connection) => (
              <span
                key={connection.provider}
                className="rounded-full bg-sage px-2 py-0.5 text-[11px] font-bold text-sage-dark"
              >
                {CALENDAR_PROVIDER_LABELS[connection.provider]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
