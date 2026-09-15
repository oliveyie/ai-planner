import { useDroppable } from "@dnd-kit/core";
import {
  addDays,
  formatHourLabel,
  isSameDay,
  parseISODateTime,
  startOfWeek,
  toISODate,
} from "@/src/lib/utils/date-utils";
import { layoutDayColumn } from "@/src/lib/calendar/time-grid";
import type { BusyBlock, Task } from "@/src/lib/utils/types";
import { BusyBlockChip } from "./BusyBlockChip";
import { TaskChip } from "./TaskChip";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // matches this app's Sunday-start week
const DEFAULT_PX_PER_HOUR = 56;
const DEFAULT_RANGE_START_HOUR = 6; // matches scheduler.ts's day window, so a
const DEFAULT_RANGE_END_HOUR = 21; // typical day never needs to scroll to see anything

type GridEntry =
  | { kind: "task"; task: Task; start: Date; end: Date }
  | { kind: "busy"; block: BusyBlock; start: Date; end: Date };

type PositionedGridEntry = {
  entry: GridEntry;
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
};

// A separate component (not inlined in a .map()) since useDroppable is a
// hook — rules of hooks forbid calling one a variable number of times inside
// a loop body. Registers this whole day column as a drop target for a
// dragged task; PlannerApp.handleTaskDragEnd reads `rangeStartMinutes` and
// `pxPerMinute` back off the drop event to convert the drop's pixel position
// into an actual time (snapped to the nearest 15 minutes).
function DroppableDayColumn({
  dateKey,
  isToday,
  hours,
  rangeStartHour,
  rangeStartMinutes,
  pxPerHour,
  pxPerMinute,
  positioned,
  onSelectTask,
  onSelectBusyBlock,
}: {
  dateKey: string;
  isToday: boolean;
  hours: number[];
  rangeStartHour: number;
  rangeStartMinutes: number;
  pxPerHour: number;
  pxPerMinute: number;
  positioned: PositionedGridEntry[];
  onSelectTask?: (task: Task) => void;
  onSelectBusyBlock?: (block: BusyBlock) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `daycol:${dateKey}`,
    data: { date: dateKey, rangeStartMinutes, pxPerMinute },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-lg ${isOver ? "bg-peach/40" : isToday ? "bg-buttercup/25" : "bg-surface-card/60"}`}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 border-t border-[#EDE2D4]/50"
          style={{ top: (hour - rangeStartHour) * pxPerHour }}
        />
      ))}
      {positioned.map(({ entry, top, height, leftPercent, widthPercent }, i) => (
        <div
          key={i}
          className="absolute overflow-hidden px-0.5"
          style={{ top, height, left: `${leftPercent}%`, width: `${widthPercent}%` }}
        >
          {entry.kind === "task" ? (
            <TaskChip
              task={entry.task}
              compact
              draggableId={`cal:${entry.task.id}`}
              onClick={onSelectTask}
              className="h-full w-full"
            />
          ) : (
            <BusyBlockChip block={entry.block} compact onClick={onSelectBusyBlock} className="h-full w-full" />
          )}
        </div>
      ))}
    </div>
  );
}

export function WeekView({
  anchorDate,
  tasksByDate,
  busyBlocksByDate,
  onSelectTask,
  onSelectBusyBlock,
  pxPerHour = DEFAULT_PX_PER_HOUR,
  maxHeightClassName = "max-h-[32rem]",
  days: daysOverride,
}: {
  anchorDate: Date;
  tasksByDate?: Map<string, Task[]>;
  busyBlocksByDate?: Map<string, BusyBlock[]>;
  onSelectTask?: (task: Task) => void;
  onSelectBusyBlock?: (block: BusyBlock) => void;
  // Both let the "bigger calendar" expanded modal render a taller, roomier
  // grid instead of just a bigger empty frame around the same-size content.
  pxPerHour?: number;
  maxHeightClassName?: string;
  // Overrides the computed 7-day week — the Agenda tab reuses this whole
  // component as a single-day time grid by passing days={[anchorDate]},
  // rather than duplicating all of this grid/drag/click logic for one column.
  days?: Date[];
}) {
  const weekStart = startOfWeek(anchorDate);
  const days = daysOverride ?? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const gridTemplateColumns = `2.75rem repeat(${days.length}, 1fr)`;
  const today = new Date();

  const unscheduledTasks: Task[] = [];
  const dayColumns = days.map((day) => {
    const key = toISODate(day);
    const tasks = tasksByDate?.get(key) ?? [];
    const entries: GridEntry[] = [];

    for (const task of tasks) {
      if (task.scheduledStart && task.scheduledEnd) {
        entries.push({
          kind: "task",
          task,
          start: parseISODateTime(task.scheduledStart),
          end: parseISODateTime(task.scheduledEnd),
        });
      } else {
        unscheduledTasks.push(task);
      }
    }
    for (const block of busyBlocksByDate?.get(key) ?? []) {
      entries.push({ kind: "busy", block, start: new Date(block.start), end: new Date(block.end) });
    }

    return { day, key, entries };
  });

  // Extend the default 6am–9pm window rather than clip anything that falls
  // outside it (an early flight, a late call) — most days never need this.
  let rangeStartHour = DEFAULT_RANGE_START_HOUR;
  let rangeEndHour = DEFAULT_RANGE_END_HOUR;
  for (const { entries } of dayColumns) {
    for (const { start, end } of entries) {
      rangeStartHour = Math.min(rangeStartHour, start.getHours());
      rangeEndHour = Math.max(rangeEndHour, end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours());
    }
  }
  rangeStartHour = Math.max(0, rangeStartHour);
  rangeEndHour = Math.min(24, Math.max(rangeEndHour, rangeStartHour + 1));

  const hours = Array.from({ length: rangeEndHour - rangeStartHour }, (_, i) => rangeStartHour + i);
  const gridHeight = (rangeEndHour - rangeStartHour) * pxPerHour;
  const pxPerMinute = pxPerHour / 60;
  const rangeStartMinutes = rangeStartHour * 60;

  return (
    <div className="flex flex-col gap-2">
      {unscheduledTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-[#EDE2D4] bg-surface-low/50 p-2">
          <span className="px-1 text-[11px] font-bold text-clay-light">Needs a time:</span>
          {unscheduledTasks.map((task) => (
            <TaskChip key={task.id} task={task} compact onClick={onSelectTask} />
          ))}
        </div>
      )}

      <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns }}>
        <div />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={toISODate(day)}
              className={`rounded-lg py-1 text-center text-[11px] font-bold uppercase tracking-wide ${
                isToday ? "bg-buttercup/60 text-coral" : "text-clay"
              }`}
            >
              {WEEKDAY_LABELS[day.getDay()]} <span className={isToday ? "" : "text-foreground"}>{day.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className={`${maxHeightClassName} overflow-y-auto rounded-2xl border border-[#EDE2D4]/50 bg-surface-low/20`}>
        <div className="grid gap-1.5 p-1 sm:gap-2" style={{ height: gridHeight, gridTemplateColumns }}>
          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-1 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold text-clay-light"
                style={{ top: (hour - rangeStartHour) * pxPerHour }}
              >
                {formatHourLabel(hour)}
              </div>
            ))}
          </div>

          {dayColumns.map(({ day, key, entries }) => {
            const isToday = isSameDay(day, today);
            const positioned = layoutDayColumn(
              entries,
              (e) => e.start,
              (e) => e.end,
              pxPerMinute,
              rangeStartMinutes,
            );

            return (
              <DroppableDayColumn
                key={key}
                dateKey={key}
                isToday={isToday}
                hours={hours}
                rangeStartHour={rangeStartHour}
                rangeStartMinutes={rangeStartMinutes}
                pxPerHour={pxPerHour}
                pxPerMinute={pxPerMinute}
                positioned={positioned}
                onSelectTask={onSelectTask}
                onSelectBusyBlock={onSelectBusyBlock}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
