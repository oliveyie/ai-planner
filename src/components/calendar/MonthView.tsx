import { addDays, isSameDay, startOfMonth, startOfWeek, toISODate } from "@/src/lib/date-utils";
import type { Task } from "@/src/lib/types";
import { TaskChip } from "./TaskChip";

const MAX_VISIBLE = 3;

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
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const key = toISODate(day);
        const tasks = tasksByDate.get(key) ?? [];
        const inMonth = day.getMonth() === monthStart.getMonth();
        const visible = tasks.slice(0, MAX_VISIBLE);
        const overflow = tasks.length - visible.length;

        return (
          <div
            key={key}
            className={`flex min-h-24 flex-col gap-1 rounded border p-2 ${
              inMonth ? "border-foreground/10" : "border-foreground/5 opacity-40"
            } ${isSameDay(day, today) ? "border-foreground/40" : ""}`}
          >
            <div className="text-xs font-medium text-foreground/60">{day.getDate()}</div>
            <div className="flex flex-col gap-1">
              {visible.map((task) => (
                <TaskChip key={task.id} task={task} compact />
              ))}
              {overflow > 0 && <div className="text-[10px] text-foreground/50">+{overflow} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
