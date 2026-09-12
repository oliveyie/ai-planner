// Client-side calendar reads (SPEC.md §6). Freebusy calls go directly from
// the browser to each provider's API using the stored access token — only
// token exchange/refresh (src/lib/oauth-providers.ts) needs the server,
// since only those require the client secret.

import { getCalendarConnection, saveCalendarConnection } from "./db";
import type { BusyBlock, CalendarConnection, CalendarProvider } from "./types";

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
    // a refresh hiccup shouldn't be fatal to the whole freebusy fetch.
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

type GoogleFreeBusyResponse = {
  calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } };
};

async function fetchGoogleFreeBusy(connection: CalendarConnection, start: Date, end: Date): Promise<BusyBlock[]> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: "primary" }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Google freebusy fetch failed: ${await response.text()}`);
  }

  const data = (await response.json()) as GoogleFreeBusyResponse;
  const busy = data.calendars?.primary?.busy ?? [];
  return busy.map((block) => ({ start: block.start, end: block.end, source: "google" as const }));
}

type MicrosoftCalendarViewResponse = {
  value?: Array<{
    start: { dateTime: string };
    end: { dateTime: string };
    showAs: string;
    isAllDay: boolean;
  }>;
};

async function fetchMicrosoftFreeBusy(connection: CalendarConnection, start: Date, end: Date): Promise<BusyBlock[]> {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: "start,end,showAs,isAllDay",
    $top: "999",
  });

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!response.ok) {
    throw new Error(`Microsoft calendar fetch failed: ${await response.text()}`);
  }

  const data = (await response.json()) as MicrosoftCalendarViewResponse;
  const events = data.value ?? [];

  return events
    .filter((event) => !event.isAllDay && (event.showAs === "busy" || event.showAs === "oof"))
    .map((event) => ({
      // Graph returns naive local datetimes when a timezone is requested via
      // the Prefer header (no offset/Z) — append Z since we requested UTC.
      start: `${event.start.dateTime}Z`,
      end: `${event.end.dateTime}Z`,
      source: "microsoft" as const,
    }));
}

export async function fetchFreeBusy(start: Date, end: Date): Promise<BusyBlock[]> {
  const providers: CalendarProvider[] = ["google", "microsoft"];
  const results: BusyBlock[] = [];

  for (const provider of providers) {
    const connection = await getCalendarConnection(provider);
    if (!connection) continue;

    const validConnection = await ensureValidAccessToken(connection);
    try {
      const blocks =
        provider === "google"
          ? await fetchGoogleFreeBusy(validConnection, start, end)
          : await fetchMicrosoftFreeBusy(validConnection, start, end);
      results.push(...blocks);
    } catch {
      // One provider failing shouldn't block generation — schedule around
      // whatever busy data is actually available.
    }
  }

  return results;
}
