import { addDays, formatDayLabel, isSameDay, startOfWeek, toISODate } from "@/src/lib/date-utils";
import type { BusyBlock, Task } from "@/src/lib/types";
import { BusyBlockChip } from "./BusyBlockChip";
import { TaskChip } from "./TaskChip";

export function WeekView({
  anchorDate,
  tasksByDate,
  busyBlocksByDate,
}: {
  anchorDate: Date;
  tasksByDate: Map<string, Task[]>;
  busyBlocksByDate?: Map<string, BusyBlock[]>;
}) {
  const weekStart = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((day) => {
        const key = toISODate(day);
        const tasks = tasksByDate.get(key) ?? [];
        const busyBlocks = busyBlocksByDate?.get(key) ?? [];
        const isToday = isSameDay(day, today);
        return (
          <div
            key={key}
            className={`flex min-h-40 flex-col gap-1 rounded-2xl p-2 ${
              isToday
                ? "border-2 border-coral/50 bg-buttercup/50 shadow-sm"
                : "border border-[#EDE2D4]/40 bg-surface-low/40"
            }`}
          >
            {isToday ? (
              <div className="flex items-center justify-between">
                <span className="font-quicksand text-[11px] font-bold uppercase text-coral">Today</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">
                  {day.getDate()}
                </span>
              </div>
            ) : (
              <div className="font-quicksand text-xs font-bold text-foreground">{formatDayLabel(day)}</div>
            )}
            <div className="flex flex-col gap-1">
              {busyBlocks.map((block, i) => (
                <BusyBlockChip key={`busy-${i}`} block={block} />
              ))}
              {tasks.map((task) => (
                <TaskChip key={task.id} task={task} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
