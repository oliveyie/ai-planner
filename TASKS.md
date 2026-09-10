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
