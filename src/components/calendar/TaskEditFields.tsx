"use client";

import { useState, type KeyboardEvent } from "react";
import { parseISODateTime, toISODate } from "@/src/lib/utils/date-utils";
import type { Task } from "@/src/lib/utils/types";

function timeOfDay(iso?: string): string {
  if (!iso) return "";
  const [, time] = iso.split("T");
  return time ?? "";
}

// The title/date/start-end-time editing form, extracted out of
// EditableTaskRow so it can also render inside TaskDetailModal (a calendar
// click) without dragging in EditableTaskRow's useDraggable/useDroppable
// hooks — those are keyed on task.id, and the plan-card row for the same
// task can be mounted at the same time, so a second copy of those hooks
// would collide. This component is plain presentational state, safe to
// mount anywhere.
export function TaskEditFields({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (task: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(
    task.scheduledStart ? toISODate(parseISODateTime(task.scheduledStart)) : task.preferredDate,
  );
  const [startTime, setStartTime] = useState(timeOfDay(task.scheduledStart));
  const [endTime, setEndTime] = useState(timeOfDay(task.scheduledEnd));

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
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

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
          onClick={onCancel}
          className="rounded-full border border-[#EDE2D4] px-3 py-1 text-xs font-bold text-clay transition-colors hover:text-foreground"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
