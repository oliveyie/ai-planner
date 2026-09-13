import { formatTimeLabel, parseISODate, parseISODateTime, toISODate } from "@/src/lib/date-utils";
import { flattenTasks } from "@/src/lib/plan-utils";
import { TASK_TYPE_STYLES } from "@/src/lib/task-colors";
import type { Goal, Plan, Task } from "@/src/lib/types";

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function taskSortKey(task: Task): string {
  return task.scheduledStart ?? `${task.preferredDate}T99:99`;
}

// Ported from the Stitch "Cheeky Plan Draft & Calendar Split View" screen —
// the left-hand "My Plan" card. Unlike the mockup's three hardcoded routine
// cards, this reads real plan data: it shows the next handful of upcoming
// tasks (not just one week), and a real scheduled/total ratio rather than a
// fixed "3/3 Slots Set".
export function PlanSummaryCard({ goal, plan }: { goal: Goal; plan: Plan }) {
  const allTasks = flattenTasks(plan);
  const activeTasks = allTasks.filter((t) => t.type !== "rest");
  const scheduledCount = activeTasks.filter((t) => t.schedulingStatus === "scheduled").length;

  const totalWeeks = plan.phases.reduce((sum, phase) => sum + phase.weeks.length, 0);
  const avgPerWeek = totalWeeks > 0 ? Math.max(1, Math.round(activeTasks.length / totalWeeks)) : activeTasks.length;

  const todayKey = toISODate(new Date());
  const upcoming = activeTasks
    .filter((t) => {
      const key = t.scheduledStart ? toISODate(parseISODateTime(t.scheduledStart)) : t.preferredDate;
      return key >= todayKey;
    })
    .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)))
    .slice(0, 6);

  const restDayNames = Array.from(
    new Set(
      allTasks
        .filter((t) => t.type === "rest" && t.preferredDaysOfWeek)
        .flatMap((t) => t.preferredDaysOfWeek ?? [])
        .map((d) => WEEKDAY_SHORT[d]),
    ),
  );

  const currentPhase = plan.phases.find((phase) => phase.startDate <= todayKey && phase.endDate >= todayKey);

  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-3xl border border-[#EFE5D8] bg-surface-card/95 p-5 shadow-[0_6px_24px_rgba(215,190,170,0.06)] sm:p-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-coral/30 bg-peach px-2.5 py-1 text-xs font-bold text-peach-dark">
            {currentPhase?.name ?? plan.phases[0]?.name ?? "Your Plan"}
          </span>
          <span className="rounded-full border border-sage-dark/20 bg-sage px-2.5 py-1 text-xs font-bold text-sage-dark">
            {scheduledCount}/{activeTasks.length} Slots Set
          </span>
        </div>

        <h2 className="font-fraunces text-2xl font-semibold tracking-tight text-foreground">{goal.title}</h2>
        <p className="mt-1 text-xs text-clay">
          {totalWeeks} week{totalWeeks === 1 ? "" : "s"} • ~{avgPerWeek} session{avgPerWeek === 1 ? "" : "s"} a week
        </p>

        <div className="mt-3 flex flex-col gap-1.5 text-xs text-clay">
          <p>{plan.summary}</p>
          <div>
            <span className="font-semibold text-clay-light">steps:</span>
            <ul className="mt-0.5 flex flex-col gap-0.5">
              {plan.phases.map((phase) => {
                const weekCount = phase.weeks.length;
                return (
                  <li key={phase.id}>
                    - {phase.name} ({phase.startDate} to {phase.endDate}, {weekCount} week{weekCount === 1 ? "" : "s"})
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {upcoming.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#EDE2D4] px-3.5 py-4 text-center font-fraunces text-sm text-clay-light">
              all done. nice work.
            </p>
          )}
          {upcoming.map((task) => {
            const start = task.scheduledStart ? parseISODateTime(task.scheduledStart) : null;
            const end = task.scheduledEnd ? parseISODateTime(task.scheduledEnd) : null;
            const dayLabel = start ? WEEKDAY_SHORT[start.getDay()] : WEEKDAY_SHORT[parseISODate(task.preferredDate).getDay()];
            const style = TASK_TYPE_STYLES[task.type];

            return (
              <div
                key={task.id}
                className="rounded-2xl border border-[#EDE2D4] bg-surface-low/60 p-3.5 transition-colors hover:border-coral/40"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-coral/10 text-xs font-bold text-coral">
                      {dayLabel}
                    </span>
                    <span className="text-sm font-bold text-foreground">{task.title}</span>
                  </div>
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${style.chip}`}>
                    {style.label}
                  </span>
                </div>
                <div className="pl-9 text-xs font-semibold text-coral">
                  {task.schedulingStatus === "conflict"
                    ? "needs new time"
                    : start && end
                      ? `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`
                      : "not scheduled"}
                </div>
                {task.description && <p className="mt-1 pl-9 text-xs text-clay-light">{task.description}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#EDE2D4]/70 pt-3 text-xs text-clay">
        <span className="shrink-0 text-sage-dark">✿</span>
        {restDayNames.length > 0 ? (
          <span>
            rest day <strong className="text-foreground">{restDayNames.join(", ")}</strong>. whimble protects these.
          </span>
        ) : (
          <span>plenty of rest built in between.</span>
        )}
      </div>
    </div>
  );
}
