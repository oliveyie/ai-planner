"use client";

import { useDraggable } from "@dnd-kit/core";
import { formatTimeLabel, parseISODateTime } from "@/src/lib/utils/date-utils";
import { PLAN_TASK_CHIP_DRAFT_CLASS, PLAN_TASK_CHIP_SYNCED_CLASS } from "@/src/lib/utils/task-colors";
import type { Task } from "@/src/lib/utils/types";

export function TaskChip({
  task,
  compact = false,
  onClick,
  draggableId,
}: {
  task: Task;
  compact?: boolean;
  onClick?: (task: Task) => void;
  // Passed only by WeekView (the sole view with drag-to-reschedule) — its
  // presence both enables the drag listeners below and gives the drag a
  // distinct id (e.g. "cal:<taskId>") so it doesn't collide with the plan
  // card's own useDraggable on the plain task id, which can be mounted at
  // the same time.
  draggableId?: string;
}) {
  // Always called (rules of hooks) — the listeners are simply left off the
  // DOM node below when draggableId isn't provided, so it stays inert.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId ?? task.id,
    attributes: { role: "group", roleDescription: "draggable task" },
  });

  const time = task.scheduledStart ? formatTimeLabel(parseISODateTime(task.scheduledStart)) : null;
  const conflict = task.schedulingStatus === "conflict";
  const draft = !task.syncedEventId;

  return (
    <div
      ref={draggableId ? setNodeRef : undefined}
      {...(draggableId ? { ...listeners, ...attributes } : {})}
      onClick={onClick ? () => onClick(task) : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(task);
              }
            }
          : undefined
      }
      title={task.description}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={`rounded-lg border px-1.5 py-1 text-[11px] font-semibold leading-tight ${
        draft ? PLAN_TASK_CHIP_DRAFT_CLASS : PLAN_TASK_CHIP_SYNCED_CLASS
      } ${conflict ? "border-dashed opacity-70" : ""} ${onClick ? "cursor-pointer" : ""} ${
        draggableId ? "touch-none cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="truncate">{task.title}</div>
      {!compact && time && <div className="font-medium opacity-70">{time}</div>}
      {conflict && <div className="text-[9px] font-bold uppercase tracking-wide">Unscheduled</div>}
    </div>
  );
}
