"use client";

import { useState } from "react";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  parseISODate,
} from "@/src/lib/date-utils";
import { flattenTasks, groupTasksByDate } from "@/src/lib/plan-utils";
import type { Goal, Plan } from "@/src/lib/types";
import { AgendaList } from "./AgendaList";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

type ViewMode = "week" | "month" | "agenda";

const VIEW_MODES: ViewMode[] = ["week", "month", "agenda"];

export function CalendarShell({ goal, plan }: { goal: Goal; plan: Plan }) {
  const [view, setView] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(() => parseISODate(goal.startDate));

  const tasksByDate = groupTasksByDate(flattenTasks(plan));

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
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">{goal.title}</h1>
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
