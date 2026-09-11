"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarShell } from "@/src/components/calendar/CalendarShell";
import { ChatComposer } from "@/src/components/chat/ChatComposer";
import { ChatTranscript } from "@/src/components/chat/ChatTranscript";
import { GoalEntryForm } from "@/src/components/goal/GoalEntryForm";
import {
  getActiveGoal,
  getChatMessages,
  getLatestPlan,
  saveChatMessage,
  saveGoal,
  savePlan,
} from "@/src/lib/db";
import { makeId } from "@/src/lib/ids";
import { buildPlanOutlineMessage } from "@/src/lib/plan-utils";
import type { ChatMessage, Goal, Plan } from "@/src/lib/types";

export function PlannerApp() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    // See CalendarShell's former version (git history) for why this needs to
    // be a ref guard, not a cancelled-flag/cleanup pair: React Strict Mode's
    // double-invoked effect would otherwise suppress this run's state update.
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      const activeGoal = await getActiveGoal();
      const activePlan = activeGoal ? await getLatestPlan(activeGoal.id) : undefined;
      const history = activeGoal ? await getChatMessages(activeGoal.id) : [];
      setGoal(activeGoal ?? null);
      setPlan(activePlan ?? null);
      setMessages(history);
      setLoading(false);
    })();
  }, []);

  async function handleCreated(newGoal: Goal, newPlan: Plan) {
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

    const response = await fetch("/api/plan/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, currentPlan: plan, message }),
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

    setGoal(updatedGoal);
    setPlan(updatedPlan);
    setMessages((prev) => [...prev, assistantMessage]);
  }

  if (loading) {
    return <div className="p-8 text-sm text-foreground/60">Loading…</div>;
  }

  if (!goal || !plan) {
    return <GoalEntryForm onCreated={handleCreated} />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 border-b border-foreground/10 pb-6">
        <ChatTranscript messages={messages} />
        <ChatComposer onSend={handleRefine} />
      </div>
      <CalendarShell goal={goal} plan={plan} />
    </div>
  );
}
