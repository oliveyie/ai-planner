"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarShell } from "@/src/components/calendar/CalendarShell";
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

  if (loading) {
    return <div className="p-8 text-sm text-foreground/60">Loading…</div>;
  }

  if (!goal || !plan) {
    return <GoalEntryForm onCreated={handleCreated} />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <ChatTranscript messages={messages} />
      <CalendarShell goal={goal} plan={plan} />
    </div>
  );
}
