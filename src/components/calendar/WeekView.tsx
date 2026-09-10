import { addDays, formatDayLabel, isSameDay, startOfWeek, toISODate } from "@/src/lib/date-utils";
import type { Task } from "@/src/lib/types";
import { TaskChip } from "./TaskChip";

export function WeekView({
  anchorDate,
  tasksByDate,
}: {
  anchorDate: Date;
  tasksByDate: Map<string, Task[]>;
}) {
  const weekStart = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const key = toISODate(day);
        const tasks = tasksByDate.get(key) ?? [];
        return (
          <div
            key={key}
            className={`flex min-h-40 flex-col gap-1 rounded border p-2 ${
              isSameDay(day, today) ? "border-foreground/40" : "border-foreground/10"
            }`}
          >
            <div className="text-xs font-medium text-foreground/60">{formatDayLabel(day)}</div>
            <div className="flex flex-col gap-1">
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
