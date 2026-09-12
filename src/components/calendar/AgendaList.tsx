import { parseISODate } from "@/src/lib/date-utils";
import type { Task } from "@/src/lib/types";
import { TaskChip } from "./TaskChip";

export function AgendaList({ tasksByDate }: { tasksByDate: Map<string, Task[]> }) {
  const sortedDates = Array.from(tasksByDate.keys()).sort();

  if (sortedDates.length === 0) {
    return <p className="font-quicksand text-sm text-clay">No tasks yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sortedDates.map((dateKey) => (
        <div key={dateKey} className="flex flex-col gap-1.5">
          <div className="font-quicksand text-sm font-bold text-foreground">
            {parseISODate(dateKey).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            {tasksByDate.get(dateKey)!.map((task) => (
              <TaskChip key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
