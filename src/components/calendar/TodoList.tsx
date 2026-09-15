"use client";

import { parseISODate } from "@/src/lib/utils/date-utils";
import type { GoogleTask } from "@/src/lib/utils/types";

// The Agenda tab's sidebar — Google's own premade "Tasks" list (a separate
// API/scope from Google Calendar, see google-tasks-api.ts), not this app's
// plan tasks. Microsoft To Do isn't wired up yet (would need its own Graph
// scope + fetch); the empty state below only ever points at Google.
export function TodoList({
  tasks,
  connected,
  error,
  onToggleComplete,
}: {
  tasks: GoogleTask[];
  connected: boolean;
  error: boolean;
  onToggleComplete: (taskId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-[#EDE2D4]/50 bg-surface-low/20 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-clay-light">Tasks</span>

      {!connected && (
        <p className="text-xs text-clay-light">Connect Google Calendar to see your Google Tasks here.</p>
      )}

      {connected && error && (
        <p className="text-xs text-clay-light">
          Couldn&apos;t load your Google Tasks — try disconnecting and reconnecting Google to grant access.
        </p>
      )}

      {connected && !error && tasks.length === 0 && <p className="text-xs text-clay-light">Nothing on your list.</p>}

      {connected && !error && tasks.length > 0 && (
        <ul className="flex flex-col gap-1.5 overflow-y-auto">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-card">
              <button
                type="button"
                onClick={() => onToggleComplete(task.id)}
                aria-label={`Mark "${task.title}" complete`}
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-clay-light/50 transition-colors hover:border-coral hover:bg-coral/10"
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">{task.title}</div>
                {task.due && (
                  <div className="text-[10px] text-clay-light">
                    {parseISODate(task.due.slice(0, 10)).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
