"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { formatTimeLabel, parseISODate, parseISODateTime } from "@/src/lib/utils/date-utils";
import { TASK_TYPE_STYLES } from "@/src/lib/utils/task-colors";
import type { Task } from "@/src/lib/utils/types";
import { TaskEditFields } from "./TaskEditFields";

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// A plan-card task row that can be clicked into an edit mode (title, date,
// start/end time) or deleted outright. Saves write straight through to the
// task's scheduling fields — deliberately not re-run through the
// deterministic scheduler (scheduler.ts): this is the user manually placing
// the task, not a regeneration, so their exact input wins. Leaving either
// time field blank on save keeps the task unscheduled (schedulingStatus:
// "conflict") rather than guessing a time for it.
export function EditableTaskRow({
  task,
  onSave,
  onDelete,
}: {
  task: Task;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
}) {
  // Draggable so this row can be moved onto another task (swaps their
  // scheduled times — see PlannerApp.handleTaskDragEnd) or onto the calendar
  // (retargets date/time from the drop position). Also droppable under the
  // same id, so another dragged task can land on this one.
  // role: "group" (not dnd-kit's default "button") — this row already
  // contains a real button for editing the title, so leaving it as "button"
  // gave two same-named buttons nested inside each other.
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id, attributes: { role: "group", roleDescription: "draggable task" } });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: task.id });
  function setDragAndDropRef(node: HTMLDivElement | null) {
    setDraggableRef(node);
    setDroppableRef(node);
  }

  const [editing, setEditing] = useState(false);

  const start = task.scheduledStart ? parseISODateTime(task.scheduledStart) : null;
  const end = task.scheduledEnd ? parseISODateTime(task.scheduledEnd) : null;
  const dayLabel = start ? WEEKDAY_SHORT[start.getDay()] : WEEKDAY_SHORT[parseISODate(task.preferredDate).getDay()];
  const style = TASK_TYPE_STYLES[task.type];

  function handleDelete() {
    if (window.confirm(`Delete "${task.title}"? This can't be undone.`)) {
      onDelete(task.id);
    }
  }

  if (editing) {
    return (
      <TaskEditFields
        task={task}
        onSave={(updated) => {
          onSave(updated);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div
      ref={setDragAndDropRef}
      {...listeners}
      {...attributes}
      aria-label={task.title}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={`touch-none cursor-grab rounded-2xl border p-3.5 transition-colors active:cursor-grabbing ${
        isOver ? "border-coral bg-peach/50" : "border-[#EDE2D4] bg-surface-low/60 hover:border-coral/40"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-coral/10 text-xs font-bold text-coral">
            {dayLabel}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-sm font-bold text-foreground hover:underline"
          >
            {task.title}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${style.chip}`}>
            {style.label}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${task.title}`}
            title="Delete task"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-clay-light transition-colors hover:bg-peach hover:text-peach-dark"
          >
            ×
          </button>
        </div>
      </div>
      <div className="pl-9 text-xs font-semibold text-coral">
        {task.schedulingStatus === "conflict"
          ? "needs new time"
          : start && end
            ? `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`
            : "not scheduled"}
      </div>
      {task.description && <p className="mt-1 pl-9 text-xs text-clay-light">{task.description}</p>}
    </div>
  );
}
