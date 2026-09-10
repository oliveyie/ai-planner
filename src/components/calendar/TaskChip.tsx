import { formatTimeLabel, parseISODateTime } from "@/src/lib/date-utils";
import type { Task, TaskType } from "@/src/lib/types";

const TYPE_STYLES: Record<TaskType, string> = {
  task: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  milestone:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  review:
    "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
  rest: "border-gray-300 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400",
  other:
    "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

export function TaskChip({ task, compact = false }: { task: Task; compact?: boolean }) {
  const time = task.scheduledStart ? formatTimeLabel(parseISODateTime(task.scheduledStart)) : null;
  const conflict = task.schedulingStatus === "conflict";

  return (
    <div
      title={task.description}
      className={`rounded border px-1.5 py-1 text-xs leading-tight ${TYPE_STYLES[task.type]} ${
        conflict ? "border-dashed opacity-70" : ""
      }`}
    >
      <div className="truncate font-medium">{task.title}</div>
      {!compact && time && <div className="opacity-70">{time}</div>}
      {conflict && <div className="text-[10px] uppercase tracking-wide">Unscheduled</div>}
    </div>
  );
}
