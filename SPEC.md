# WhimsyCal — Spec v0.1

## 1. Pitch

Give the app a high-level goal — a race ("run the Seattle Marathon"), a project ("create an AI project"), a skill ("learn pottery"), anything with enough shape to break into steps. It generates a phased plan broken into concrete, dated tasks, schedules those tasks around the commitments already on your real calendar, renders it as a draft calendar, and lets you refine it conversationally ("only long runs on Saturdays", "I want to break 4 hours", "no work on this the week of Nov 10") until it fits your life.

**This is explicitly not a fitness/training app that happens to use marathon examples** — the domain is entirely the LLM's job. A marathon goal produces training phases and runs; an "AI project" goal produces phases like research/prototype/build/polish and tasks like "scope the dataset" or "build a demo UI"; a "learn pottery" goal produces phases like fundamentals/wheel practice/glazing and tasks like "watch a centering tutorial" or "throw 3 practice bowls." The data model (§4) is intentionally generic — phase names, week focus, and task titles are all free text the LLM fills in per-goal, not a fixed template. The marathon example is used throughout this doc purely because it's concrete and easy to follow, not because the app is fitness-specific.

## 2. Example flow

1. User connects a calendar — Google or Microsoft/Outlook (read access) — first, before entering any goal. The app fetches busy blocks and shows the user's existing commitments on the calendar view, so they can see what they already have lined up. Both providers can be connected at once; busy blocks from each are merged.
2. User enters a goal: *"Run the Seattle Marathon"*, optionally with a target date (race day) and/or a start date. Both are optional: if no start date is given, it defaults to today; if no target date is given, the LLM estimates a reasonable one from context clues (goal type, typical timelines for that kind of goal) as part of generation, and surfaces that assumption to the user (e.g. *"Assuming a 16-week build to a race day around Jan 10 — let me know if your race date is different"*).
3. App calls an LLM to generate a structured plan for that goal — in this example, marathon training phases (base, build, peak, taper), weeks, and tasks (long run, easy run, rest, cross-train, race day) with target days and durations; a different goal would produce entirely different phase/task vocabulary (see §1).
4. A deterministic scheduling pass places each task into an actual free slot on the calendar, honoring day-of-week preferences (e.g. long runs stay on weekends) and flagging anything it can't fit.
5. App renders the plan as a **draft** calendar (week/month grid) plus a list view, overlaid on the user's existing busy events for context. This is a local preview only — nothing has been written to the user's real calendar yet, and the plan can still be freely regenerated. Generation never blocks on questions first — the draft always appears immediately.
6. Alongside the draft, the app posts an assistant chat message summarizing the plan and any assumptions it had to make, phrased as invitations rather than caveats — e.g. *"Assumed a beginner starting point since no current mileage was given — tell me your current weekly mileage and I can tailor the early weeks."* The user can act on it or ignore it.
7. User types a refinement in a chat box: *"I want to run it under 4 hours"*, *"only do long runs on Sundays, I have kids' soccer on Saturdays"*, or a reply to the app's own invitation from step 6.
8. App re-generates the plan honoring all prior + new constraints, reschedules around the same busy blocks, diffs it against the current draft, and updates the calendar — highlighting what changed. Still a draft.
9. Once satisfied, the user explicitly pushes the draft to their real calendar as its own dedicated calendar — Google or Outlook, whichever they connected (if both, they pick); later refinements re-sync (update/create/delete events) rather than duplicating. This also marks the goal `published` (see §4), freeing the user to start a new goal.

## 3. Decisions locked in for v1

These came out of the initial scoping pass:

| Question | Decision |
|---|---|
| How is the plan generated? | **LLM-driven, structured output.** An LLM turns the goal + constraints into a JSON plan validated against a zod schema. No hand-authored domain algorithms in v1 — generality (any kind of goal, not just marathons) matters more than domain-expert-level correctness right now. |
| How does the plan reach a calendar? | **In-app calendar view, plus live sync to Google Calendar and/or Microsoft/Outlook Calendar.** The app is the primary UI; the connected calendar(s) are a push target so the plan shows up where the user actually lives day-to-day. |
| Does the app know about existing commitments? | **Yes — it reads busy time from Google and/or Microsoft/Outlook (v1, revised) and schedules the generated plan around it.** Both use OAuth with a similar consent-screen flow, so they're built together. Apple/iCloud read support stays deferred (see §8) — it has no OAuth (CalDAV + a manually-generated app-specific password instead), a meaningfully different and clunkier integration, not just more work. |
| Where is data stored? | **Local-first, no app accounts.** Plans live in the browser (IndexedDB). No login, no server-side database. |
| How does the user iterate? | **Conversational chat.** A chat box takes freeform natural-language adjustments and triggers regeneration — matches how people actually describe constraints ("no long runs on Saturdays"). |
| When does the app write to the user's real calendar? | **Never automatically.** The in-app calendar is always a draft/preview, freely regenerated on every refinement. Writing to Google or Microsoft Calendar happens only when the user explicitly pushes/syncs (§2 step 9, §6). |
| What's the first thing the user does? | **Connect a calendar (Google and/or Microsoft/Outlook), before entering a goal.** Seeing existing commitments up front (not just after a plan exists) is part of the pitch, and it's also what the scheduler needs as input. |
| Can a user connect more than one calendar provider? | **Yes, for reading.** Both a Google and a Microsoft connection can be active at once — busy blocks from each are merged into one list for scheduling (each `BusyBlock` keeps a `source` so they're distinguishable). For writing/pushing, the user picks which connected provider to push to (a button per connected provider) — the plan isn't pushed to both automatically. |
| What if the user doesn't give a start/target date? | **Start date defaults to today (app-level default, not an LLM decision). Target date, if omitted, is estimated by the LLM from context clues** (goal type, typical timelines) during generation, recorded as an assumption, and surfaced to the user — correctable via chat like any other constraint. |
| Does generation ever block on a clarifying question before producing a plan? | **No — always produce a best-effort first draft immediately**, matching the "show me a draft" framing of the original pitch. Any info that would meaningfully improve the plan (e.g. current weekly mileage) is instead phrased as part of `Plan.assumptions`, as an invitation rather than a blocker — e.g. *"Assumed a beginner starting point — tell me your current weekly mileage and I can tailor the early weeks."* This is posted as the assistant's first chat message alongside the draft (see §2, §5). |
| How many goals/plans is v1 built for? | **One active goal/plan at a time.** Once it's published (pushed to the calendar), the user can start a new goal. An explicit **"New Goal"** button also lets the user abandon the current one without pushing — it becomes `'archived'` (distinct from `'published'`, so the history stays honest about what actually happened) and the goal-entry screen reappears. Previously published/archived goals stay around as read-only history, not concurrently editable. |
| Does the app show actual event content, or just busy/free time? | **Actual event content (revised from the original "opaque busy blocks only" design).** `BusyBlock` now carries an optional `title` read directly from the connected calendar(s) and shown on the calendar view. This is a deliberate widening of scope from the original privacy-conservative default — see §8's note on what's still *not* done with that content (it isn't fed into plan generation). |
| What counts as "busy" for scheduling? | **Only accepted, non-all-day events explicitly marked busy** block scheduling — this matches both Google's freebusy semantics and Microsoft Graph's schedule status directly, so no custom interpretation needed on either provider. Tentative/declined RSVPs and all-day events don't count as busy. |
| What happens when a task truly can't be scheduled? | **Leave it `schedulingStatus: 'conflict'`, visibly flagged/unscheduled on the calendar, and let the user resolve it via chat** — consistent with the conversational-iteration model rather than auto-resolving (e.g. auto-bumping to another week) on the user's behalf. |
| How do we get consistent output regardless of what the user types as their goal? | **Two mechanisms, not per-input prompt formatting.** (1) One fixed system prompt template + JSON-schema/zod-enforced structured output handles arbitrary goal text uniformly — the goal is just interpolated as data into an unchanging template, never hand-rewritten. (2) A bounded self-critique/revise pass (see §5 step 3) catches *quality* problems (an unusual goal producing a nonsensical phase structure, unreasonable durations, etc.) that shape-validation alone wouldn't — the closest thing in this spec to "a lightweight agent." Cost: roughly 2x the LLM calls per generate/refine versus a single-call design, accepted for better consistency across very open-ended goals. |

### Tension to resolve: "no accounts" + "Google/Microsoft Calendar read/write"

Both Google and Microsoft Calendar access require OAuth, which normally implies server-side accounts. Resolution for v1: the Next.js server acts only as a stateless relay for each provider's OAuth token exchange (each requires a server-side client secret) — it never persists tokens or user records. The resulting access/refresh tokens are handed back to the browser and stored client-side (IndexedDB, alongside the plan), one `CalendarConnection` record per connected provider. Each connection serves both directions for that provider: reading free/busy time for scheduling, and writing the generated plan as its own calendar. This keeps the "no accounts, no DB" property while enabling both, for either or both providers. Trade-off: this only works from the browser/device that did the OAuth flow, and tokens sit in browser storage rather than behind server-side auth — acceptable for a single-user personal tool, called out explicitly as a v1 compromise.

This does mean **two separate one-time developer setups** are needed before this can be built and tested end-to-end: a Google Cloud OAuth Client ID/Secret (Google Cloud Console) and a Microsoft Entra ID (Azure AD) app registration with its own Client ID/Secret — different portals, different consent-screen mechanics, but the same shape of credential.

## 4. Data model

```ts
type Goal = {
  id: string
  title: string                // "Run the Seattle Marathon"
  targetDate?: string          // ISO date, e.g. race day. If not provided by the user, set from the LLM's estimate after first generation (see Plan.assumptions) so refinements stay consistent.
  startDate: string            // ISO date, plan begins here. Defaults to today if the user doesn't specify one — resolved client-side, not an LLM concern.
  constraints: string[]        // running log of natural-language constraints, in the order the user gave them
  status: 'active' | 'published' | 'archived' // v1 allows exactly one 'active' goal at a time (being drafted/refined). Pushing to the calendar (§6) sets it to 'published'; the "New Goal" button sets it to 'archived' instead if it was never pushed. Either way, a new 'active' goal can then be started; published/archived goals stay stored as read-only history.
  createdAt: string

  // Set the first time a plan is pushed to a given provider (§6) — reused on
  // every later push to that provider so a goal always has at most one
  // dedicated external calendar per provider, never a new one each time.
  externalCalendarIds?: Partial<Record<'google' | 'microsoft', string>>
  // Every event id currently live on each provider for this goal, from the
  // most recent push to that provider. Compared against the new set on each
  // push so events belonging to tasks that no longer exist (e.g. after a
  // refine changed the plan) get deleted instead of left stale.
  syncedEventIds?: Partial<Record<'google' | 'microsoft', string[]>>
}

type Plan = {
  id: string
  goalId: string
  version: number              // bumped on every regeneration
  summary: string              // 1-2 sentence description of the approach (e.g. "12-week base-to-peak plan targeting a 3:55 finish")
  assumptions: string[]        // things the LLM inferred rather than the user specifying, e.g. "No race date given — assumed a 16-week build ending Jan 10", "No experience level given — assumed a beginner", or "No deadline given — assumed a 6-week project". Surfaced in the UI so the user knows what to correct via chat if wrong.
  phases: Phase[]
  generatedAt: string
}

type Phase = {
  id: string
  name: string                 // entirely goal-specific, chosen by the LLM — "Base Building"/"Peak"/"Taper" for a marathon, "Research"/"Prototype"/"Polish" for a project, "Fundamentals"/"Wheel Practice"/"Glazing" for learning pottery. No fixed template.
  startDate: string
  endDate: string
  weeks: Week[]
}

type Week = {
  id: string
  weekNumber: number
  startDate: string
  focus: string                // "Recovery week", "Peak mileage"
  tasks: Task[]
}

type Task = {
  id: string
  title: string                // goal-specific: "16mi long run", "Scope the dataset", "Watch a centering tutorial"
  description?: string
  durationMinutes?: number
  type: 'task' | 'milestone' | 'review' | 'rest' | 'other'
  // 'task': the default — a concrete, timeboxed activity, whatever that means for the goal.
  // 'milestone': a fixed checkpoint/deadline (race day, project demo, show submission) — a marker more than something to "do."
  // 'review': a periodic check-in/progress assessment (weekly project retro, cutback-week fitness check, skill progress review) — domain-agnostic.
  // 'rest': a deliberately scheduled break/recovery — applies beyond fitness (a planned no-work day avoids burnout on any goal).
  completed: boolean

  // Set by the LLM during generation — a target, not a commitment.
  preferredDate: string         // ISO date the LLM would ideally place this on
  preferredDaysOfWeek?: number[] // extracted from constraints, e.g. "only long runs on Sunday" -> [0]; scheduler treats this as a hard constraint

  // Set by the deterministic scheduling pass (see §5), against real busy blocks.
  scheduledStart?: string       // ISO datetime, actual placed time
  scheduledEnd?: string
  schedulingStatus: 'scheduled' | 'conflict'  // 'conflict' = no free slot found near preferredDate honoring preferredDaysOfWeek

  syncedEventId?: string       // set once this task's event is created on a push; lets a second push of the *same* plan version update rather than recreate it. Cross-version staleness (a task that no longer exists after a refine) is handled at the Goal level instead — see Goal.syncedEventIds — since regenerated tasks are new objects with new ids, not the same Task carried forward.
  syncedProvider?: 'google' | 'microsoft'  // which connection syncedEventId belongs to
}

type CalendarConnection = {
  provider: 'google' | 'microsoft'   // v1 (revised): both, for reading busy time and (one at a time) writing the plan. Apple/iCloud stays out — see §8.
  connectedAt: string
  accessToken: string
  refreshToken?: string         // Google/Microsoft both return one when offline_access/access_type=offline is requested; used to get a new accessToken via the server refresh route without re-login.
  expiresAt: string             // ISO datetime; past this, accessToken must be refreshed before use.
  // Tokens stored in IndexedDB, not on the server (see §3 tension note).
  // One CalendarConnection record per connected provider — both can exist at once.
}

type BusyBlock = {
  start: string                 // ISO datetime
  end: string                   // ISO datetime
  source: 'google' | 'microsoft'
  title?: string                 // the real event title, read directly from the connected calendar (revised from the original "deliberately opaque" v1 design — see §3, §8). Absent if the provider returned no title, or (defensively) any event with no readable subject/summary.
}

type ChatMessage = {
  id: string
  goalId: string                // which goal's conversation this belongs to (mirrors Plan.goalId) — needed once published goals stick around as history (§3) rather than there only ever being one goal's messages to show
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  resultingPlanVersion?: number  // links a message to the plan version it produced
}
```

All of this — `Goal`, `Plan`, `ChatMessage[]` — is stored together per-goal in IndexedDB. IndexedDB can hold many goals, but v1 enforces at most one `'active'` goal at a time (see `Goal.status` above); the UI's "start a new goal" action is only available once the current one is `'published'`.

## 5. Generation & iteration pipeline

Generation is split into two passes with different jobs: the LLM decides **what** to do and roughly **when**; a deterministic scheduler decides the **actual time slot**, because slot-fitting against real busy blocks is exactly the kind of precise, checkable arithmetic LLMs are unreliable at.

1. **Fetch availability**: `GET /api/calendar/freebusy` (requires at least one active `CalendarConnection`) — pulls busy blocks across the full plan horizon (startDate → targetDate) from every connected provider (Google's freebusy API, Microsoft Graph's schedule/calendarView equivalent) and merges them into one `BusyBlock[]` list.
2. **Generate (semantic)**: `POST /api/plan/generate` — input `{ goal }` (title, startDate defaulted to today if omitted, targetDate if the user gave one). Server builds a prompt instructing the LLM to return JSON matching the `Plan`/`Task` shape (via structured output / JSON schema) — including each task's `preferredDate`, `durationMinutes`, and any `preferredDaysOfWeek` implied by constraints — validated with zod, retried once on validation failure. If `targetDate` was omitted, the same call is responsible for estimating one from context clues (goal type, typical timeline for that kind of goal, any hints in the title/constraints) and recording it in `Plan.assumptions`; the client then backfills `Goal.targetDate` from the estimate so later refinements have a fixed target unless the user corrects it.
3. **Critique & revise (bounded, one pass)**: a second LLM call reviews the draft semantic plan against the original goal and constraints — checking things schema validation can't, like whether the phase structure actually fits this specific goal, whether task durations/cadence are sensible, and whether every stated constraint was actually honored. It returns either an approval or a revised plan (same structured-output + zod validation as step 2). This runs at most once per generate/refine call — no open-ended self-correction loop — so worst case is 2 LLM calls, not an unbounded agent loop. This is the piece that answers "how do we get consistent results regardless of what the user typed," since a single pass has no check on its own output.
4. **Schedule (deterministic)**: for each `Task` in the (possibly revised) plan, find the earliest free slot of at least `durationMinutes` on `preferredDate` (or the nearest date allowed by `preferredDaysOfWeek`, searching outward within the same week) that doesn't overlap a `BusyBlock` from any connected provider — where "busy" means an accepted, non-all-day event explicitly marked busy (Google's freebusy semantics and Microsoft Graph's schedule status are treated the same way here; tentative/declined RSVPs and all-day events don't block, on either provider). Sets `scheduledStart`/`scheduledEnd` and `schedulingStatus`. Tasks that stay `schedulingStatus: 'conflict'` after this search are left unscheduled and visibly flagged on the calendar rather than auto-bumped elsewhere or overlapped — resolving them is left to the user via chat, same as any other refinement.
5. **Post the draft + invite feedback**: as soon as scheduling finishes, the client renders the draft calendar (never blocking on a round-trip question first) and appends an assistant `ChatMessage` built from `Plan.summary` and `Plan.assumptions` — each assumption phrased as an invitation to correct it (e.g. *"Assumed a beginner starting point since no current mileage was given — tell me your current weekly mileage and I can tailor the early weeks"*) rather than a blocking question. The user can reply to it like any other refinement, or ignore it and just look at the draft.
6. **Refinement**: `POST /api/plan/refine` — input `{ goal, currentPlan, newConstraint }`. The full current plan and the new natural-language constraint go back to the LLM with instructions to produce an updated semantic plan that satisfies *all* constraints (old + new) while changing as little as possible elsewhere. Result goes through the same critique & revise pass (step 3), is re-run through the scheduling pass against the same busy blocks, saved as a new `Plan` version, and diffed client-side (by task id/date) so the UI can highlight added/removed/moved tasks.
7. Regeneration is **full-plan**, not incremental patching — simpler to implement and reason about, and the LLM has full context each time. Revisit only if response latency or plan instability becomes a problem.
8. The provider is OpenAI (already a dependency in this repo) behind a single `generatePlan()` / `refinePlan()` interface — internally each is generate-then-critique, but that's an implementation detail behind the interface, so swapping models/providers later doesn't touch the rest of the app.

## 6. Calendar

Two independent directions, against each connected provider (Google and/or Microsoft) for v1:

- **Read (availability + content)**: on connect, and before every generate/refine, the app fetches events for the plan horizon from every connected provider — Google's `events.list`, Microsoft Graph's `calendarView` — and merges them into one `BusyBlock[]` list, now carrying each event's real `title` (§4). Only non-all-day events not explicitly marked free block scheduling (unchanged from the original definition); all-day events are skipped entirely rather than fetched, to keep this to one unified call per provider. This is read-only — it never modifies the user's calendar. Existing events are shown (read-only, with their real titles) alongside the plan in the in-app calendar view for context, so the user can see both *why* a task landed where it did and *what* it's next to. Both requests go straight from the browser to the provider (no server proxy — see the tension note above), using the same `calendar`/`Calendars.ReadWrite` scope already granted for push.
- **Write (push the plan)**: one-way, app → one chosen connected provider, v1 only, and **only ever triggered by an explicit user action** (e.g. a "Push to Google Calendar" / "Push to Outlook Calendar" button, one per connected provider) — never automatically on generate or refine. If only one provider is connected, only that button appears; if both are, the user picks. Like the read side, this goes straight from the browser to the provider's API — no server proxy, since only the OAuth token (not the client secret) is needed to create/update/delete calendars and events.
  - First push to a given provider creates a dedicated calendar named after the goal (e.g. "Seattle Marathon Plan", "AI Project Plan") and records its id in `Goal.externalCalendarIds` — every later push to that provider reuses the same calendar rather than creating a new one each time.
  - Each scheduled `Task` maps to one event at `scheduledStart`/`scheduledEnd`. If the task already carries a `syncedEventId` for this provider (a second push of the *same* plan version), the existing event is updated in place; otherwise a new event is created. After every task is written, the full set of event ids just written is compared against `Goal.syncedEventIds` from the *previous* push to that provider — any id present before but not now (a task that existed in an earlier plan version but was removed or changed by a refine) gets deleted. This is what keeps "update or delete rather than duplicate" true across regenerations, even though regenerated tasks are new objects with new ids each time (see the `Task.syncedEventId` comment in §4) — the staleness check lives at the goal level specifically because per-task ids can't carry across versions.
  - If the user edits an event directly in Google or Outlook Calendar, the app does not detect or reconcile that drift in v1 — the app's local plan is always the source of truth on push.
- **In-app view (the draft)**: week and month grid rendered from `Task[]` (flattened across all phases/weeks), using `scheduledStart`/`scheduledEnd` once scheduled, overlaid with the read-only `BusyBlock[]` merged from all connected calendars. This is the working draft — every generation and refinement updates it instantly and locally; it only becomes "real" once explicitly pushed. Clicking a task shows its description; a list/agenda view complements the grid.

## 7. Tech stack

- Next.js 16 (App Router, already scaffolded), React 19, TypeScript, Tailwind 4 — already in place.
- `zod` for validating LLM output against the `Plan` schema — already a dependency.
- `openai` SDK for generation — already a dependency.
- IndexedDB (via `idb`) for local persistence — already in place.
- Direct REST calls (no heavy SDK) for both providers' OAuth token exchange + Calendar API: Google's `/calendar/v3` (events, calendars), Microsoft Graph's `/me/calendarView` + `/me/calendars` + `/me/events`. Keeping both as plain REST keeps the two providers symmetric in the codebase rather than mixing an SDK-based Google client with a hand-rolled Microsoft one.
- **Google OAuth scope**: `https://www.googleapis.com/auth/calendar` (full access), not the narrower `calendar.readonly` used in the original step-2 build — creating a dedicated calendar (needed for push) requires the full scope; the narrower one only covered read. Anyone who connected Google before this scope widened needs to reconnect (disconnect + go through the consent screen again) to get a token with write access — the old token simply won't have permission to create a calendar or events. Microsoft's `Calendars.ReadWrite`, requested from the start, already covered both directions.
- Calendar UI: build a minimal week/month grid first; consider a library (e.g. FullCalendar) only if the hand-rolled version becomes a bottleneck.

## 8. Non-goals for v1

- Multi-user accounts, server-side database, sharing plans between people.
- Reading or writing Apple/iCloud calendars — it has no OAuth (CalDAV + a manually-generated app-specific password instead), a genuinely different and clunkier integration than Google/Microsoft, not just more of the same work. Revisit only if there's real demand for it.
- Pushing a plan to more than one connected provider at once (the user picks one destination per push, even if both Google and Microsoft are connected for reading).
- Two-way calendar sync / conflict detection (drift in the pushed calendar after sync is not reconciled, on either provider).
- Domain-expert-validated methodologies for any specific goal type (the plan is only as good as the LLM's output; no hard-coded sports-science, project-management, or curriculum rules).
- Mobile app / notifications / reminders.
- Editing tasks by dragging on the calendar (may be a fast follow).
- Automatically resolving scheduling conflicts beyond same-week nearby-day search (e.g. no cross-week rebalancing if a whole week is booked solid) — conflicts are surfaced to the user instead.
- **Feeding existing event content into plan generation.** Event titles are now read and displayed (§4, §6 — revised from the original "opaque busy blocks" design), but the LLM never sees them. The interesting case is still open: if someone already has recurring "gym"/"run" events, that's a real signal about their fitness baseline and could inform the plan (e.g. skip early "build the habit" weeks). A natural fast-follow: pass relevant titles into `Plan.assumptions` (e.g. *"You already have 3 runs/week on your calendar — assuming an intermediate base, not starting from zero"*), letting the user confirm or correct it like any other assumption. Not done yet — this non-goal is now narrower than it used to be (content is read and shown, just not used as generation input).

## 9. Open questions

None currently — the four open questions from the previous iteration (clarify-before-generating, concurrent goals, busy-time definition, unschedulable-conflict UX) are all resolved and folded into §3's decision table and the relevant sections above.

## 10. Suggested build order

1. Data model + IndexedDB persistence + static calendar UI shell (seed with a hand-written example plan, no LLM yet). **Done.**
2. Google **and** Microsoft/Outlook OAuth connect flows + freebusy fetch (merged into one `BusyBlock[]`), rendering existing busy blocks on the calendar shell as its own standalone step — this should work and look complete before a goal ever exists (still no LLM). **Deferred** — needs a Google Cloud OAuth Client ID/Secret *and* a Microsoft Entra ID app registration, neither of which existed yet when step 3 was ready to start. Reordered after step 3/4 rather than blocking on it: the scheduler (§5 step 4) takes `BusyBlock[]` as a plain input, and an empty array (no calendar connected) is a valid value — everything just schedules at its preferred time with nothing to avoid. Revisit once both providers' credentials exist. (Originally scoped as Google-only; widened to include Microsoft after a mid-build product discussion — see conversation.)
3. Goal entry + wire up `generatePlan()` — this is where the generate-then-critique-and-revise pair (§5 steps 2-3) gets built and tested — + the deterministic scheduling pass against fetched busy blocks (an empty list, per the note above, until step 2 is done) → rendered **draft** calendar with real scheduled times. Worth testing against goals from a few different domains here (marathon, a project, a skill) specifically because that's what the critique pass exists to keep consistent. **Done.**
4. Chat panel + `refinePlan()` — reuses the same generate-then-critique pair from step 3 — constraint history, regeneration, re-scheduling. **Done** (diff highlighting explicitly deferred — the calendar re-renders the new plan version without a visual diff for now).
5. Explicit "push to Google/Outlook Calendar" action (one button per connected provider), one-way, to a dedicated calendar, with update/delete-stale handling across regenerations (§6). Requires widening the Google OAuth scope (§7) and reading real event content instead of opaque busy blocks (§3, §4, §6, §8) — both pulled in during this step rather than step 2, once real use surfaced the need.
6. Polish: multiple goals (a "New Goal" button pulled forward into this pass — see `Goal.status: 'archived'`, §3, §4), task completion tracking, editing, conflict-resolution UX.
