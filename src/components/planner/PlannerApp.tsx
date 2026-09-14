"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { BusyBlockDetailModal } from "@/src/components/calendar/BusyBlockDetailModal";
import { CalendarShell } from "@/src/components/calendar/CalendarShell";
import { ConnectCalendarScreen } from "@/src/components/calendar/ConnectCalendarScreen";
import { EmptyCalendarPreview } from "@/src/components/calendar/EmptyCalendarPreview";
import { PlanSummaryCard } from "@/src/components/calendar/PlanSummaryCard";
import { TaskDetailModal } from "@/src/components/calendar/TaskDetailModal";
import { ChatComposer } from "@/src/components/chat/ChatComposer";
import { GoalEntryForm } from "@/src/components/goal/GoalEntryForm";
import { AppHeader } from "@/src/components/layout/AppHeader";
import { TypewriterText } from "@/src/components/whimble/TypewriterText";
import { WhimbleMascot } from "@/src/components/whimble/WhimbleMascot";
import { fetchCalendarEvents, pushPlanToCalendar } from "@/src/lib/calendar/calendar-api";
import { addDays, parseISODate, parseISODateTime, toISODateTime } from "@/src/lib/utils/date-utils";
import {
  deleteCalendarConnection,
  getActiveGoal,
  getAllCalendarConnections,
  getChatMessages,
  getLatestPlan,
  saveCalendarConnection,
  saveChatMessage,
  saveGoal,
  savePlan,
} from "@/src/lib/db/db";
import { makeId } from "@/src/lib/utils/ids";
import {
  buildPlanChatMessage,
  flattenTasks,
  mapPlanTasks,
  removeTaskFromPlan,
  taskSortKey,
} from "@/src/lib/utils/plan-utils";
import type {
  BusyBlock,
  CalendarConnection,
  CalendarProvider,
  ChatMessage,
  Goal,
  Plan,
  Task,
} from "@/src/lib/utils/types";

const SKIP_STORAGE_KEY = "whimble:calendarConnectSkipped";
const DEFAULT_HORIZON_DAYS = 180; // used before a target date is known yet
// How far back to also fetch busy blocks for, purely for display context —
// without this, navigating the calendar back a week/month looks like those
// days were wide open even when they weren't. Harmless for scheduling itself:
// tasks are only ever placed on today-or-later dates, so a past busy block
// essentially never overlaps a real candidate slot.
const LOOKBACK_DAYS = 45;

// Reads the OAuth callback's token fragment (see src/lib/oauth-routes.ts) —
// deliberately a fragment, not a query string, since fragments are never
// sent over the network.
function parseOAuthFragment(): CalendarConnection | null {
  if (typeof window === "undefined" || !window.location.hash) return null;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const provider = params.get("calendar_connected") as CalendarProvider | null;
  const accessToken = params.get("access_token");
  const expiresAt = params.get("expires_at");
  if (!provider || !accessToken || !expiresAt) return null;

  return {
    provider,
    accessToken,
    expiresAt,
    refreshToken: params.get("refresh_token") ?? undefined,
    displayName: params.get("display_name") ?? undefined,
    connectedAt: new Date().toISOString(),
  };
}

export function PlannerApp() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [skippedConnect, setSkippedConnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Set by clicking a task/busy block chip anywhere on the calendar
  // (WeekView/MonthView/AgendaList) — opens TaskDetailModal/BusyBlockDetailModal.
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedBusyBlock, setSelectedBusyBlock] = useState<BusyBlock | null>(null);
  const initialized = useRef(false);
  // 8px activation distance so a plain click (open a task's edit mode) still
  // works — dnd-kit only treats it as a drag once the pointer actually moves.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    // Ref guard, not a cancelled-flag/cleanup pair — see git history on
    // CalendarShell for why that combination breaks under React Strict Mode.
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      const newConnection = parseOAuthFragment();
      if (newConnection) {
        await saveCalendarConnection(newConnection);
        window.history.replaceState(null, "", window.location.pathname);
      }

      const errorParam = new URLSearchParams(window.location.search).get("calendar_error");
      if (errorParam) {
        setConnectError(errorParam);
        const url = new URL(window.location.href);
        url.searchParams.delete("calendar_error");
        window.history.replaceState(null, "", url.pathname + url.search);
      }

      const activeGoal = await getActiveGoal();
      const activePlan = activeGoal ? await getLatestPlan(activeGoal.id) : undefined;
      const history = activeGoal ? await getChatMessages(activeGoal.id) : [];
      const allConnections = await getAllCalendarConnections();

      if (activeGoal && allConnections.length > 0) {
        const horizonStart = addDays(new Date(), -LOOKBACK_DAYS);
        const horizonEnd = activeGoal.targetDate
          ? parseISODate(activeGoal.targetDate)
          : addDays(new Date(), DEFAULT_HORIZON_DAYS);
        setBusyBlocks(await fetchCalendarEvents(horizonStart, horizonEnd));
      }

      setGoal(activeGoal ?? null);
      setPlan(activePlan ?? null);
      setMessages(history);
      setConnections(allConnections);
      setSkippedConnect(localStorage.getItem(SKIP_STORAGE_KEY) === "1");
      setLoading(false);
    })();
  }, []);

  function handleSkipConnect() {
    localStorage.setItem(SKIP_STORAGE_KEY, "1");
    setSkippedConnect(true);
  }

  async function handleDisconnect(provider: CalendarProvider) {
    await deleteCalendarConnection(provider);
    setConnections((prev) => prev.filter((c) => c.provider !== provider));
    // Drop that provider's events immediately rather than waiting for the
    // next fetch — calendar-api.ts would exclude them anyway (no connection
    // to read with), but the stale chips would otherwise linger on screen.
    setBusyBlocks((prev) => prev.filter((b) => b.source !== provider));
  }

  async function handleCreateGoal(title: string) {
    // Target date isn't known yet at this point, so fetch a generous default
    // horizon rather than a precise one — refine calls (below) can narrow it
    // once a target date exists.
    const freshBusyBlocks = await fetchCalendarEvents(
      addDays(new Date(), -LOOKBACK_DAYS),
      addDays(new Date(), DEFAULT_HORIZON_DAYS),
    );

    const response = await fetch("/api/plan/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, busyBlocks: freshBusyBlocks }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to generate plan");
    }

    const newGoal = data.goal as Goal;
    const newPlan = data.plan as Plan;

    await saveGoal(newGoal);
    await savePlan(newPlan);

    const userMessage: ChatMessage = {
      id: makeId("msg"),
      goalId: newGoal.id,
      role: "user",
      content: newGoal.title,
      createdAt: newGoal.createdAt,
    };
    const assistantMessage: ChatMessage = {
      id: makeId("msg"),
      goalId: newGoal.id,
      role: "assistant",
      content: buildPlanChatMessage(newPlan),
      createdAt: newPlan.generatedAt,
      resultingPlanVersion: newPlan.version,
    };
    await saveChatMessage(userMessage);
    await saveChatMessage(assistantMessage);

    setBusyBlocks(freshBusyBlocks);
    setGoal(newGoal);
    setPlan(newPlan);
    setMessages([userMessage, assistantMessage]);
  }

  async function handleRefine(message: string) {
    if (!goal || !plan) return;

    const userMessage: ChatMessage = {
      id: makeId("msg"),
      goalId: goal.id,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    await saveChatMessage(userMessage);
    setMessages((prev) => [...prev, userMessage]);

    const horizonStart = addDays(new Date(), -LOOKBACK_DAYS);
    const horizonEnd = goal.targetDate
      ? parseISODate(goal.targetDate)
      : addDays(new Date(), DEFAULT_HORIZON_DAYS);
    const freshBusyBlocks = await fetchCalendarEvents(horizonStart, horizonEnd);

    const response = await fetch("/api/plan/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, currentPlan: plan, message, busyBlocks: freshBusyBlocks }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to refine plan");
    }

    const updatedGoal = data.goal as Goal;
    const updatedPlan = data.plan as Plan;

    await saveGoal(updatedGoal);
    await savePlan(updatedPlan);

    const assistantMessage: ChatMessage = {
      id: makeId("msg"),
      goalId: updatedGoal.id,
      role: "assistant",
      content: buildPlanChatMessage(updatedPlan),
      createdAt: updatedPlan.generatedAt,
      resultingPlanVersion: updatedPlan.version,
    };
    await saveChatMessage(assistantMessage);

    setBusyBlocks(freshBusyBlocks);
    setGoal(updatedGoal);
    setPlan(updatedPlan);
    setMessages((prev) => [...prev, assistantMessage]);
  }

  async function handleNewGoal() {
    if (!goal) return;
    if (!window.confirm("Start a new goal? This one will be archived, not deleted.")) return;

    if (goal.status === "active") {
      await saveGoal({ ...goal, status: "archived" });
    }

    setGoal(null);
    setPlan(null);
    setMessages([]);
    setBusyBlocks([]);
  }

  async function handleUpdatePlan(updatedPlan: Plan) {
    await savePlan(updatedPlan);
    setPlan(updatedPlan);
  }

  function handleSaveSelectedTask(updatedTask: Task) {
    if (!plan) return;
    handleUpdatePlan(mapPlanTasks(plan, new Map([[updatedTask.id, updatedTask]])));
  }

  function handleDeleteSelectedTask(taskId: string) {
    if (!plan) return;
    handleUpdatePlan(removeTaskFromPlan(plan, taskId));
  }

  // Drag-and-drop for tasks (Pass 2, extended to drag natively from the
  // calendar grid itself, in both WeekView and MonthView): dropping a task
  // onto a WeekView day column ("daycol:") retargets its date/time from the
  // drop's pixel position; dropping it onto a MonthView cell ("monthcol:")
  // only moves its date, keeping the same time of day (no time axis there to
  // derive a new time from). Dropping it onto another task row reorders the
  // list *without* touching either task's date/time —
  // an earlier version swapped their scheduled times instead, which the user
  // found confusing ("reordering shouldn't change the time or date"), so this
  // now uses Task.order (see plan-utils.ts's taskSortKey) purely for display
  // order in the plan card, decoupled from real scheduling. Scoped to
  // reordering within a single phase, matching how the plan card groups its
  // list; a cross-phase drop is ignored.
  //
  // A drag can originate either from the plan card's EditableTaskRow (plain
  // task id) or from a TaskChip on the calendar grid (id prefixed "cal:") —
  // the prefix exists only to keep the two draggables' dnd-kit ids distinct
  // when both can be mounted for the same task at once; every lookup below
  // strips it back off first so the rest of this function doesn't care which
  // one started the drag.
  function handleTaskDragEnd(event: DragEndEvent) {
    if (!plan) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id).replace(/^cal:/, "");
    const overId = String(over.id);
    if (activeId === overId) return;

    const allTasks = flattenTasks(plan);
    const draggedTask = allTasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    if (overId.startsWith("daycol:")) {
      const dropData = over.data.current as
        | { date: string; rangeStartMinutes: number; pxPerMinute: number }
        | undefined;
      const activeRect = active.rect.current.translated;
      if (!dropData || !activeRect) return;

      const offsetY = activeRect.top - over.rect.top;
      const rawMinutes = dropData.rangeStartMinutes + offsetY / dropData.pxPerMinute;
      const snappedMinutes = Math.max(0, Math.round(rawMinutes / 15) * 15); // snap to a quarter hour
      const startTime = `${String(Math.floor(snappedMinutes / 60)).padStart(2, "0")}:${String(snappedMinutes % 60).padStart(2, "0")}`;

      const durationMinutes =
        draggedTask.scheduledStart && draggedTask.scheduledEnd
          ? (parseISODateTime(draggedTask.scheduledEnd).getTime() -
              parseISODateTime(draggedTask.scheduledStart).getTime()) /
            60_000
          : (draggedTask.durationMinutes ?? 30);

      const newStart = parseISODateTime(`${dropData.date}T${startTime}`);
      const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);

      handleUpdatePlan(
        mapPlanTasks(
          plan,
          new Map([
            [
              draggedTask.id,
              {
                ...draggedTask,
                preferredDate: dropData.date,
                scheduledStart: toISODateTime(newStart),
                scheduledEnd: toISODateTime(newEnd),
                schedulingStatus: "scheduled" as const,
              },
            ],
          ]),
        ),
      );
      return;
    }

    if (overId.startsWith("monthcol:")) {
      // Month view has no time axis, so a drop here only moves the task to a
      // new date — the existing time of day (if any) carries over unchanged,
      // unlike a "daycol:" drop (WeekView), which derives a new time from the
      // drop's pixel position.
      const dropData = over.data.current as { date: string } | undefined;
      if (!dropData) return;

      const updated: Task =
        draggedTask.scheduledStart && draggedTask.scheduledEnd
          ? {
              ...draggedTask,
              preferredDate: dropData.date,
              scheduledStart: `${dropData.date}T${draggedTask.scheduledStart.split("T")[1]}`,
              scheduledEnd: `${dropData.date}T${draggedTask.scheduledEnd.split("T")[1]}`,
            }
          : { ...draggedTask, preferredDate: dropData.date };

      handleUpdatePlan(mapPlanTasks(plan, new Map([[draggedTask.id, updated]])));
      return;
    }

    const targetTask = allTasks.find((t) => t.id === overId);
    if (!targetTask) return;

    const phase = plan.phases.find((p) => p.weeks.some((w) => w.tasks.some((t) => t.id === draggedTask.id)));
    const targetInSamePhase = phase?.weeks.some((w) => w.tasks.some((t) => t.id === targetTask.id));
    if (!phase || !targetInSamePhase) return; // cross-phase reordering isn't supported yet

    // Rebuild this phase's currently-*displayed* task order (respecting any
    // existing manual order, else falling back to scheduled time — same rule
    // PlanSummaryCard uses to render), move the dragged task to the target's
    // position within that list, then persist the result as explicit order
    // numbers. Real dates/times are untouched.
    const phaseTasks = phase.weeks
      .flatMap((w) => w.tasks)
      .filter((t) => t.type !== "rest")
      .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)));

    const fromIndex = phaseTasks.findIndex((t) => t.id === draggedTask.id);
    const toIndex = phaseTasks.findIndex((t) => t.id === targetTask.id);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...phaseTasks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updates = new Map<string, Task>();
    reordered.forEach((t, index) => updates.set(t.id, { ...t, order: index }));

    handleUpdatePlan(mapPlanTasks(plan, updates));
  }

  async function handlePush(provider: CalendarProvider) {
    if (!goal || !plan) return;

    const { goal: updatedGoal, plan: updatedPlan } = await pushPlanToCalendar(provider, goal, plan);
    await saveGoal(updatedGoal);
    await savePlan(updatedPlan);

    setGoal(updatedGoal);
    setPlan(updatedPlan);
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <div className="p-8 text-sm text-clay">Loading…</div>
      </>
    );
  }

  if (!goal || !plan) {
    // The connect prompt is a dismissible overlay on the (blank, dimmed)
    // calendar preview, not a full-screen gate — the goal-entry section below
    // is always visible/usable regardless of whether it's showing.
    const showConnectModal = connections.length === 0 && !skippedConnect;

    return (
      <>
        <AppHeader connections={connections} onDisconnect={handleDisconnect} />
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-10 sm:px-6">
          {connectError && (
            <p className="text-center text-sm text-peach-dark">Calendar connection failed: {connectError}</p>
          )}

          <GoalEntryForm onSubmit={handleCreateGoal} />

          <main className="relative overflow-hidden rounded-[2.5rem] border border-[#f0e8dc] bg-surface-card/95 p-6 shadow-[0_8px_32px_-4px_rgba(184,150,120,0.08),0_2px_8px_-1px_rgba(184,150,120,0.04)] sm:p-8">
            <EmptyCalendarPreview dimmed={showConnectModal} connections={connections} />
            {showConnectModal && <ConnectCalendarScreen onSkip={handleSkipConnect} />}
          </main>
        </div>
      </>
    );
  }

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <>
      <AppHeader connections={connections} onDisconnect={handleDisconnect} />
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-5 px-4 sm:px-6 pb-16">
        <header className="px-2 pt-2">
          <h1 className="font-fraunces text-xl font-semibold tracking-tight text-foreground">{goal.title}</h1>
        </header>

        <section className="flex flex-col gap-3 rounded-3xl border border-[#EFE5D8] bg-surface-card/90 p-4 shadow-[0_6px_24px_rgba(215,190,170,0.06)] sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-[#EDE2D4]/60 px-1 pb-3">
            <div className="flex items-center gap-2">
              <WhimbleMascot size="sm" />
              <span className="font-fraunces text-sm italic text-foreground">Mr. Whimble</span>
            </div>
            <button
              onClick={handleNewGoal}
              className="text-sm font-semibold text-clay-light underline underline-offset-2 hover:text-clay"
            >
              + new whimble
            </button>
          </div>
          {latestAssistantMessage && (
            <p className="whitespace-pre-wrap px-1 text-sm text-foreground">
              <TypewriterText key={latestAssistantMessage.id} text={latestAssistantMessage.content} />
            </p>
          )}
          <ChatComposer onSend={handleRefine} />
        </section>

        <DndContext sensors={dndSensors} onDragEnd={handleTaskDragEnd}>
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <PlanSummaryCard goal={goal} plan={plan} onUpdatePlan={handleUpdatePlan} />
            </div>
            <div className="lg:col-span-7">
              <CalendarShell
                goal={goal}
                plan={plan}
                busyBlocks={busyBlocks}
                connections={connections}
                onPush={handlePush}
                onSelectTask={(task) => setSelectedTaskId(task.id)}
                onSelectBusyBlock={setSelectedBusyBlock}
                hideHeader
              />
            </div>
          </div>
        </DndContext>

        {selectedTaskId &&
          (() => {
            const selectedTask = flattenTasks(plan).find((t) => t.id === selectedTaskId);
            if (!selectedTask) return null;
            return (
              <TaskDetailModal
                task={selectedTask}
                onSave={handleSaveSelectedTask}
                onDelete={handleDeleteSelectedTask}
                onClose={() => setSelectedTaskId(null)}
              />
            );
          })()}

        {selectedBusyBlock && (
          <BusyBlockDetailModal block={selectedBusyBlock} onClose={() => setSelectedBusyBlock(null)} />
        )}
      </div>
    </>
  );
}
