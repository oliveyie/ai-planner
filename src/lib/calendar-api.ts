// Client-side calendar reads and writes (SPEC.md §6). Both directions go
// directly from the browser to each provider's API using the stored access
// token — only token exchange/refresh (src/lib/oauth-providers.ts) needs the
// server, since only those require the client secret.

import { getCalendarConnection, saveCalendarConnection } from "./db";
import { mapPlanTasks } from "./plan-utils";
import type { BusyBlock, CalendarConnection, CalendarProvider, Goal, Plan, Task } from "./types";

async function ensureValidAccessToken(connection: CalendarConnection): Promise<CalendarConnection> {
  const stillValid = new Date(connection.expiresAt).getTime() > Date.now() + 60_000;
  if (stillValid || !connection.refreshToken) {
    return connection;
  }

  const response = await fetch(`/api/auth/${connection.provider}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: connection.refreshToken }),
  });
  if (!response.ok) {
    // Let the caller's API call fail with the stale token rather than throwing here —
    // a refresh hiccup shouldn't be fatal to the whole operation.
    return connection;
  }

  const tokens = (await response.json()) as {
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
  };
  const updated: CalendarConnection = {
    ...connection,
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    refreshToken: tokens.refreshToken ?? connection.refreshToken,
  };
  await saveCalendarConnection(updated);
  return updated;
}

function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Used whenever a provider doesn't give us a usable color for a calendar
// (Microsoft's "auto", or a listing call that fails) — reuses this app's own
// accent palette so fallback colors still feel native to Whimble.
const FALLBACK_PALETTE = ["#F97C56", "#3B7A57", "#2B749E", "#7053A8", "#A67C1E", "#D96B43"];

function fallbackColor(index: number): string {
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

type CalendarIdentity = { id: string; name: string; color: string };

// ---------------------------------------------------------------------------
// Read: events (not just freebusy) so real titles can be shown (SPEC.md §3/§4/§6).
// Queried across every calendar in the account, not just the primary/default
// one — a user's real commitments are often split across a work calendar, a
// shared calendar, etc., and busy time on any of them should count. Each
// calendar's own name and color (as the user already set it up in Google/
// Outlook) are carried onto every BusyBlock for the legend/chip coloring.
// ---------------------------------------------------------------------------

type GoogleEventsResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    status?: string;
    transparency?: string;
    start: { date?: string; dateTime?: string };
    end: { date?: string; dateTime?: string };
  }>;
};

type GoogleCalendarListResponse = {
  items?: Array<{ id: string; summary?: string; backgroundColor?: string }>;
};

async function fetchGoogleCalendars(connection: CalendarConnection): Promise<CalendarIdentity[]> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to list Google calendars: ${await response.text()}`);
  }
  const data = (await response.json()) as GoogleCalendarListResponse;
  return (data.items ?? []).map((item, index) => ({
    id: item.id,
    name: item.summary ?? item.id,
    color: item.backgroundColor ?? fallbackColor(index),
  }));
}

async function fetchGoogleEventsForCalendar(
  connection: CalendarConnection,
  calendar: CalendarIdentity,
  start: Date,
  end: Date,
): Promise<BusyBlock[]> {
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${connection.accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Google events fetch failed for ${calendar.id}: ${await response.text()}`);
  }

  const data = (await response.json()) as GoogleEventsResponse;
  const items = data.items ?? [];

  return items
    .filter(
      (event) =>
        event.status !== "cancelled" &&
        event.transparency !== "transparent" && // "transparent" = marked as free, doesn't block
        !!event.start.dateTime, // skip all-day events (those use `date`, not `dateTime`) — also filters out most Holidays/Birthdays calendar noise
    )
    .map((event) => ({
      start: event.start.dateTime!,
      end: event.end.dateTime!,
      source: "google" as const,
      title: event.summary,
      calendarId: calendar.id,
      calendarName: calendar.name,
      color: calendar.color,
    }));
}

async function fetchGoogleEvents(connection: CalendarConnection, start: Date, end: Date): Promise<BusyBlock[]> {
  let calendars: CalendarIdentity[];
  try {
    calendars = await fetchGoogleCalendars(connection);
  } catch {
    calendars = [];
  }
  if (calendars.length === 0) {
    calendars = [{ id: "primary", name: "Google Calendar", color: fallbackColor(0) }]; // fall back to what v1 originally queried if listing fails
  }

  const results = await Promise.all(
    calendars.map((calendar) =>
      fetchGoogleEventsForCalendar(connection, calendar, start, end).catch(() => [] as BusyBlock[]),
    ),
  );
  return results.flat();
}

type MicrosoftCalendarViewResponse = {
  value?: Array<{
    start: { dateTime: string };
    end: { dateTime: string };
    showAs: string;
    isAllDay: boolean;
    subject?: string;
  }>;
};

type MicrosoftCalendarListResponse = {
  value?: Array<{ id: string; name?: string; color?: string; hexColor?: string }>;
};

// Graph's `color` field is a named preset, not a hex value — approximate the
// ones we know; anything else (including "auto") falls back to the palette.
const MICROSOFT_COLOR_HEX: Record<string, string> = {
  lightBlue: "#4A9FE8",
  lightGreen: "#6BCB77",
  lightOrange: "#FFA552",
  lightGray: "#9AA0A6",
  lightYellow: "#F4D35E",
  lightTeal: "#4FB6A8",
  lightPink: "#F6A6C1",
  lightBrown: "#A9744F",
  lightRed: "#E86A6A",
};

async function fetchMicrosoftCalendars(connection: CalendarConnection): Promise<CalendarIdentity[]> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/calendars", {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to list Outlook calendars: ${await response.text()}`);
  }
  const data = (await response.json()) as MicrosoftCalendarListResponse;
  return (data.value ?? []).map((item, index) => ({
    id: item.id,
    name: item.name ?? item.id,
    color: item.hexColor?.trim() || MICROSOFT_COLOR_HEX[item.color ?? ""] || fallbackColor(index),
  }));
}

async function fetchMicrosoftEventsForCalendar(
  connection: CalendarConnection,
  calendar: CalendarIdentity | null,
  start: Date,
  end: Date,
): Promise<BusyBlock[]> {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: "start,end,showAs,isAllDay,subject",
    $top: "999",
  });

  // A null calendar means "default calendar" — the same endpoint this app
  // used before calendars were enumerated, kept as a fallback.
  const url = calendar
    ? `https://graph.microsoft.com/v1.0/me/calendars/${calendar.id}/calendarView?${params.toString()}`
    : `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!response.ok) {
    throw new Error(`Microsoft calendar fetch failed for ${calendar?.id ?? "default"}: ${await response.text()}`);
  }

  const data = (await response.json()) as MicrosoftCalendarViewResponse;
  const events = data.value ?? [];
  const identity: CalendarIdentity = calendar ?? { id: "default", name: "Outlook Calendar", color: fallbackColor(0) };

  return events
    .filter((event) => !event.isAllDay && (event.showAs === "busy" || event.showAs === "oof"))
    .map((event) => ({
      // Graph returns naive local datetimes when a timezone is requested via
      // the Prefer header (no offset/Z) — append Z since we requested UTC.
      start: `${event.start.dateTime}Z`,
      end: `${event.end.dateTime}Z`,
      source: "microsoft" as const,
      title: event.subject,
      calendarId: identity.id,
      calendarName: identity.name,
      color: identity.color,
    }));
}

async function fetchMicrosoftEvents(connection: CalendarConnection, start: Date, end: Date): Promise<BusyBlock[]> {
  let calendars: CalendarIdentity[];
  try {
    calendars = await fetchMicrosoftCalendars(connection);
  } catch {
    calendars = [];
  }
  if (calendars.length === 0) {
    return fetchMicrosoftEventsForCalendar(connection, null, start, end); // fall back to the default calendar
  }

  const results = await Promise.all(
    calendars.map((calendar) =>
      fetchMicrosoftEventsForCalendar(connection, calendar, start, end).catch(() => [] as BusyBlock[]),
    ),
  );
  return results.flat();
}

export async function fetchCalendarEvents(start: Date, end: Date): Promise<BusyBlock[]> {
  const providers: CalendarProvider[] = ["google", "microsoft"];
  const results: BusyBlock[] = [];

  for (const provider of providers) {
    const connection = await getCalendarConnection(provider);
    if (!connection) continue;

    const validConnection = await ensureValidAccessToken(connection);
    try {
      const blocks =
        provider === "google"
          ? await fetchGoogleEvents(validConnection, start, end)
          : await fetchMicrosoftEvents(validConnection, start, end);
      results.push(...blocks);
    } catch {
      // One provider failing shouldn't block generation — schedule around
      // whatever busy data is actually available.
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Write: push a plan to one connected provider (SPEC.md §6).
// ---------------------------------------------------------------------------

async function ensureGoogleCalendar(connection: CalendarConnection, goal: Goal): Promise<string> {
  const existing = goal.externalCalendarIds?.google;
  if (existing) return existing;

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary: `${goal.title} Plan` }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create Google calendar: ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

async function ensureMicrosoftCalendar(connection: CalendarConnection, goal: Goal): Promise<string> {
  const existing = goal.externalCalendarIds?.microsoft;
  if (existing) return existing;

  const response = await fetch("https://graph.microsoft.com/v1.0/me/calendars", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: `${goal.title} Plan` }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create Outlook calendar: ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

async function writeGoogleEvent(
  connection: CalendarConnection,
  calendarId: string,
  task: Task,
  timeZone: string,
): Promise<string> {
  const body = JSON.stringify({
    summary: task.title,
    description: task.description,
    start: { dateTime: task.scheduledStart, timeZone },
    end: { dateTime: task.scheduledEnd, timeZone },
  });
  const headers = {
    Authorization: `Bearer ${connection.accessToken}`,
    "Content-Type": "application/json",
  };

  const url =
    task.syncedProvider === "google" && task.syncedEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${task.syncedEventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  const method = task.syncedProvider === "google" && task.syncedEventId ? "PATCH" : "POST";

  const response = await fetch(url, { method, headers, body });
  if (!response.ok) {
    throw new Error(`Failed to write Google event for "${task.title}": ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

async function deleteGoogleEvent(connection: CalendarConnection, calendarId: string, eventId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  });
  // Deletion is best-effort — a 404 (already gone) or transient failure here
  // shouldn't block the rest of the push.
}

async function writeMicrosoftEvent(
  connection: CalendarConnection,
  calendarId: string,
  task: Task,
  timeZone: string,
): Promise<string> {
  const body = JSON.stringify({
    subject: task.title,
    body: { contentType: "text", content: task.description ?? "" },
    start: { dateTime: task.scheduledStart, timeZone },
    end: { dateTime: task.scheduledEnd, timeZone },
  });
  const headers = {
    Authorization: `Bearer ${connection.accessToken}`,
    "Content-Type": "application/json",
  };

  // Microsoft Graph addresses existing events globally under /me/events for
  // update, but creation must target the specific calendar.
  const url =
    task.syncedProvider === "microsoft" && task.syncedEventId
      ? `https://graph.microsoft.com/v1.0/me/events/${task.syncedEventId}`
      : `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
  const method = task.syncedProvider === "microsoft" && task.syncedEventId ? "PATCH" : "POST";

  const response = await fetch(url, { method, headers, body });
  if (!response.ok) {
    throw new Error(`Failed to write Outlook event for "${task.title}": ${await response.text()}`);
  }
  const data = (await response.json()) as { id: string };
  return data.id;
}

async function deleteMicrosoftEvent(connection: CalendarConnection, eventId: string): Promise<void> {
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  });
}

export async function pushPlanToCalendar(
  provider: CalendarProvider,
  goal: Goal,
  plan: Plan,
): Promise<{ goal: Goal; plan: Plan }> {
  const connection = await getCalendarConnection(provider);
  if (!connection) {
    throw new Error(`No ${provider} connection found`);
  }
  const validConnection = await ensureValidAccessToken(connection);

  const calendarId =
    provider === "google"
      ? await ensureGoogleCalendar(validConnection, goal)
      : await ensureMicrosoftCalendar(validConnection, goal);

  const timeZone = localTimeZone();
  const taskUpdates = new Map<string, Task>();
  const newEventIds: string[] = [];

  for (const phase of plan.phases) {
    for (const week of phase.weeks) {
      for (const task of week.tasks) {
        if (task.schedulingStatus !== "scheduled" || !task.scheduledStart || !task.scheduledEnd) {
          continue; // nothing to push for a task with no real time slot
        }

        const eventId =
          provider === "google"
            ? await writeGoogleEvent(validConnection, calendarId, task, timeZone)
            : await writeMicrosoftEvent(validConnection, calendarId, task, timeZone);

        newEventIds.push(eventId);
        taskUpdates.set(task.id, { ...task, syncedEventId: eventId, syncedProvider: provider });
      }
    }
  }

  // Delete events from a previous push that no longer correspond to any
  // current task (SPEC.md §6) — regenerated tasks are new objects with new
  // ids, so this has to be tracked at the goal level, not per-task.
  const previousEventIds = goal.syncedEventIds?.[provider] ?? [];
  const staleEventIds = previousEventIds.filter((id) => !newEventIds.includes(id));
  for (const staleId of staleEventIds) {
    if (provider === "google") {
      await deleteGoogleEvent(validConnection, calendarId, staleId);
    } else {
      await deleteMicrosoftEvent(validConnection, staleId);
    }
  }

  const updatedGoal: Goal = {
    ...goal,
    status: goal.status === "active" ? "published" : goal.status,
    externalCalendarIds: { ...goal.externalCalendarIds, [provider]: calendarId },
    syncedEventIds: { ...goal.syncedEventIds, [provider]: newEventIds },
  };
  const updatedPlan = mapPlanTasks(plan, taskUpdates);

  return { goal: updatedGoal, plan: updatedPlan };
}
