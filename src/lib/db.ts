// Client-only IndexedDB persistence (SPEC.md §3, §4). Only ever called from
// client components, inside effects — never during server rendering.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CalendarConnection, CalendarProvider, ChatMessage, Goal, Plan } from "./types";

const DB_NAME = "ai-planner";
const DB_VERSION = 1;

interface AiPlannerDB extends DBSchema {
  goals: {
    key: string;
    value: Goal;
  };
  plans: {
    key: string;
    value: Plan;
    indexes: { goalId: string };
  };
  chatMessages: {
    key: string;
    value: ChatMessage;
    indexes: { goalId: string };
  };
  calendarConnections: {
    key: string; // provider
    value: CalendarConnection;
  };
}

let dbPromise: Promise<IDBPDatabase<AiPlannerDB>> | undefined;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AiPlannerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("goals", { keyPath: "id" });

        const plans = db.createObjectStore("plans", { keyPath: "id" });
        plans.createIndex("goalId", "goalId");

        const chatMessages = db.createObjectStore("chatMessages", { keyPath: "id" });
        chatMessages.createIndex("goalId", "goalId");

        db.createObjectStore("calendarConnections", { keyPath: "provider" });
      },
    });
  }
  return dbPromise;
}

export async function getActiveGoal(): Promise<Goal | undefined> {
  const db = await getDb();
  const goals = await db.getAll("goals");
  return goals.find((goal) => goal.status === "active");
}

export async function saveGoal(goal: Goal): Promise<void> {
  const db = await getDb();
  await db.put("goals", goal);
}

export async function savePlan(plan: Plan): Promise<void> {
  const db = await getDb();
  await db.put("plans", plan);
}

export async function listPlanVersions(goalId: string): Promise<Plan[]> {
  const db = await getDb();
  const plans = await db.getAllFromIndex("plans", "goalId", goalId);
  return plans.sort((a, b) => a.version - b.version);
}

export async function getLatestPlan(goalId: string): Promise<Plan | undefined> {
  const versions = await listPlanVersions(goalId);
  return versions.at(-1);
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const db = await getDb();
  await db.put("chatMessages", message);
}

export async function getChatMessages(goalId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const messages = await db.getAllFromIndex("chatMessages", "goalId", goalId);
  return messages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export async function saveCalendarConnection(connection: CalendarConnection): Promise<void> {
  const db = await getDb();
  await db.put("calendarConnections", connection);
}

export async function getCalendarConnection(
  provider: CalendarProvider,
): Promise<CalendarConnection | undefined> {
  const db = await getDb();
  return db.get("calendarConnections", provider);
}

export async function getAllCalendarConnections(): Promise<CalendarConnection[]> {
  const db = await getDb();
  return db.getAll("calendarConnections");
}

export async function deleteCalendarConnection(provider: CalendarProvider): Promise<void> {
  const db = await getDb();
  await db.delete("calendarConnections", provider);
}
