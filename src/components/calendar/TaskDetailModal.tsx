"use client";

import { useState } from "react";
import { Modal } from "@/src/components/ui/Modal";
import { CALENDAR_PROVIDER_NAMES } from "@/src/lib/providers/provider-labels";
import { formatTimeLabel, parseISODate, parseISODateTime } from "@/src/lib/utils/date-utils";
import type { Task } from "@/src/lib/utils/types";
import { TaskEditFields } from "./TaskEditFields";

// Opened by clicking a task chip anywhere on the calendar (WeekView, MonthView,
// AgendaList) — same save/delete contract as EditableTaskRow (the plan
// card's inline editor), just presented as a modal instead of a list row, so
// clicking a task on the calendar itself gives the same editing power without
// having to go find it in the plan card.
export function TaskDetailModal({
  task,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const start = task.scheduledStart ? parseISODateTime(task.scheduledStart) : null;
  const end = task.scheduledEnd ? parseISODateTime(task.scheduledEnd) : null;

  function handleDelete() {
    if (window.confirm(`Delete "${task.title}"? This can't be undone.`)) {
      onDelete(task.id);
      onClose();
    }
  }

  if (editing) {
    return (
      <Modal onClose={onClose}>
        <TaskEditFields
          task={task}
          onSave={(updated) => {
            onSave(updated);
            setEditing(false);
            onClose();
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-2">
        {task.syncedEventId ? (
          <span className="rounded-full bg-sage px-2 py-0.5 text-[11px] font-bold text-sage-dark">
            synced to {task.syncedProvider ? CALENDAR_PROVIDER_NAMES[task.syncedProvider] : "your calendar"}
          </span>
        ) : (
          <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-bold text-coral">
            draft — not pushed yet
          </span>
        )}
      </div>

      <h2 className="font-fraunces text-xl font-semibold tracking-tight text-foreground">{task.title}</h2>

      <p className="text-sm font-semibold text-coral">
        {task.schedulingStatus === "conflict"
          ? "needs new time"
          : start && end
            ? `${parseISODate(task.preferredDate).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })} · ${formatTimeLabel(start)} – ${formatTimeLabel(end)}`
            : "not scheduled"}
      </p>

      {task.description && <p className="text-sm text-clay-light">{task.description}</p>}

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-full bg-coral px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#e86b45]"
        >
          edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-full border border-[#EDE2D4] px-3.5 py-1.5 text-xs font-bold text-clay transition-colors hover:border-peach-dark/40 hover:text-peach-dark"
        >
          delete
        </button>
      </div>
    </Modal>
  );
}
