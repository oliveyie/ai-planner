import { formatTimeLabel, parseISODateTime } from "@/src/lib/date-utils";
import { PLAN_TASK_CHIP_CLASS } from "@/src/lib/task-colors";
import type { Task } from "@/src/lib/types";

export function TaskChip({ task, compact = false }: { task: Task; compact?: boolean }) {
  const time = task.scheduledStart ? formatTimeLabel(parseISODateTime(task.scheduledStart)) : null;
  const conflict = task.schedulingStatus === "conflict";

  return (
    <div
      title={task.description}
      className={`rounded-lg border px-1.5 py-1 font-quicksand text-[11px] font-semibold leading-tight ${PLAN_TASK_CHIP_CLASS} ${
        conflict ? "border-dashed opacity-70" : ""
      }`}
    >
      <div className="truncate">{task.title}</div>
      {!compact && time && <div className="font-medium opacity-70">{time}</div>}
      {conflict && <div className="text-[9px] font-bold uppercase tracking-wide">Unscheduled</div>}
    </div>
  );
}
