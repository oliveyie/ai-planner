"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarShell } from "@/src/components/calendar/CalendarShell";
import { ConnectCalendarScreen } from "@/src/components/calendar/ConnectCalendarScreen";
import { EmptyCalendarPreview } from "@/src/components/calendar/EmptyCalendarPreview";
import { PlanSummaryCard } from "@/src/components/calendar/PlanSummaryCard";
import { ChatComposer } from "@/src/components/chat/ChatComposer";
import { GoalEntryForm } from "@/src/components/goal/GoalEntryForm";
import { AppHeader } from "@/src/components/layout/AppHeader";
import { TypewriterText } from "@/src/components/whimble/TypewriterText";
import { WhimbleMascot } from "@/src/components/whimble/WhimbleMascot";
import { fetchCalendarEvents, pushPlanToCalendar } from "@/src/lib/calendar/calendar-api";
import { addDays, parseISODate } from "@/src/lib/utils/date-utils";
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
import { buildPlanChatMessage } from "@/src/lib/utils/plan-utils";
import type {
  BusyBlock,
  CalendarConnection,
  CalendarProvider,
  ChatMessage,
  Goal,
  Plan,
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
  const initialized = useRef(false);

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
              hideHeader
            />
          </div>
        </div>
      </div>
    </>
  );
}
