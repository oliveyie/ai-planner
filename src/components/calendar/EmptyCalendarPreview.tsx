"use client";

import { useEffect, useState } from "react";
import { fetchCalendarEvents } from "@/src/lib/calendar-api";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  isSameDay,
  startOfMonth,
  startOfWeek,
  toISODate,
} from "@/src/lib/date-utils";
import { groupBusyBlocksByDate } from "@/src/lib/plan-utils";
import type { BusyBlock, CalendarConnection } from "@/src/lib/types";
import { BusyBlockChip } from "./BusyBlockChip";
import { CalendarLegend } from "./CalendarLegend";
import { WeekView } from "./WeekView";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // matches this app's Sunday-start week

type ViewMode = "month" | "week" | "day";
const VIEW_MODES: ViewMode[] = ["month", "week", "day"];

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function DayCell({
  day,
  today,
  inMonth = true,
  events = [],
  compactEvents = false,
}: {
  day: Date;
  today: Date;
  inMonth?: boolean;
  events?: BusyBlock[];
  compactEvents?: boolean;
}) {
  const isToday = isSameDay(day, today);
  return (
    <div
      className={`flex min-h-[82px] flex-col gap-1 rounded-2xl border-[1.5px] border-dashed p-2 transition-all ${
        isToday
          ? "border-amber-300 bg-amber-50/20"
          : inMonth
            ? "border-[#e8decb] bg-white/55"
            : "border-[#e8decb]/40 bg-white/25 opacity-45"
      }`}
    >
      <span className={`text-xs font-semibold ${isToday ? "text-amber-500" : "text-slate-400"}`}>
        {day.getDate()}
      </span>
      {events.map((event, i) => (
        <BusyBlockChip key={i} block={event} compact={compactEvents} />
      ))}
    </div>
  );
}

export function EmptyCalendarPreview({
  dimmed = false,
  connections = [],
}: {
  dimmed?: boolean;
  connections?: CalendarConnection[];
}) {
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);
  const today = new Date();

  const monthStart = startOfMonth(anchorDate);
  const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const monthGridStart = startOfWeek(monthStart);
  const monthGridEnd = addDays(startOfWeek(lastDayOfMonth), 6);
  const monthDayCount = Math.round((monthGridEnd.getTime() - monthGridStart.getTime()) / 86_400_000) + 1;
  const monthDays = Array.from({ length: monthDayCount }, (_, i) => addDays(monthGridStart, i));

  const weekStart = startOfWeek(anchorDate);
  const dayStart = startOfDay(anchorDate);

  const label =
    view === "month"
      ? formatMonthLabel(anchorDate)
      : view === "week"
        ? formatWeekRangeLabel(anchorDate)
        : anchorDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    if (connections.length === 0) return;

    const rangeStart = view === "month" ? monthGridStart : view === "week" ? weekStart : dayStart;
    const rangeEnd =
      view === "month" ? addDays(monthGridEnd, 1) : view === "week" ? addDays(weekStart, 7) : addDays(dayStart, 1);

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
  const busyBlocksByDate = groupBusyBlocksByDate(effectiveBusyBlocks);
  const dayEvents = busyBlocksByDate.get(toISODate(anchorDate)) ?? [];

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

  return (
    <div className={dimmed ? "pointer-events-none select-none opacity-40 blur-[1px]" : ""}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="rounded-full border border-[#eee4d5] bg-white px-3.5 py-1.5 font-quicksand text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
          >
            Today
          </button>
          <div className="flex items-center rounded-full border border-[#eee4d5] bg-white px-3 py-1.5 font-quicksand text-sm font-bold text-slate-700 shadow-xs">
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
        </div>

        <div className="flex items-center rounded-full border border-[#ede3d3] bg-[#f8f5ee] p-1 font-quicksand text-xs font-bold text-slate-400">
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
        <CalendarLegend busyBlocks={effectiveBusyBlocks} />
      </div>

      {view === "day" ? (
        dayEvents.length > 0 ? (
          <div className="flex min-h-[280px] flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-amber-300 bg-amber-50/20 p-4">
            {dayEvents.map((event, i) => (
              <BusyBlockChip key={i} block={event} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border-[1.5px] border-dashed border-amber-300 bg-amber-50/20 p-6">
            <span className="font-quicksand text-sm font-semibold text-amber-500">Nothing scheduled yet</span>
          </div>
        )
      ) : view === "week" ? (
        <WeekView anchorDate={anchorDate} busyBlocksByDate={busyBlocksByDate} />
      ) : (
        <>
          <div className="mb-2 grid grid-cols-7 gap-3 text-center font-quicksand text-xs font-bold uppercase tracking-wider text-slate-400">
            {WEEKDAY_LABELS.map((weekdayLabel) => (
              <div key={weekdayLabel}>{weekdayLabel}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-3">
            {monthDays.map((day) => (
              <DayCell
                key={toISODate(day)}
                day={day}
                today={today}
                inMonth={day.getMonth() === anchorDate.getMonth()}
                events={busyBlocksByDate.get(toISODate(day)) ?? []}
                compactEvents
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
