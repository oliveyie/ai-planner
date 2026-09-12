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
