import { parseISODate } from "@/src/lib/utils/date-utils";
import type { BusyBlock, Task } from "@/src/lib/utils/types";
import { BusyBlockChip } from "./BusyBlockChip";
import { TaskChip } from "./TaskChip";

export function AgendaList({
  tasksByDate,
  busyBlocksByDate,
  onSelectTask,
  onSelectBusyBlock,
}: {
  tasksByDate: Map<string, Task[]>;
  busyBlocksByDate?: Map<string, BusyBlock[]>;
  onSelectTask?: (task: Task) => void;
  onSelectBusyBlock?: (block: BusyBlock) => void;
}) {
  const sortedDates = Array.from(new Set([...tasksByDate.keys(), ...(busyBlocksByDate?.keys() ?? [])])).sort();

  if (sortedDates.length === 0) {
    return <p className="font-fraunces text-sm text-clay">No tasks yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sortedDates.map((dateKey) => (
        <div key={dateKey} className="flex flex-col gap-1.5">
          <div className="text-sm font-bold text-foreground">
            {parseISODate(dateKey).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            {(busyBlocksByDate?.get(dateKey) ?? []).map((block, i) => (
              <BusyBlockChip key={`busy-${i}`} block={block} onClick={onSelectBusyBlock} />
            ))}
            {(tasksByDate.get(dateKey) ?? []).map((task) => (
              <TaskChip key={task.id} task={task} onClick={onSelectTask} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
