import { addDays, isSameDay, startOfMonth, startOfWeek, toISODate } from "@/src/lib/date-utils";
import type { Task } from "@/src/lib/types";
import { TaskChip } from "./TaskChip";

const MAX_VISIBLE = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // matches this app's Sunday-start week

export function MonthView({
  anchorDate,
  tasksByDate,
}: {
  anchorDate: Date;
  tasksByDate: Map<string, Task[]>;
}) {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1.5 border-b border-[#EDE2D4]/70 pb-2 text-center sm:gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="font-quicksand text-xs font-bold uppercase tracking-wider text-clay">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
        const key = toISODate(day);
        const tasks = tasksByDate.get(key) ?? [];
        const inMonth = day.getMonth() === monthStart.getMonth();
        const isToday = isSameDay(day, today);
        const visible = tasks.slice(0, MAX_VISIBLE);
        const overflow = tasks.length - visible.length;

        return (
          <div
            key={key}
            className={`flex min-h-24 flex-col gap-1 rounded-2xl p-2 ${
              isToday
                ? "border-2 border-coral/50 bg-buttercup/50 shadow-sm"
                : inMonth
                  ? "border border-[#EDE2D4]/40 bg-surface-low/40"
                  : "border border-transparent bg-surface-low/20 opacity-40"
            }`}
          >
            {isToday ? (
              <div className="flex items-center justify-between">
                <span className="font-quicksand text-[10px] font-bold uppercase text-coral">Today</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">
                  {day.getDate()}
                </span>
              </div>
            ) : (
              <span className="font-quicksand text-xs font-bold text-foreground">{day.getDate()}</span>
            )}
            <div className="flex flex-col gap-1">
              {visible.map((task) => (
                <TaskChip key={task.id} task={task} compact />
              ))}
              {overflow > 0 && (
                <div className="font-quicksand text-[10px] font-semibold text-clay-light">+{overflow} more</div>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}
