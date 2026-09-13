# Task breakdown — Step 1

Granular tasks for SPEC.md §10 step 1: *"Data model + IndexedDB persistence + static calendar UI shell (seed with a hand-written example plan, no LLM yet)."*

Later build-order steps get their own breakdown here once we reach them — not done in advance, since they'll be more accurate after step 1 surfaces real decisions.

## Data model

- [x] Fill in `src/lib/types.ts` with `Goal`, `Plan`, `Phase`, `Week`, `Task`, `CalendarConnection`, `BusyBlock`, `ChatMessage` exactly as specified in SPEC.md §4.
- [x] Add matching zod schemas (e.g. `src/lib/schemas.ts`) mirroring these types — not used for LLM validation yet, but written now so the shape is defined once and reused later (§5's structured-output validation will import these).

## IndexedDB persistence

- [x] Add `idb` (or equivalent thin wrapper) to `package.json`.
- [x] Design the IndexedDB schema: one database, object stores for `goals`, `plans`, `chatMessages`, `calendarConnections`, with a `goalId` index on `plans` and `chatMessages` for lookup.
- [x] Write a persistence module (e.g. `src/lib/db.ts`) exposing: `getActiveGoal()`, `saveGoal(goal)`, `savePlan(plan)`, `listPlanVersions(goalId)`, `getLatestPlan(goalId)`, `saveChatMessage(msg)`, `getChatMessages(goalId)`.
- [x] Manually verify a round trip (save a `Goal`/`Plan`, reload the page, confirm it's still there) before moving on — this is the actual proof step 1 works, not just that the UI renders. Verified with a Playwright script counting `goals` records before/after reload (stayed at 1).

## Static calendar UI shell

- [x] Build a week-view grid component (days × time slots) that renders a list of `Task`s using `scheduledStart`/`scheduledEnd`.
- [x] Build a month-view grid component (denser, day cells rather than time slots).
- [x] Build a task "chip" component for the grid — title, time, styling that differs by `Task.type` (`task`/`milestone`/`review`/`rest`/`other` per §4).
- [x] Build a view toggle (week/month) + prev/next navigation.
- [x] Build a simple list/agenda view as a complement to the grid (per §6).
- [x] Write one hand-authored example `Plan` (a couple of `Phase`s/`Week`s/`Task`s — reuse the marathon example from SPEC.md for concreteness) as seed fixture data.
- [x] Wire the app's main page to: on first load, seed IndexedDB with the example plan if empty, then always render from IndexedDB (not from the fixture directly) — this is what actually exercises the persistence module end to end.
- [x] Basic Tailwind pass for legibility — not a design pass, just readable spacing/contrast.

## Definition of done for step 1

Opening the app shows the hand-authored example plan rendered on a week/month calendar, sourced from IndexedDB. Refreshing the page shows the same data (proves persistence, not just that the component can render a hardcoded fixture). No LLM calls, no Google Calendar connection yet — those are steps 2–3.

**Status: done**, verified in a real browser (Playwright against `next dev`) — week/month/agenda views all render with correctly styled task chips, and the reload check above confirms persistence. One bug found and fixed along the way: the first version of the seed-on-load effect raced under React Strict Mode's double-invoked effect and created two active goals; fixed with an init-ref guard in `CalendarShell.tsx` (see the comment there for why a `cancelled`-flag/cleanup pattern doesn't work for this specific case).

# Task breakdown — Step 3

SPEC.md §10 step 3: *"Goal entry + wire up `generatePlan()` ... + the deterministic scheduling pass ... → rendered draft calendar with real scheduled times."* Step 2 (Google OAuth/freebusy) is deferred (see §10) — busy blocks are an empty array until that's built, which the scheduler treats as a normal, valid input.

## Setup

- [x] Fix `.env.local`: rename `OPEN_API_KEY` → `OPENAI_API_KEY` (the SDK's default env var name) and add `OPENAI_MODEL` (default a structured-output-capable model; overridable). Defaulted to `gpt-4o-mini`.
- [x] Confirm `.env.local` stays gitignored (already is via `.env*`).

## LLM-facing schemas (semantic plan only — no ids, no scheduling fields)

- [x] Add `src/lib/llm-schemas.ts`: zod schemas for what the LLM actually produces — `Task` minus `id`/`completed`/`scheduledStart`/`scheduledEnd`/`schedulingStatus`/`googleEventId`, `Plan` minus `id`/`goalId`/`version`/`generatedAt`, plus an optional `targetDate` (only present when the goal didn't supply one — see SPEC.md §5 step 2). Ids, `completed: false`, and scheduling fields get filled in server-side after parsing, not requested from the model.
- [x] Hand-write the matching OpenAI strict JSON Schema (required-and-nullable for optional fields, `additionalProperties: false` throughout) — needed because strict structured-output mode has stricter shape rules than a straight zod→JSON-schema conversion would produce.

## Scheduler (deterministic, SPEC.md §5 step 4)

- [x] `src/lib/scheduler.ts`: `scheduleTasks(tasks, busyBlocks)` — for each task, find the earliest free slot ≥ `durationMinutes` within a default day window (6am–9pm) on `preferredDate` (or the nearest date allowed by `preferredDaysOfWeek`, searching outward within the same week) that doesn't overlap a `BusyBlock`. Sets `scheduledStart`/`scheduledEnd`/`schedulingStatus`.
- [x] Verified against real generations: a task with `preferredDaysOfWeek:[2]` (Tuesday) got moved off its LLM-suggested date to the nearest Tuesday in that week, and two same-day tasks landed at different times (6:00 AM / 8:00 AM) rather than overlapping — confirms the same-day collision-avoidance and day-of-week search both work, even with an empty (no calendar connected) busy-blocks list.

## Generation service (server-only)

- [x] `src/lib/generate-plan.ts`: builds the system/user prompt from a `Goal`-shaped input, calls OpenAI with structured output against the schema above, validates with zod, retries once with the validation error fed back on failure.
- [x] Same file: critique-and-revise pass (SPEC.md §5 step 3) — one bounded extra call reviewing the draft against the goal/constraints, returning either an approval or a revised semantic plan.
- [x] Mapping function: semantic LLM output → full `Plan`/`Task` domain objects (generate ids, `completed: false`, run the scheduler from above, backfill `Goal.targetDate` from the LLM's estimate when the user didn't supply one).

## API + client wiring

- [x] `app/api/plan/generate/route.ts` — Route Handler wrapping the service above (keeps the OpenAI key server-side).
- [x] `src/components/goal/GoalEntryForm.tsx` — title (required), start date (optional, defaults to today client-side), target date (optional). On submit, calls the API, saves the returned `Goal`/`Plan`, hands off to the calendar view.
- [x] Split the old self-contained `CalendarShell` into `PlannerApp` (loads from IndexedDB, branches between goal entry and calendar) + a now-presentational `CalendarShell` (props: `goal`, `plan`) — no active goal → `GoalEntryForm` (replacing step 1's auto-seeded fixture as the default); active goal → `CalendarShell`, rendering real `scheduledStart`/`scheduledEnd` times from generation.
- [x] Visible "Generating your plan…" state on the submit button while the API call is in flight, and a visible error message if it fails.
- [x] Surface `Plan.assumptions` in the calendar header (dashed box under the summary) — full chat UI is still step 4.

## Definition of done for step 3

Entering a goal (tried against **at least one non-fitness example**, e.g. "learn pottery" or "create an AI project" — the whole point of the critique pass is cross-domain consistency, SPEC.md §1) produces a real LLM-generated plan, scheduled onto a draft calendar with real times, persisted to IndexedDB. No Google Calendar involved yet — an empty busy-blocks list is expected and correct.

**Status: done**, verified in a real browser against the real OpenAI API (not mocked) with two different non-fitness goals:
- "Learn pottery" → phases "Introduction to Pottery" / "Developing Skills" / ..., tasks like "Research Pottery Techniques", "Attend Introductory Pottery Class", a milestone "Celebrate completion of pottery learning journey" — correctly styled amber, not blue like the regular tasks.
- "Create an AI side project" → tasks like "Brainstorm project ideas", "List technical requirements", "Install necessary software".

Both showed sensible `Plan.assumptions` (e.g. "Assumed a beginner starting point — tell me your current level and I can tailor this further"), and a page reload after generation kept the same goal/plan rather than reverting to the goal-entry form (persistence confirmed with real, not fixture, data). One test-script bug found along the way (not an app bug): `getByRole('button', { name: 'Month' })` doesn't match the view-toggle buttons because their accessible name is the lowercase `"month"` — only the CSS `capitalize` class makes it look capitalized on screen.

Since step 3, the flow was reshaped mid-stream based on product feedback, ahead of formally starting step 4:
- The goal-entry form was simplified from a 3-field form (title + two date pickers) to a single chat-style textarea — the date fields were redundant with defaults the app already applies (today for start, LLM-estimated for target).
- A `ChatTranscript` was added: the assistant's response (a deterministic prose outline built from the generated `Plan`, not a separate LLM call) now appears *before* the calendar, not just a small assumptions box in the calendar header.
- The critique prompt (§5 step 3) was strengthened with a deterministic date-range violation checker (`findDateRangeViolations` in `generate-plan.ts`) after real generations were observed producing internally-inconsistent dates (e.g. a phase landing in 2028 for a goal whose own summary said "3 months"). Violations are computed in code and handed to the critique pass as ground truth, with a final safety-net note appended to `assumptions` if any survive.

# Task breakdown — Step 4

SPEC.md §10 step 4: *"Chat panel + `refinePlan()` ... constraint history, regeneration, re-scheduling, diff highlighting."* Diff highlighting was explicitly deprioritized for this pass (see conversation) to keep scope tight — the calendar just updates to the new plan version without a visual diff.

- [x] `refinePlan()` in `generate-plan.ts` — takes the goal (with the new constraint appended), the current `Plan`, and busy blocks; converts the current plan back to the semantic (LLM-facing) shape via `toLlmPlanForPrompt`, prompts the model to update it while changing as little else as possible, then reuses the same critique-and-schedule tail as `generatePlan()` (refactored into a shared `critiqueAndFinalize()` so the two paths can't drift on the date-range rules).
- [x] `app/api/plan/refine/route.ts` — appends the new message to `Goal.constraints` server-side, calls `refinePlan()`, backfills `targetDate` the same way `generate` does.
- [x] `src/components/chat/ChatComposer.tsx` — textarea + Send button, Enter-to-send, disabled/loading state while refining, inline error on failure.
- [x] `PlannerApp.tsx`: `handleRefine()` — optimistically appends the user's message to the transcript and persists it before the fetch (so it stays visible even if the refine call fails), then on success saves the updated `Goal`/`Plan`/assistant message and re-renders the calendar with the new plan version.

## Definition of done for step 4

Typing a follow-up in the chat composer (e.g. a day-of-week constraint) produces an updated plan version, appends both the user's message and a new assistant outline to the transcript, and the calendar visibly reflects the change — all persisted to IndexedDB.

**Status: done**, verified in a real browser against the real OpenAI API. Sent "Only do long runs on Sundays, no exceptions." after generating a Seattle Marathon plan: `Goal.constraints` recorded the message, `Plan.version` went from 1 to 2, 4 chat messages persisted (goal → outline → refinement → updated outline), and the two long-run tasks visibly moved on the calendar from Saturday to Sunday between the "before" and "after" screenshots.

# Task breakdown — Step 2

SPEC.md §10 step 2, revised scope: Google **and** Microsoft/Outlook OAuth connect + freebusy fetch, merged into one `BusyBlock[]`, feeding the scheduler that's already built. Both providers' credentials (`GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET`) are now in `.env.local`.

**Architecture note**: only the token *exchange* (auth code → tokens) and *refresh* need the server, since those require the client secret. The actual freebusy *read* calls go straight from the browser to Google/Microsoft's APIs using the stored access token — no server proxy for those (both APIs support CORS for this). This matches the "stateless relay" design in SPEC.md §3 — the server never sees or stores tokens beyond the single exchange/refresh request.

**Scope trim**: the original step 2 description imagined seeing busy blocks on a standalone calendar view *before* any goal exists. Since the calendar view (`CalendarShell`) is built around an existing `Plan`, this pass instead: (a) shows a connect-or-skip screen before goal entry, (b) fetches busy blocks and feeds them into generation/refinement so the scheduler actually avoids conflicts, and (c) renders busy blocks (grey, untitled) on the calendar once a plan exists. A dedicated pre-goal "here's what's already on your calendar" preview is deferred to step 6 polish.

**Testing note**: I can verify everything up through redirecting to Google's/Microsoft's real sign-in page, and I can unit-test the scheduler against fabricated busy blocks — but completing an actual login requires a real account's credentials/2FA, which only you can do. I'll flag exactly what needs manual testing once this is built.

## Data model + persistence

- [x] Extend `CalendarConnection` (types.ts, schemas.ts, SPEC.md §4) with the actual token fields: `accessToken`, `refreshToken?`, `expiresAt`.
- [x] `db.ts`: add `saveCalendarConnection`, `getCalendarConnection(provider)`, `getAllCalendarConnections()`, `deleteCalendarConnection(provider)`.

## OAuth (server-only, per provider)

- [x] `src/lib/oauth-providers.ts` — shared config/helpers for both providers (authorize URL builder, token exchange, refresh), so the two providers can't drift in how they're handled.
- [x] `app/api/auth/{google,microsoft}/start/route.ts` — redirect to the provider's authorize URL (state param in a short-lived cookie for CSRF protection).
- [x] `app/api/auth/{google,microsoft}/callback/route.ts` — verify state, exchange code for tokens server-side, redirect to `/` with tokens in the URL **fragment** (not query string — never sent over the network) for the client to pick up and store.
- [x] `app/api/auth/{google,microsoft}/refresh/route.ts` — takes a refresh token, returns a fresh access token + expiry.

## Client-side calendar API + connect UI

- [x] `src/lib/calendar-api.ts` — `fetchFreeBusy(start, end)`: for each connected provider, refresh the access token first if expired (via the refresh route), then call the provider's freebusy/calendarView endpoint directly from the browser, merging results into one `BusyBlock[]`. (Microsoft uses `/me/calendarView`, not `getSchedule` — the latter needs the account's own email address to query itself, which we don't have on hand; calendarView needs only the token.)
- [x] `src/components/calendar/ConnectCalendarScreen.tsx` — "Connect Google Calendar" / "Connect Outlook Calendar" buttons + a "Skip for now" link, shown before goal entry.
- [x] `PlannerApp.tsx`: parse `window.location.hash` on mount for OAuth tokens, save the connection, clean the URL; show `ConnectCalendarScreen` when there's no connection and no goal yet (skip choice persisted in `localStorage` so it doesn't nag again); fetch busy blocks before generate/refine calls and include them in the request instead of the hardcoded `[]`.
- [x] `GoalEntryForm` refactored to delegate the actual API call to `PlannerApp` (an `onSubmit` prop, matching how `ChatComposer`/`handleRefine` already worked) — needed so busy blocks can be fetched before the generate request is built, not after.

## Calendar rendering

- [x] `WeekView`: accept and render busy blocks — grey, dashed, untitled (time range only), read-only — alongside plan tasks. **Scope trim**: `MonthView` and `AgendaList` were left out — month cells are already dense with a task overflow ("+N more"); adding busy blocks there would need its own overflow handling. Week view is the primary place busy context matters anyway.

## Definition of done for step 2

Connecting Google and/or Microsoft actually redirects to that provider's real sign-in/consent page and, after a real login, lands back in the app with a stored connection. Generating or refining a plan with a connection active fetches real busy blocks and the scheduler avoids them (verifiable by fabricating a conflict). Skipping the connect screen leaves the app working exactly as it does today (empty busy-blocks list).

**Status: built and verified as far as possible without a real account login** (see testing note above — completing an actual Google/Microsoft sign-in requires real credentials/2FA that only the user has):
- Confirmed both `/api/auth/{google,microsoft}/start` redirect to the correct real authorize URLs, with the correct client ID, redirect URI, scopes, and a state cookie set (checked via raw HTTP response, not a browser).
- Confirmed the callback route safely rejects a missing/mismatched `state` (redirects with `calendar_error` rather than crashing), and found + fixed a real bug in the same pass: the error banner was only rendered in the goal-entry branch, so a failed OAuth attempt (leaving zero connections) would loop back to `ConnectCalendarScreen` with the error invisible. Fixed by hoisting the banner above both branches.
- Verified in a real browser: fresh load shows the connect screen; `?calendar_error=...` shows the banner and gets stripped from the URL; "Skip for now" moves to goal entry and persists across a reload.
- **The functional core** — does the scheduler actually avoid busy time? — verified by POSTing directly to `/api/plan/generate` with a fabricated 14-day `busyBlocks` list (6am–12pm blocked every day), bypassing OAuth entirely since this is the same code path a real connection feeds into. Every task that landed within the 14-day covered window was scheduled at exactly 12:00 — the first free slot after the blocked window — confirming the busy-blocks plumbing (client → API → `generatePlan` → `scheduleTasks`) works correctly end to end.
- **Not yet verified**: the actual OAuth consent screen + callback completing with a real account, and `BusyBlockChip` rendering with real (not fabricated) data — both need the user to actually click "Connect Google Calendar" / "Connect Outlook Calendar" and log in themselves.

# Task breakdown — New Goal button, real event content, push to calendar

Three features requested together, pulled forward from step 5/6 of SPEC.md §10 now that both providers' credentials exist and the user has real accounts to test with.

**Google OAuth scope widened**: from `calendar.readonly` to full `https://www.googleapis.com/auth/calendar` — required for push (creating a dedicated calendar isn't possible with read-only access). **Anyone who connected Google before this change needs to disconnect and reconnect** to get a token with write permission; the old token simply won't have it. Microsoft's `Calendars.ReadWrite` already covered both directions from step 2, no change needed there.

## New Goal button

- [x] `Goal.status` gained a third value, `'archived'` (types.ts, schemas.ts, SPEC.md §4) — distinct from `'published'` so history stays honest about whether a goal was actually pushed anywhere.
- [x] `PlannerApp.handleNewGoal()` — confirms via `window.confirm`, archives the goal only if it was still `'active'` (a published goal keeps that status, correctly), clears local state (goal/plan/messages/busyBlocks) so `GoalEntryForm` reappears. Nothing is deleted — old goals/plans/messages stay in IndexedDB as history (not yet browsable — that's still a step 6 item).
- [x] "+ New Goal" link in `CalendarShell`'s header.

## Real event content (revised from opaque busy-blocks-only)

- [x] `BusyBlock` gained an optional `title` field (types.ts, schemas.ts, SPEC.md §4). This is a deliberate scope widening from the original privacy-conservative design (§8) — confirmed explicitly with the user before building it.
- [x] `calendar-api.ts`: replaced the freebusy-only fetch with a real events fetch — Google's `events.list` (filtering out cancelled/`transparent`/all-day), Microsoft's `calendarView` (now also selecting `subject`) — renamed `fetchFreeBusy` → `fetchCalendarEvents` throughout to match what it actually does now.
- [x] `BusyBlockChip` shows the title when present, falling back to just the time range if a provider ever returns an event with no title.

## Push to Google/Outlook Calendar

- [x] `Goal` gained `externalCalendarIds` (per-provider dedicated-calendar id, created once and reused) and `syncedEventIds` (per-provider list of event ids from the *last* push to that provider).
- [x] `calendar-api.ts`: `pushPlanToCalendar(provider, goal, plan)` — creates the dedicated calendar on first push (reuses it after), creates or updates one event per scheduled task (update when `task.syncedEventId` already matches this provider, i.e. a second push of the *same* plan version), then deletes any event id that was in the *previous* push's set but isn't in the new one (handles a refine removing/changing tasks — see the `Task.syncedEventId` comment in SPEC.md §4 for why this specific staleness check has to live at the goal level rather than per-task: regenerated tasks are new objects with new ids, so a task-level id can't be compared across plan versions).
- [x] `PushControls` component — one button per connected provider, loading/success/error state per click.
- [x] `PlannerApp.handlePush(provider)` wires it together and persists the result (goal now carries the calendar/event ids, tasks now carry `syncedEventId`/`syncedProvider`, goal status flips to `'published'` if it was still `'active'`).

## Definition of done

New Goal: clicking it archives the current goal (not deletes it) and returns to a blank goal-entry screen; a fresh goal can then be entered normally. Real events: after connecting, existing calendar events show their actual titles instead of anonymous grey blocks. Push: clicking "Push to Google/Outlook Calendar" creates a dedicated calendar and one event per scheduled task on the first push, and updates/cleans up correctly (no duplicates, no orphaned stale events) on subsequent pushes after a refine changes the plan.

**Status**: New Goal fully built and verified in a real browser (generated a plan, clicked New Goal, confirmed the old goal was archived — not deleted, 1 plan still in storage — then entered and generated a second goal successfully). The widened Google scope was confirmed via the real `/api/auth/google/start` redirect. **Real event content and push could not be verified against real data** — both need an actual Google/Outlook login with calendar events already on it, which only the user can provide; ready for the user to test once they reconnect Google (required for the new scope) and try both a fresh push and a push-after-refine (to exercise the stale-event cleanup specifically).

# Visual restyle — ported from Stitch design "Playful Goal Dashboard"

Source: Stitch project "WhimsiCal" (729063316895781965), screen "Playful Goal Dashboard - Bottom Prompt", fetched live via the `stitch` MCP server and its raw HTML downloaded for a faithful port. Applied to the real app (not a static mockup) per the user's choice.

- [x] `app/globals.css` / `app/layout.tsx`: new Tailwind 4 `@theme` tokens (warm cream/peach/lavender/sage/sky/buttercup palette, `rounded-xl/2xl/3xl`), swapped Geist → Quicksand (headings/brand) + Plus Jakarta Sans (body). Dropped dark-mode support — the source design is light-only, and inventing a dark variant wasn't requested.
- [x] `src/lib/task-colors.ts` (new): one shared color/label map per `TaskType`, used by both `TaskChip` and `CalendarShell`'s legend so they can't drift.
- [x] New `AppHeader` component: persistent "🟡 WhimsyCal" brand pill + live connected-provider badges (real `connections` data, not mockup placeholders), rendered across every screen (loading, connect, goal entry, main app) from `PlannerApp`.
- [x] Restyled every component: `ConnectCalendarScreen`, `GoalEntryForm` (with quick-spark suggestion chips — generic goals, not fitness-only, per SPEC.md §1's genericity principle), `CalendarShell` (nav pills, view toggle, task-type legend replacing the mockup's goal-category legend — adapted since the app doesn't support multiple simultaneous goals), `WeekView`/`MonthView` (added a weekday header row to `MonthView`, which didn't have one before; kept Sunday-start to match the app's actual week convention rather than the mockup's Monday-start), `AgendaList`, `TaskChip`, `BusyBlockChip`, `ChatTranscript`, `ChatComposer`, `PushControls`.
- [x] Found and fixed a real layout bug during verification: the goal-entry and chat inputs used `rounded-full` with `rows={1}`, which visually clipped wrapped multi-line text (a real goal sentence, unlike the mockup's short placeholder). Fixed by dropping to `rounded-2xl` and `rows={2}`.

**Status: done and verified in a real browser** with a real generation (connect screen → goal entry with a quick-spark chip → month/week/agenda views → New Goal flow), all under the new visual system. Screenshots confirmed the "Today" cell's coral highlight, task-type color legend, and chat bubble styling all render correctly together.

# Connect + goal-entry page — ported from Stitch's "Connect Your Calendar" screen

Source: a new screen the user added to the same Stitch project, fetched the same way (real HTML download, not a screenshot guess). This screen represents a genuine UX architecture change from the previous connect flow, not just new colors — implemented as such rather than just a palette swap.

- [x] **Structural change**: the full-screen "connect or skip, then see goal entry" gate is gone. `ConnectCalendarScreen` is now a dismissible **overlay modal** on top of a blank calendar preview, and `GoalEntryForm` is *always* visible below it — a user can type a goal immediately without ever interacting with the connect prompt, matching the source design (the goal section is a separate sibling `<section>` in the source HTML, not covered by the modal overlay).
- [x] New `EmptyCalendarPreview` component: a non-interactive blank month grid (disabled prev/next, dashed empty cells, real "today" highlighted) shown before any goal exists — dims/blurs via a `dimmed` prop while the connect modal is open, crisp once dismissed. Kept the mockup's placeholder category legend ("Gentle Hustle"/"Touch Grass"/etc.) as pure decoration here since there's no real plan yet — different from `CalendarShell`'s real, functional task-type legend used once a plan exists.
- [x] `ConnectCalendarScreen` rewritten as the overlay card, now with the actual multi-color Google "G" and Microsoft four-pane SVG logos from the source (previously just text), plus the source's specific copy (including the "boss's keynote monologue" line) and privacy microcopy.
- [x] `AppHeader` gained a "Not connected yet" pulsing amber badge (shown when no providers are connected — previously showed nothing at all in that state) and a "🌱 Guest" avatar chip, matching the source nav bar.
- [x] `app/globals.css`: refined the `coral` token to the source's exact value (`#ff7b54`, imperceptibly different from the prior `#F97C56`) and added `coral-hover`.
- [x] Scoped deliberately to this page: the source uses cooler slate-gray text tones and a single Quicksand font, differing from the warm ink/clay tokens and Quicksand+Plus-Jakarta-Sans split already verified elsewhere in the app. Used Tailwind's built-in `slate-*`/`amber-*` utilities directly for this page's new components rather than retrofitting the whole app's existing, already-approved styling to match — that wasn't asked for and risks regressing verified work.

**Status: done and verified in a real browser**: fresh load shows the modal over a dimmed blank calendar with the goal form already visible below it; skip dismisses the modal, un-dims the calendar (real "today" correctly highlighted), and persists across reload; a real generation from this page still completes successfully end-to-end.

# Polish follow-ups after user testing

Several fixes/additions made in response to feedback after the user started testing the restyled app with a real Google connection:

- [x] **Real events, not just an empty preview**: `EmptyCalendarPreview` was always a static placeholder that ignored connection status for its content (only used it for the dim/blur effect). Now fetches real events via `fetchCalendarEvents()` whenever connected, keyed to whatever range is currently visible (month/week/day, following navigation) — verified with Playwright network interception (mocking Google's real API shape) since a real OAuth login isn't something this session can do.
- [x] **Busy events now show in Month and Agenda views**, not just Week — `MonthView` and `AgendaList` both gained a `busyBlocksByDate` prop, and `BusyBlockChip` gained a `compact` mode for the dense month cells. This was an explicit scope-trim from step 2 that real usage showed was worth closing.
- [x] Month/Week/Day tabs and the ←/→ nav on `EmptyCalendarPreview` were initially inert (matching the static source mockup) — made fully functional, including a shared "Today" button added to both this and the real `CalendarShell` (same nav pattern, added to both for consistency).
- [x] `EmptyCalendarPreview`'s month grid now computes exactly how many weeks the month needs (5 or 6) instead of a fixed count, and dims out-of-month days like `MonthView` already did.
- [x] **Multi-calendar fetch**: both `fetchGoogleEvents` and `fetchMicrosoftEvents` only ever queried the primary/default calendar, missing any secondary or shared calendars in the account. Both now list all calendars first (`calendarList.list` / `me/calendars`) and fetch+merge events from every one, falling back to the single primary/default calendar if listing fails. All-day events (where most Holidays/Birthdays-calendar noise lives) are still filtered out by the existing non-all-day check, so this doesn't add noise, just real missed commitments.
- **Found, not yet fixed (deferred at the user's request)**: `Task.preferredDate` (and the LLM schema behind it) isn't validated as an actual date format — a malformed value from the LLM can produce a literal "Invalid Date" group header in `AgendaList`'s fallback grouping for unscheduled tasks. Noted for a future pass.
- [x] **Per-calendar colors + a legend**: `BusyBlock` gained `calendarId`, `calendarName`, and `color` — each fetch now uses the calendar's own real color (Google's `backgroundColor` field; Microsoft's named `color` enum mapped to hex, or `hexColor` when present), falling back to a rotating palette (reusing this app's own accent colors) when a provider doesn't give one. `BusyBlockChip` renders a colored left accent via inline `style` (Tailwind can't statically compile a runtime hex value). New `CalendarLegend` component dedupes by `calendarId` and shows one dot + name per distinct synced calendar currently contributing events — added to both `CalendarShell` (labeled "Synced:", next to the existing "Plan:" task-type legend) and `EmptyCalendarPreview`. Verified with mocked multi-calendar Google data: two calendars' events rendered with distinct matching colors, and both appeared correctly in the legend.

# Post-generation split view — ported from Stitch's "Cheeky Plan Draft & Calendar Split View" screen

Source: the third screen in the same Stitch project, fetched the same way (real HTML download). Describes the app's state right after a goal is submitted and a plan + calendar are generated — a two-column "plan draft next to calendar" workspace, an action bar, and a bottom AI-buddy chat dock, replacing the previous stacked chat-then-calendar layout.

- [x] New `PlanSummaryCard` component (the left column): pill badges for the plan's current phase and a real `scheduled/total` slot ratio (not the mockup's hardcoded "3/3"), the goal title, a computed "N weeks • ~M sessions a week" subtitle, and a real, data-driven list of the next several upcoming tasks (day-of-week badge, title, type pill, scheduled time range or a "Needs a new time slot" conflict notice, description) — unlike the mockup's three fixed routine cards. A footer note lists real protected rest-day weekdays when the plan has any, falling back to generic copy otherwise.
- [x] `CalendarShell` gained a `hideHeader` prop (the goal title/"+ New Goal" row now lives once in `PlannerApp`, above the two-column grid, instead of duplicated inside the card) and a small "Compare with your Calendar" / "Live Sync" sub-header shown above the existing nav, replacing the plain nav-only header — `PushControls` was pulled out of the card entirely and moved to a dedicated action-bar row below the grid, matching the source's separate "Publish to Google Calendar" bar. Default view switched from Month to Week to match the source (this pane, unlike `EmptyCalendarPreview`, had never had an explicit "which default view" decision recorded).
- [x] `PlannerApp`'s post-generation layout rebuilt as `lg:grid-cols-12` (`PlanSummaryCard` at 5 cols, `CalendarShell` at 7), with `ChatTranscript`/`ChatComposer` restyled into a bottom "WhimsyCal Buddy" dock (scrollable transcript above a chat input bar) instead of sitting above the calendar — kept the full real message history rather than the mockup's single hardcoded buddy bubble, since collapsing that would lose real conversation context.
- [x] Scope call: the mockup's calendar column highlights only the days with a proposed run, side-by-side with a fixed one-week window. Kept the app's existing fully-functional Week/Month/Agenda toggle and real prev/next/Today nav instead of hardcoding a single week — more capable than the source, and consistent with how the earlier two screens were adapted (real functionality over static fidelity).

**Status: done and verified in a real browser** (Playwright, IndexedDB-seeded goal/plan/chat + mocked Google Calendar events, since real generation + a real OAuth login aren't available in this session): the split view renders the plan card, the "Compare with your Calendar" pane with a working Week/Month/Agenda toggle and Live Sync pill, the Push action bar, and the buddy dock all together; confirmed responsive down to phone width (single-column stack, no horizontal overflow).

- [x] **Bug found by the user right after this shipped**: "Compare with your Calendar" showed no existing synced events. Cause: `PlannerApp`'s mount effect (the path taken whenever an already-active goal is reloaded from IndexedDB, e.g. a page refresh or returning later — as opposed to `handleCreateGoal`/`handleRefine`, which already fetched fresh busy blocks) never called `fetchCalendarEvents()`, so `busyBlocks` stayed `[]` for that whole session. Fixed by fetching busy blocks in the mount effect too, over the same horizon (`targetDate` if known, else the 180-day default) used elsewhere, whenever there's both an active goal and at least one calendar connection. Verified with Playwright: seeded an active goal/plan plus a mocked-connected Google calendar directly into IndexedDB, reloaded (never calling the create/refine paths), and confirmed the existing "Sprint Kickoff"/"Design Review" events and the "Synced:" legend now render in the calendar pane.
- [x] **Follow-up bug, also found by the user**: events appeared in the Month tab of the same calendar pane but not the Week tab. Cause: `CalendarShell`'s `anchorDate` initialized from `goal.startDate`, not from today. That's invisible in Month view as long as the goal started in the current month (the whole month, including today, still renders) but Week view narrows to the single week containing `anchorDate` — once enough days pass since the goal was created that its start week isn't the current week anymore, Week view was stranded on that old week and today's real synced events fell outside it. Fixed by initializing `anchorDate` to `new Date()` instead, matching what the existing "Today" button already resets to. Verified with Playwright: seeded a goal with `startDate` 10 days in the past plus today-dated mocked events, and confirmed the default Week view now shows the current week (not the stale start week) with both events visible.
- [x] **Third follow-up, requested proactively by the user**: "can we have events from previous as well so its not confusing" — navigating the calendar pane backward (prev week/month) showed those past days as if nothing had ever been on them, since all three `fetchCalendarEvents()` call sites (`PlannerApp`'s mount effect, `handleCreateGoal`, `handleRefine`) only ever fetched from "now" forward. Added a shared `LOOKBACK_DAYS` (45 days) and start every fetch that far back instead of at "now" — harmless for the scheduler itself (tasks are only ever placed on today-or-later dates, so a past busy block practically never overlaps a real candidate slot) and purely additive for display. Verified with Playwright: seeded a mocked event 8 days in the past, clicked "Previous" once on the calendar pane, and confirmed it now renders in that prior week instead of showing an empty column.

# Week view rewritten as a real time grid

The user's next request, after the split-view page was working: "it would be cleaner if we could have the time of day on the left hand side and we fit the blocks into the appropriate times of the day" for the Week tab on both `CalendarShell` (the split-view page) and `EmptyCalendarPreview` (the home page, pre-goal). Previously Week just stacked task/busy chips top-to-bottom in each day column, with no relationship to actual clock time — functionally more like a second Agenda view than a real week view.

- [x] New `src/lib/time-grid.ts`: a small, reusable `layoutDayColumn()` that positions a day's events by actual start/end time (top/height in px) and splits genuinely overlapping events (e.g. two calendars double-booked, or a synced event colliding with a plan task) into side-by-side columns via greedy interval coloring — the same family of algorithm real calendar apps use, without needing full per-cluster width negotiation.
- [x] `date-utils.ts` gained `formatHourLabel(hour)` for the hour-line labels ("6 AM", not "6:00 AM" — no minutes needed on an exact hour boundary), reusing `toLocaleTimeString` like the rest of the app's date formatting for locale-correctness rather than hand-rolling AM/PM.
- [x] `WeekView.tsx` rewritten from a stacked-chip list into an hour grid: a scrollable body (`max-h-[32rem]`) with hour labels down the left gutter and 7 day columns, each event absolutely positioned via `layoutDayColumn` and rendered with the existing `TaskChip`/`BusyBlockChip` (`compact` mode) so the visual language stays identical to Month/Agenda. The default 6am–9pm window (matching `scheduler.ts`'s own scheduling hours) automatically extends in either direction if a real event falls outside it, so nothing gets clipped off-grid. Tasks with no `scheduledStart`/`scheduledEnd` (a scheduling conflict) can't be placed on a time axis at all — these now surface in a small "Needs a time:" tray above the grid instead of silently disappearing.
- [x] `EmptyCalendarPreview.tsx`'s Week tab now renders the same `WeekView` (with just `busyBlocksByDate`, since there's no plan yet) instead of its own separate stacked-chip day grid — Month and Day tabs on this page are unchanged, since only Week was in scope.
- [x] `CalendarShell.tsx` needed no changes — it already just renders `<WeekView anchorDate tasksByDate busyBlocksByDate />` for the week tab, so the rewrite was a drop-in.

**Status: done and verified in a real browser** with Playwright: on the home page, a 5:30 AM call and a 10 PM wrap-up both correctly extended the grid's hour range instead of getting clipped, and two overlapping mocked events rendered in visibly split side-by-side columns rather than stacked on top of each other; on the split-view page, a real scheduled task ("20 min brisk jog", 7:30–7:50 AM) rendered at the correct vertical position among synced busy blocks, and a deliberately-unscheduled conflict task showed up in the new "Needs a time:" tray instead of vanishing.

- [x] **Minor follow-up**: "could we get rid of the plan legend? instead just make all the plan tasks the same new color in the synced legend." `CalendarShell`'s separate "Plan:" legend row (5 dots, one per `TaskType`) is gone; all plan tasks (`TaskChip`) now render in one unified color (`PLAN_TASK_COLOR` in `task-colors.ts`, reusing the app's coral brand accent) instead of a color per type. `CalendarLegend` gained a `showPlan` flag — only `CalendarShell` passes it — that adds a single "Plan" dot to the existing "Synced:" row alongside each real connected calendar, so there's one legend instead of two. `TASK_TYPE_STYLES` (per-type chip class + label) is kept only for the text-labeled type badges in `PlanSummaryCard`, which don't need a legend since the badge itself says "Milestone"/"Task"/etc. Verified in a real browser: the "Plan:" row is gone, and "Synced:" now reads "● Plan ● Personal" with plan tasks in the calendar rendered in the new unified coral color.
- [x] Immediate follow-up: dropped the "Synced:" label text from `CalendarLegend` entirely, per the user's request — it's now just the dots and names.
- [x] **New capability, prompted by the user asking "how do i clear the google sign in again"**: there was no in-app way to disconnect a calendar — `deleteCalendarConnection()` existed in `db.ts` but nothing ever called it. Added a small "×" button to each connected-provider badge in `AppHeader` (only rendered when a new `onDisconnect` prop is passed), wired in `PlannerApp` to actually delete the connection from IndexedDB and immediately drop that provider's busy blocks from state (rather than waiting for a future fetch to naturally exclude them). Verified with Playwright: clicking it flips the badge to "Not connected yet" and confirmed the row is actually gone from IndexedDB, not just hidden in React state.

# Planning-page layout + typography pass

Four small UI requests for the split-view page in one message: move the buddy box to the top, only show its latest reply (not the whole thread), switch typography to a "Google Sans" look, and move "+ New Goal" into the buddy box.

- [x] **WhimsyCal Buddy box moved above the plan/calendar grid** in `PlannerApp`, instead of below it — it's now the first thing under the goal title.
- [x] **Buddy box now shows only the latest assistant message**, not the full conversation — `PlannerApp` picks `[...messages].reverse().find(m => m.role === "assistant")` and renders its `content` as a plain paragraph instead of the old scrollable bubble transcript. Since nothing renders the full thread anymore, `ChatTranscript.tsx` had no remaining callers and was deleted rather than left dead.
- [x] **"+ New Goal" moved inside the WhimsyCal Buddy box**, in its header row next to the "WhimsyCal Buddy" label — the outer page header above it now only holds the goal title.
- [x] **Typography switched to a "Google Sans" look**: Google Sans itself isn't a public web font (Google restricts it to their own products), so — after asking the user to pick a substitute — Inter (the most commonly used free look-alike) replaces the previous Quicksand/Plus Jakarta Sans pairing. Implemented as a single `Inter` load in `app/layout.tsx` whose CSS variable both `--font-sans` and `--font-quicksand` now point to in `globals.css`, so every existing `font-quicksand`/`font-sans` usage across the whole app picked it up with no per-component class changes needed.

**Status: done and verified in a real browser** with Playwright on both the split-view and home pages: the buddy box renders first with only its latest reply and the composer, "+ New Goal" lives in its header row, and the whole app now renders in Inter.

# Real typography hierarchy (Inter + Fraunces), replacing the blanket Inter swap

The previous pass made every `font-quicksand`/`font-sans` usage render in Inter uniformly. The user then specified an actual hierarchy instead — Inter for nav/buttons/dates/times/descriptions/forms, a serif "personality" font (Fraunces) reserved for the app name/major headings/empty states, Inter semibold/bold for important calendar items, and occasional Fraunces italic for tiny whimsy — explicitly *not* the personality font everywhere.

- [x] `app/layout.tsx` now loads both `Inter` and `Fraunces` (weights 500/600, both normal and italic styles) as separate CSS vars; `globals.css`'s `--font-fraunces` theme token makes a `font-fraunces` Tailwind utility available alongside the existing default `font-sans` (Inter). The old `--font-quicksand` token is gone.
- [x] Audited every one of the ~50 existing `font-quicksand` usages across the codebase one by one and reclassified each: the large majority (nav pills, Today/prev-next buttons, view toggles, date-range labels, hour labels, form inputs, badges/pills, push/error/status text) had the class removed entirely and now fall through to the default Inter; task chips in the calendar (`TaskChip`) kept their existing semibold/bold weight, satisfying "important calendar items" without a typeface change. A much smaller set became `font-fraunces`: the "WhimsyCal" brand name, every goal-title `h1`/`h2` (`GoalEntryForm`, `PlannerApp`, `CalendarShell`, `PlanSummaryCard`), the connect-modal heading, and every literal empty-state message ("Nothing scheduled yet", "No tasks yet.", "Nothing left on the calendar — nice work!"). Two spots got `font-fraunces italic` specifically as the "tiny bits of whimsy" the user called out: the "WhimsyCal Buddy" label and the home page's footer tagline ("Everything is flexible…🍪").
- [x] `TASK_TYPE_STYLES`/`PLAN_TASK_CHIP_CLASS` in `task-colors.ts` were untouched — this pass was purely about font family/style, not color.

**Status: done and verified in a real browser** with Playwright + screenshots on both the split-view and home pages: headings and the brand name render in a distinct serif (Fraunces), the two italic whimsy spots are visibly italicized, and every button/nav/date/time/badge/calendar-item stayed in Inter — confirmed via a full-codebase grep showing zero remaining `font-quicksand` references.

# Real user name instead of hardcoded "Guest"

The user asked whether "Guest" in `AppHeader` could become their real name from the connected calendar. It couldn't before: the OAuth flow never requested profile scope, so there was no name to read.

- [x] Widened both providers' OAuth scope to also read a name — Google gained `openid email profile` alongside its existing `calendar` scope, Microsoft gained `User.Read` alongside `Calendars.ReadWrite` — **anyone already connected needs to reconnect once** to grant the new permission, same tradeoff as the earlier calendar-scope widening (SPEC.md §7).
- [x] New `fetchDisplayName(provider, accessToken)` in `oauth-providers.ts`: calls Google's `oauth2/v3/userinfo` (`.name`) or Microsoft Graph's `/me` (`.displayName`). Best-effort only — any failure (a stale pre-widening token, a transient error) returns `undefined` rather than blocking the connection, so `AppHeader` just keeps showing "Guest" in that case.
- [x] `oauth-routes.ts`'s callback handler now calls this right after the token exchange and adds `display_name` to the same stateless-relay URL fragment already used for the tokens (never a query string, never persisted server-side — consistent with the existing design).
- [x] `CalendarConnection` gained an optional `displayName` field (`types.ts`, `schemas.ts`); `PlannerApp`'s `parseOAuthFragment()` reads it off the fragment and saves it like every other connection field.
- [x] `AppHeader` now shows the first connection's `displayName` in place of "Guest", falling back to "Guest" when none of the connections have one yet (no connection at all, or one made before this change).

**Status: done and verified in a real browser** with Playwright (a real OAuth login isn't available in this session): simulated the callback fragment directly (`#calendar_connected=google&...&display_name=Priya+Chen`) and confirmed it's parsed, persisted to IndexedDB, and rendered in `AppHeader`; separately confirmed a connection without a saved `displayName` still correctly falls back to "Guest".

# Header polish: first name only, connected badge moved into the calendar, disconnect via a name dropdown

Three follow-up asks in one message, all about `AppHeader` and where connection status/actions live.

- [x] **First name only**: `AppHeader` now splits the saved `displayName` on whitespace and shows just the first token ("Alex Rivera" → "Alex"), still falling back to "Guest" the same way.
- [x] **"🌱 Google Cal connected" moved into the calendar itself**: removed the per-provider connected badges from `AppHeader` entirely (they'd become redundant next to the new dropdown below) and added the same wording, via a new shared `CALENDAR_PROVIDER_LABELS` constant (`src/lib/provider-labels.ts`), into both calendar surfaces — `CalendarShell`'s header row (replacing the generic "Live Sync" pill with the real per-connection label) and `EmptyCalendarPreview` (a new badge row above the Today/nav row, not present there before). `AppHeader` keeps its amber "Not connected yet" prompt, since that's guidance for a user with no calendar at all rather than per-connection status.
- [x] **Disconnect moved into a dropdown under the user's name**: the standalone "×" button inline on each badge is gone. `AppHeader` is now a client component with a click-to-open/click-outside-to-close dropdown under the name/avatar button, listing "Disconnect {Google Calendar/Outlook Calendar}" per connected provider (via a new shared `CALENDAR_PROVIDER_NAMES` constant, also now reused by `PushControls` in place of its own duplicate copy of the same mapping).

**Status: done and verified in a real browser** with Playwright: confirmed the header shows only "Alex" (not "Alex Rivera"), the "Google Cal connected" wording now renders inside the calendar card instead of the header, clicking the name opens a dropdown showing "Disconnect Google Calendar", and clicking that actually disconnects — the header falls back to "Guest" and the calendar's connected badge disappears.

- [x] **Two more minor tweaks**: moved the "🌱 Google Cal connected" badge from the top of the calendar card to the bottom-right, on both `CalendarShell` (after the Week/Month/Agenda content, right-aligned) and `EmptyCalendarPreview` (same treatment, below the day/week/month grid). Also removed the "Everything is flexible. You can always change your mind, reschedule, or eat snacks instead. 🍪" footer tagline from the home page entirely, per the user's request. Verified in a real browser: the badge now sits bottom-right on both pages and the footer line no longer renders anywhere.
- [x] **Removed the "Quick sparks:" suggestion chips** from `GoalEntryForm` entirely, per the user's request — deleted the `QUICK_SPARKS`/`CHIP_STYLES` constants and the row of chip buttons along with them, leaving just the goal textarea and submit button. Verified in a real browser: the row is gone and the form still submits normally.
- [x] **Two follow-up tweaks to `GoalEntryForm`** after the chips were removed: the "Let's plan ✨" button now only renders once `message.trim()` is non-empty (previously always visible, just disabled) — clean empty state, appears the moment you start typing. Also bumped the textarea from `rows={2}` to `rows={4}` since removing the quick-sparks row left the card feeling short. Verified in a real browser: the button is absent on an empty textarea and appears immediately on typing, and the input box is visibly taller.
- [x] **User course-corrected**: didn't want it taller, wanted it *wider*, and asked for the placeholder to become "Tell me your whim…". Reverted `rows` back to 2 and changed the card's `max-w-2xl` to `max-w-4xl`. That alone had **no visible effect** — a real bug, not a no-op: the card had `mx-auto max-w-4xl` but no `w-full`, and per the flexbox spec, a flex item's auto margins (from `mx-auto`) disable the default stretch behavior, so the card was shrinking to fit its own content (~312px, measured) instead of growing to the new max-width. Fixed by adding `w-full` alongside `mx-auto max-w-4xl`, matching the exact pattern the outer page container already used correctly (`mx-auto flex w-full max-w-[1180px] ...`). Verified with a direct DOM measurement in Playwright: card width went from 312px to the full 896px (`max-w-4xl`) after the fix.
