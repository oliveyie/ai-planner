"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarShell } from "@/src/components/calendar/CalendarShell";
import { ConnectCalendarScreen } from "@/src/components/calendar/ConnectCalendarScreen";
import { ChatComposer } from "@/src/components/chat/ChatComposer";
import { ChatTranscript } from "@/src/components/chat/ChatTranscript";
import { GoalEntryForm } from "@/src/components/goal/GoalEntryForm";
import { fetchFreeBusy } from "@/src/lib/calendar-api";
import { addDays, parseISODate } from "@/src/lib/date-utils";
import {
  getActiveGoal,
  getAllCalendarConnections,
  getChatMessages,
  getLatestPlan,
  saveCalendarConnection,
  saveChatMessage,
  saveGoal,
  savePlan,
} from "@/src/lib/db";
import { makeId } from "@/src/lib/ids";
import { buildPlanOutlineMessage } from "@/src/lib/plan-utils";
import type {
  BusyBlock,
  CalendarConnection,
  CalendarProvider,
  ChatMessage,
  Goal,
  Plan,
} from "@/src/lib/types";

const SKIP_STORAGE_KEY = "whimsycal:calendarConnectSkipped";
const DEFAULT_HORIZON_DAYS = 180; // used before a target date is known yet

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

  async function handleCreateGoal(title: string) {
    // Target date isn't known yet at this point, so fetch a generous default
    // horizon rather than a precise one — refine calls (below) can narrow it
    // once a target date exists.
    const freshBusyBlocks = await fetchFreeBusy(new Date(), addDays(new Date(), DEFAULT_HORIZON_DAYS));

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
      content: buildPlanOutlineMessage(newPlan),
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

    const horizonStart = new Date();
    const horizonEnd = goal.targetDate
      ? parseISODate(goal.targetDate)
      : addDays(horizonStart, DEFAULT_HORIZON_DAYS);
    const freshBusyBlocks = await fetchFreeBusy(horizonStart, horizonEnd);

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
      content: buildPlanOutlineMessage(updatedPlan),
      createdAt: updatedPlan.generatedAt,
      resultingPlanVersion: updatedPlan.version,
    };
    await saveChatMessage(assistantMessage);

    setBusyBlocks(freshBusyBlocks);
    setGoal(updatedGoal);
    setPlan(updatedPlan);
    setMessages((prev) => [...prev, assistantMessage]);
  }

  if (loading) {
    return <div className="p-8 text-sm text-foreground/60">Loading…</div>;
  }

  if (!goal || !plan) {
    const errorBanner = connectError && (
      <p className="p-4 text-sm text-red-600">Calendar connection failed: {connectError}</p>
    );

    if (connections.length === 0 && !skippedConnect) {
      return (
        <div className="flex flex-col gap-4">
          {errorBanner}
          <ConnectCalendarScreen onSkip={handleSkipConnect} />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {errorBanner}
        <GoalEntryForm onSubmit={handleCreateGoal} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 border-b border-foreground/10 pb-6">
        <ChatTranscript messages={messages} />
        <ChatComposer onSend={handleRefine} />
      </div>
      <CalendarShell goal={goal} plan={plan} busyBlocks={busyBlocks} />
    </div>
  );
}
