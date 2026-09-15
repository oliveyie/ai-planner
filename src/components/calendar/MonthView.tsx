import { useDroppable } from "@dnd-kit/core";
import { addDays, isSameDay, startOfMonth, startOfWeek, toISODate } from "@/src/lib/utils/date-utils";
import type { BusyBlock, Task } from "@/src/lib/utils/types";
import { BusyBlockChip } from "./BusyBlockChip";
import { TaskChip } from "./TaskChip";

const MAX_VISIBLE = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // matches this app's Sunday-start week

// A separate component (not inlined in a .map()) since useDroppable is a
// hook — same rules-of-hooks constraint as WeekView's DroppableDayColumn.
// Unlike that one, a month cell has no time axis: dropping a task here only
// changes its date, keeping whatever time of day it already had (see
// PlannerApp.handleTaskDragEnd's "monthcol:" branch).
function DroppableMonthCell({
  dateKey,
  isToday,
  inMonth,
  dayNumber,
  tasks,
  busyBlocks,
  onSelectTask,
  onSelectBusyBlock,
}: {
  dateKey: string;
  isToday: boolean;
  inMonth: boolean;
  dayNumber: number;
  tasks: Task[];
  busyBlocks: BusyBlock[];
  onSelectTask?: (task: Task) => void;
  onSelectBusyBlock?: (block: BusyBlock) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `monthcol:${dateKey}`, data: { date: dateKey } });
  const visible = tasks.slice(0, MAX_VISIBLE);
  const overflow = tasks.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-24 flex-col gap-1 rounded-2xl p-2 ${
        isOver
          ? "border-2 border-coral bg-peach/40"
          : isToday
            ? "border-2 border-coral/50 bg-buttercup/50 shadow-sm"
            : inMonth
              ? "border border-[#EDE2D4]/40 bg-surface-low/40"
              : "border border-transparent bg-surface-low/20 opacity-40"
      }`}
    >
      {isToday ? (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-coral">Today</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">
            {dayNumber}
          </span>
        </div>
      ) : (
        <span className="text-xs font-bold text-foreground">{dayNumber}</span>
      )}
      <div className="flex flex-col gap-1">
        {busyBlocks.map((block, i) => (
          <BusyBlockChip key={`busy-${i}`} block={block} onClick={onSelectBusyBlock} />
        ))}
        {visible.map((task) => (
          <TaskChip key={task.id} task={task} draggableId={`cal:${task.id}`} onClick={onSelectTask} />
        ))}
        {overflow > 0 && <div className="text-[10px] font-semibold text-clay-light">+{overflow} more</div>}
      </div>
    </div>
  );
}

export function MonthView({
  anchorDate,
  tasksByDate,
  busyBlocksByDate,
  onSelectTask,
  onSelectBusyBlock,
}: {
  anchorDate: Date;
  tasksByDate: Map<string, Task[]>;
  busyBlocksByDate?: Map<string, BusyBlock[]>;
  onSelectTask?: (task: Task) => void;
  onSelectBusyBlock?: (block: BusyBlock) => void;
}) {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1.5 border-b border-[#EDE2D4]/70 pb-2 text-center sm:gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-xs font-bold uppercase tracking-wider text-clay">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const key = toISODate(day);
          return (
            <DroppableMonthCell
              key={key}
              dateKey={key}
              isToday={isSameDay(day, today)}
              inMonth={day.getMonth() === monthStart.getMonth()}
              dayNumber={day.getDate()}
              tasks={tasksByDate.get(key) ?? []}
              busyBlocks={busyBlocksByDate?.get(key) ?? []}
              onSelectTask={onSelectTask}
              onSelectBusyBlock={onSelectBusyBlock}
            />
          );
        })}
      </div>
    </div>
  );
}
