import type { CalendarProvider } from "./types";

// Shared between AppHeader (dropdown), CalendarShell, and EmptyCalendarPreview
// so the "connected" wording can't drift between where it's shown.
export const CALENDAR_PROVIDER_LABELS: Record<CalendarProvider, string> = {
  google: "🌱 Google Cal connected",
  microsoft: "📅 Outlook connected",
};

export const CALENDAR_PROVIDER_NAMES: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  microsoft: "Outlook Calendar",
};
