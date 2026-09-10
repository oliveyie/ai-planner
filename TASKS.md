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
