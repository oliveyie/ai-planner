import { generatePlan } from "@/src/lib/generate-plan";
import { makeId } from "@/src/lib/ids";
import { toISODate } from "@/src/lib/date-utils";
import type { Goal } from "@/src/lib/types";

type GenerateRequestBody = {
  title?: string;
  startDate?: string;
  targetDate?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateRequestBody;

  if (!body.title || !body.title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const goal: Goal = {
    id: makeId("goal"),
    title: body.title.trim(),
    startDate: body.startDate?.trim() || toISODate(new Date()),
    targetDate: body.targetDate?.trim() || undefined,
    constraints: [],
    status: "active",
    createdAt: new Date().toISOString(),
  };

  try {
    // No calendar connection yet (SPEC.md §10 step 2 is deferred) — an empty
    // busy-blocks list is a normal, valid input to the scheduler.
    const { plan, resolvedTargetDate } = await generatePlan(goal, []);

    if (!goal.targetDate && resolvedTargetDate) {
      goal.targetDate = resolvedTargetDate;
    }

    return Response.json({ goal, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
