"use client";

import { useState } from "react";
import { formatPhaseDateRange } from "@/src/lib/utils/date-utils";
import { flattenTasks, mapPlanTasks, removeTaskFromPlan, taskSortKey } from "@/src/lib/utils/plan-utils";
import type { Goal, Plan, Task } from "@/src/lib/utils/types";
import { EditableTaskRow } from "./EditableTaskRow";

// Ported from the Stitch "Cheeky Plan Draft & Calendar Split View" screen —
// the left-hand "My Plan" card. Tasks are grouped under their own phase
// (rather than a separate flat "steps" bullet list plus a separate flat
// "upcoming tasks" list, which is what this used to do) and are directly
// editable via EditableTaskRow — onUpdatePlan persists every edit/delete as
// a plain local change to the current plan, not an LLM regeneration.
export function PlanSummaryCard({
  goal,
  plan,
  onUpdatePlan,
}: {
  goal: Goal;
  plan: Plan;
  onUpdatePlan: (plan: Plan) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allTasks = flattenTasks(plan);
  const activeTasks = allTasks.filter((t) => t.type !== "rest");
  const scheduledCount = activeTasks.filter((t) => t.schedulingStatus === "scheduled").length;

  const totalWeeks = plan.phases.reduce((sum, phase) => sum + phase.weeks.length, 0);
  const avgPerWeek = totalWeeks > 0 ? Math.max(1, Math.round(activeTasks.length / totalWeeks)) : activeTasks.length;

  const title = plan.shortTitle || goal.title;

  function handleSaveTask(updatedTask: Task) {
    onUpdatePlan(mapPlanTasks(plan, new Map([[updatedTask.id, updatedTask]])));
  }

  function handleDeleteTask(taskId: string) {
    onUpdatePlan(removeTaskFromPlan(plan, taskId));
  }

  const content = (
    <div>
      <h2 className="font-fraunces text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-clay">
        {totalWeeks} week{totalWeeks === 1 ? "" : "s"} • ~{avgPerWeek} session{avgPerWeek === 1 ? "" : "s"} a week •{" "}

        <span className="rounded-full border border-sage-dark/20 bg-sage px-2.5 py-1 text-xs font-bold text-sage-dark">
          {scheduledCount}/{activeTasks.length} Tasks Set
        </span>
      </p>
      
      <div className="mt-4 flex flex-col gap-5">
        {activeTasks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#EDE2D4] px-3.5 py-4 text-center font-fraunces text-sm text-clay-light">
            all done. nice work.
          </p>
        )}
        {plan.phases.map((phase) => {
          const phaseTasks = phase.weeks
            .flatMap((week) => week.tasks)
            .filter((t) => t.type !== "rest")
            .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)));

          if (phaseTasks.length === 0) return null;

          return (
            <div key={phase.id} className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-foreground">{phase.name}</h3>
                <span className="text-xs text-clay-light">
                  {formatPhaseDateRange(phase.startDate, phase.endDate, phase.weeks.length)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {phaseTasks.map((task) => (
                  // Stops the click from bubbling up to the card's own
                  // expand-on-click handler — a task click should edit
                  // that task, not also pop the whole card open.
                  <div key={task.id} onClick={(e) => e.stopPropagation()}>
                    <EditableTaskRow task={task} onSave={handleSaveTask} onDelete={handleDeleteTask} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div
        onClick={() => setExpanded(true)}
        className="flex h-full cursor-pointer flex-col gap-4 rounded-3xl border border-[#EFE5D8] bg-surface-card/95 p-5 shadow-[0_6px_24px_rgba(215,190,170,0.06)] transition-shadow hover:shadow-[0_10px_32px_rgba(215,190,170,0.14)] sm:p-6"
      >
        {content}
      </div>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1c18]/40 p-4 backdrop-blur-sm sm:p-8"
        >
          {/* max-height + its own scroll live on this outer box (not the
              flex/backdrop wrapper) — centering a flex item in a scrolling
              container can otherwise clip its start, and the close button
              needs to stay put rather than scrolling away with the content. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-[#EFE5D8] bg-surface-card shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface-card text-clay-light shadow-sm transition-colors hover:bg-surface-low hover:text-foreground"
            >
              ×
            </button>
            <div className="flex flex-col gap-4 overflow-y-auto p-6 sm:p-8">{content}</div>
          </div>
        </div>
      )}
    </>
  );
}
