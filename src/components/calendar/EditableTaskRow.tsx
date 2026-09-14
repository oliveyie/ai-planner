"use client";

import { useState, type KeyboardEvent } from "react";
import { formatTimeLabel, parseISODate, parseISODateTime, toISODate } from "@/src/lib/utils/date-utils";
import { TASK_TYPE_STYLES } from "@/src/lib/utils/task-colors";
import type { Task } from "@/src/lib/utils/types";

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function timeOfDay(iso?: string): string {
  if (!iso) return "";
  const [, time] = iso.split("T");
  return time ?? "";
}

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
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(
    task.scheduledStart ? toISODate(parseISODateTime(task.scheduledStart)) : task.preferredDate,
  );
  const [startTime, setStartTime] = useState(timeOfDay(task.scheduledStart));
  const [endTime, setEndTime] = useState(timeOfDay(task.scheduledEnd));

  const start = task.scheduledStart ? parseISODateTime(task.scheduledStart) : null;
  const end = task.scheduledEnd ? parseISODateTime(task.scheduledEnd) : null;
  const dayLabel = start ? WEEKDAY_SHORT[start.getDay()] : WEEKDAY_SHORT[parseISODate(task.preferredDate).getDay()];
  const style = TASK_TYPE_STYLES[task.type];

  function resetFields() {
    setTitle(task.title);
    setDate(task.scheduledStart ? toISODate(parseISODateTime(task.scheduledStart)) : task.preferredDate);
    setStartTime(timeOfDay(task.scheduledStart));
    setEndTime(timeOfDay(task.scheduledEnd));
  }

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const scheduled = Boolean(startTime && endTime);
    onSave({
      ...task,
      title: trimmedTitle,
      preferredDate: date,
      scheduledStart: scheduled ? `${date}T${startTime}` : undefined,
      scheduledEnd: scheduled ? `${date}T${endTime}` : undefined,
      schedulingStatus: scheduled ? "scheduled" : "conflict",
    });
    setEditing(false);
  }

  function handleCancel() {
    resetFields();
    setEditing(false);
  }

  function handleDelete() {
    if (window.confirm(`Delete "${task.title}"? This can't be undone.`)) {
      onDelete(task.id);
    }
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-coral/40 bg-surface-low/60 p-3.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          className="w-full rounded-lg border border-[#EDE2D4] bg-white px-2 py-1 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-coral/50"
          placeholder="Task title"
          autoFocus
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-[#EDE2D4] bg-white px-2 py-1 text-foreground"
          />
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-lg border border-[#EDE2D4] bg-white px-2 py-1 text-foreground"
          />
          <span className="text-clay-light">–</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-lg border border-[#EDE2D4] bg-white px-2 py-1 text-foreground"
          />
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-coral px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-[#e86b45]"
          >
            save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full border border-[#EDE2D4] px-3 py-1 text-xs font-bold text-clay transition-colors hover:text-foreground"
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EDE2D4] bg-surface-low/60 p-3.5 transition-colors hover:border-coral/40">
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
