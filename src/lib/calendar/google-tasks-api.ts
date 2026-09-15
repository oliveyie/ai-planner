// Client-side reads/writes against the Google Tasks API (tasks.googleapis.com)
// — a separate API and OAuth scope from Google Calendar (calendar-api.ts).
// Powers the Agenda tab's todo-list sidebar. Only the "@default" task list is
// used (Google's own "My Tasks", the premade list the user described) —
// listing/selecting among multiple task lists isn't supported yet.

import { getCalendarConnection } from "../db/db";
import type { GoogleTask } from "../utils/types";
import { ensureValidAccessToken } from "./calendar-api";

const TASKS_BASE_URL = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";

type GoogleTasksListResponse = {
  items?: Array<{ id: string; title?: string; notes?: string; due?: string; status?: string }>;
};

// Throws (rather than swallowing to []) so the caller can tell "not
// connected" / "genuinely zero tasks" apart from "the request failed" (most
// likely a pre-existing connection that hasn't granted the tasks scope yet)
// and show a real "reconnect Google" message instead of just an empty list.
export async function fetchGoogleTasks(): Promise<GoogleTask[]> {
  const connection = await getCalendarConnection("google");
  if (!connection) return [];

  const validConnection = await ensureValidAccessToken(connection);
  const params = new URLSearchParams({ showCompleted: "false", showHidden: "false", maxResults: "100" });

  const response = await fetch(`${TASKS_BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${validConnection.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Tasks: ${await response.text()}`);
  }

  const data = (await response.json()) as GoogleTasksListResponse;
  return (data.items ?? [])
    .filter((item): item is { id: string; title: string; notes?: string; due?: string; status?: string } =>
      Boolean(item.title),
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      notes: item.notes,
      due: item.due,
      completed: item.status === "completed",
    }))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

// Fire-and-forget from the caller's perspective (PlannerApp removes the task
// from local state optimistically) — checking a task off here never
// resurfaces it, since this list only ever fetches incomplete tasks.
export async function setGoogleTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  const connection = await getCalendarConnection("google");
  if (!connection) return;
  const validConnection = await ensureValidAccessToken(connection);

  await fetch(`${TASKS_BASE_URL}/${taskId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${validConnection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: completed ? "completed" : "needsAction" }),
  });
}
