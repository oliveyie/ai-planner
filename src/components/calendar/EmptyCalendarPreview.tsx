import { addDays, isSameDay, startOfMonth, startOfWeek, toISODate } from "@/src/lib/date-utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // matches this app's Sunday-start week
const VISIBLE_WEEKS = 4;

export function EmptyCalendarPreview({ dimmed = false }: { dimmed?: boolean }) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: VISIBLE_WEEKS * 7 }, (_, i) => addDays(gridStart, i));
  const monthLabel = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className={dimmed ? "pointer-events-none select-none opacity-40 blur-[1px]" : ""}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-2">
        <div className="flex items-center rounded-full border border-[#eee4d5] bg-white px-3 py-1.5 font-quicksand text-sm font-bold text-slate-700 shadow-xs">
          <button aria-label="Previous month" disabled className="p-1 text-slate-300">
            ←
          </button>
          <span className="px-3 tracking-tight">{monthLabel}</span>
          <button aria-label="Next month" disabled className="p-1 text-slate-300">
            →
          </button>
        </div>

        <div className="flex items-center rounded-full border border-[#ede3d3] bg-[#f8f5ee] p-1 font-quicksand text-xs font-bold text-slate-400">
          <span className="rounded-full bg-white px-4 py-1 text-slate-800 shadow-xs">Month</span>
          <span className="px-3.5 py-1 opacity-60">Week</span>
          <span className="px-3.5 py-1 opacity-60">Day</span>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-3 text-center font-quicksand text-xs font-bold uppercase tracking-wider text-slate-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={toISODate(day)}
              className={`min-h-[82px] rounded-2xl border-[1.5px] border-dashed p-2 transition-all ${
                isToday ? "border-amber-300 bg-amber-50/20" : "border-[#e8decb] bg-white/55"
              }`}
            >
              <span className={`text-xs font-semibold ${isToday ? "text-amber-500" : "text-slate-400"}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
