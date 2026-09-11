import { refinePlan } from "@/src/lib/generate-plan";
import type { Goal, Plan } from "@/src/lib/types";

type RefineRequestBody = {
  goal?: Goal;
  currentPlan?: Plan;
  message?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RefineRequestBody;

  if (!body.goal || !body.currentPlan || !body.message?.trim()) {
    return Response.json({ error: "goal, currentPlan, and message are required" }, { status: 400 });
  }

  const updatedGoal: Goal = {
    ...body.goal,
    constraints: [...body.goal.constraints, body.message.trim()],
  };

  try {
    // No calendar connection yet (SPEC.md §10 step 2 is deferred) — an empty
    // busy-blocks list is a normal, valid input to the scheduler.
    const { plan, resolvedTargetDate } = await refinePlan(updatedGoal, body.currentPlan, []);

    if (!updatedGoal.targetDate && resolvedTargetDate) {
      updatedGoal.targetDate = resolvedTargetDate;
    }

    return Response.json({ goal: updatedGoal, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan refinement failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
