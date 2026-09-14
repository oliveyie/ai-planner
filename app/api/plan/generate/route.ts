import { generatePlan } from "@/src/lib/planner/generate-plan";
import { makeId } from "@/src/lib/utils/ids";
import { toISODate } from "@/src/lib/utils/date-utils";
import type { BusyBlock, Goal } from "@/src/lib/utils/types";

type GenerateRequestBody = {
  title?: string;
  startDate?: string;
  targetDate?: string;
  busyBlocks?: BusyBlock[];
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
    // busyBlocks comes from the client, which is where calendar connections
    // (and their tokens) live — see SPEC.md §3. An empty/missing list (no
    // calendar connected) is a normal, valid input to the scheduler.
    const { plan, resolvedTargetDate } = await generatePlan(goal, body.busyBlocks ?? []);

    if (!goal.targetDate && resolvedTargetDate) {
      goal.targetDate = resolvedTargetDate;
    }

    return Response.json({ goal, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
