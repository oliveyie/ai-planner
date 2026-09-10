import { parseISODate } from "@/src/lib/date-utils";
import type { Task } from "@/src/lib/types";
import { TaskChip } from "./TaskChip";

export function AgendaList({ tasksByDate }: { tasksByDate: Map<string, Task[]> }) {
  const sortedDates = Array.from(tasksByDate.keys()).sort();

  if (sortedDates.length === 0) {
    return <p className="text-sm text-foreground/60">No tasks yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sortedDates.map((dateKey) => (
        <div key={dateKey} className="flex flex-col gap-1">
          <div className="text-sm font-medium">
            {parseISODate(dateKey).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="flex flex-col gap-1">
            {tasksByDate.get(dateKey)!.map((task) => (
              <TaskChip key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
