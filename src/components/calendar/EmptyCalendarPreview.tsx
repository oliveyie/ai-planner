"use client";

import { useEffect, useState } from "react";
import { fetchCalendarEvents } from "@/src/lib/calendar/calendar-api";
import {
  addDays,
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatWeekRangeLabel,
  startOfMonth,
  startOfWeek,
} from "@/src/lib/utils/date-utils";
import { applyLegendFilter, groupBusyBlocksByDate } from "@/src/lib/utils/plan-utils";
import { CALENDAR_PROVIDER_LABELS } from "@/src/lib/providers/provider-labels";
import type { BusyBlock, CalendarConnection, GoogleTask } from "@/src/lib/utils/types";
import { CalendarLegend } from "./CalendarLegend";
import { MonthView } from "./MonthView";
import { TodoList } from "./TodoList";
import { WeekView } from "./WeekView";

type ViewMode = "week" | "month" | "agenda";
const VIEW_MODES: ViewMode[] = ["week", "month", "agenda"];

// The pre-goal calendar preview (shown behind the "connect your calendar"
// prompt) — no goal/plan exists yet, so this only ever has busy blocks to
// show, never plan tasks. Reuses the same shared view components as
// CalendarShell (MonthView/WeekView/TodoList/CalendarLegend, plus the same
// applyLegendFilter logic) rather than a separate hand-rolled month grid and
// flat day list, so every calendar improvement (today styling, time display,
// click-to-detail, legend filtering, the Agenda tab's time-grid + Google
// Tasks sidebar) lands here too instead of drifting out of sync.
export function EmptyCalendarPreview({
  dimmed = false,
  connections = [],
  googleTasks = [],
  googleTasksError = false,
  onSelectBusyBlock,
  onToggleGoogleTask,
}: {
  dimmed?: boolean;
  connections?: CalendarConnection[];
  googleTasks?: GoogleTask[];
  googleTasksError?: boolean;
  onSelectBusyBlock?: (block: BusyBlock, anchorRect: DOMRect) => void;
  onToggleGoogleTask?: (taskId: string) => void;
}) {
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);

  const weekStart = startOfWeek(anchorDate);

  const label =
    view === "month"
      ? formatMonthLabel(anchorDate)
      : view === "week"
        ? formatWeekRangeLabel(anchorDate)
        : formatDayLabel(anchorDate);

  useEffect(() => {
    if (connections.length === 0) return;

    // Month view's grid starts at the first visible day (which may be in the
    // previous month) and always spans 42 days — matching MonthView's own
    // computation, so events actually get fetched for every cell it renders.
    const monthGridStart = startOfWeek(startOfMonth(anchorDate));
    const rangeStart = view === "month" ? monthGridStart : view === "week" ? weekStart : anchorDate;
    const rangeEnd =
      view === "month" ? addDays(monthGridStart, 42) : view === "week" ? addDays(weekStart, 7) : addDays(anchorDate, 1);

    let cancelled = false;
    fetchCalendarEvents(rangeStart, rangeEnd).then((blocks) => {
      if (!cancelled) setBusyBlocks(blocks);
    });
    return () => {
      cancelled = true;
    };
    // Range bounds are all derived from view + anchorDate, already covered below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.length, view, anchorDate.getTime()]);

  // Derived rather than reset via setState in the effect above: guards
  // against ever rendering stale events if a connection is ever removed.
  const effectiveBusyBlocks = connections.length > 0 ? busyBlocks : [];
  const { busyBlocksByDate } = applyLegendFilter(new Map(), groupBusyBlocksByDate(effectiveBusyBlocks), activeFilter);

  function toggleFilter(id: string) {
    setActiveFilter((current) => (current === id ? null : id));
  }

  function shift(direction: 1 | -1) {
    setAnchorDate((current) => {
      if (view === "month") return addMonths(current, direction);
      if (view === "week") return addDays(current, direction * 7);
      return addDays(current, direction);
    });
  }

  function goToToday() {
    setAnchorDate(new Date());
  }

  const googleConnected = connections.some((c) => c.provider === "google");

  return (
    <div className={dimmed ? "pointer-events-none select-none opacity-40 blur-[1px]" : ""}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-[#eee4d5] bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-xs">
            <button
              aria-label="Previous"
              onClick={() => shift(-1)}
              className="p-1 text-slate-400 transition-colors hover:text-slate-700"
            >
              ←
            </button>
            <span className="min-w-40 px-3 text-center tracking-tight">{label}</span>
            <button
              aria-label="Next"
              onClick={() => shift(1)}
              className="p-1 text-slate-400 transition-colors hover:text-slate-700"
            >
              →
            </button>
          </div>
          <button
              onClick={goToToday}
              className="rounded-full border border-[#eee4d5] bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
            >
            Today
          </button>
        </div>

        <div className="flex items-center rounded-full border border-[#ede3d3] bg-[#f8f5ee] p-1 text-xs font-bold text-slate-400">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded-full px-3.5 py-1 capitalize transition-colors ${
                view === mode ? "bg-white text-slate-800 shadow-xs" : "opacity-60 hover:text-slate-800"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <CalendarLegend busyBlocks={effectiveBusyBlocks} activeFilter={activeFilter} onToggleFilter={toggleFilter} />
      </div>

      {view === "week" && <WeekView anchorDate={anchorDate} busyBlocksByDate={busyBlocksByDate} onSelectBusyBlock={onSelectBusyBlock} />}
      {view === "month" && (
        <MonthView anchorDate={anchorDate} tasksByDate={new Map()} busyBlocksByDate={busyBlocksByDate} onSelectBusyBlock={onSelectBusyBlock} />
      )}
      {view === "agenda" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
          <WeekView
            anchorDate={anchorDate}
            days={[anchorDate]}
            busyBlocksByDate={busyBlocksByDate}
            onSelectBusyBlock={onSelectBusyBlock}
          />
          <TodoList
            tasks={googleTasks}
            connected={googleConnected}
            error={googleTasksError}
            onToggleComplete={(taskId) => onToggleGoogleTask?.(taskId)}
          />
        </div>
      )}

      {connections.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5">
          {connections.map((connection) => (
            <span
              key={connection.provider}
              className="rounded-full bg-sage px-2.5 py-1 text-[11px] font-bold text-sage-dark"
            >
              {CALENDAR_PROVIDER_LABELS[connection.provider]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
