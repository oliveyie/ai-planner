// Lays out a day's events on a time axis (WeekView's hour grid): each event
// gets a vertical position/height from its actual start/end time, and
// overlapping events are split into side-by-side columns via simple greedy
// interval coloring (first column whose last event has already ended) —
// a good-enough approximation of how real calendar apps split clashing
// events, without needing full per-cluster width negotiation.
export type PositionedEntry<T> = {
  entry: T;
  top: number; // px, relative to the grid's range start
  height: number; // px
  leftPercent: number;
  widthPercent: number;
};

const MIN_BLOCK_MINUTES = 20; // a 5-minute event would otherwise be nearly invisible

export function layoutDayColumn<T>(
  entries: T[],
  getStart: (entry: T) => Date,
  getEnd: (entry: T) => Date,
  pxPerMinute: number,
  rangeStartMinutes: number,
): PositionedEntry<T>[] {
  const sorted = [...entries].sort((a, b) => getStart(a).getTime() - getStart(b).getTime());

  const columnEndTimes: number[] = [];
  const columnIndexByEntry = new Map<T, number>();

  for (const entry of sorted) {
    const startMs = getStart(entry).getTime();
    const endMs = getEnd(entry).getTime();
    const columnIndex = columnEndTimes.findIndex((endTime) => endTime <= startMs);

    if (columnIndex === -1) {
      columnEndTimes.push(endMs);
      columnIndexByEntry.set(entry, columnEndTimes.length - 1);
    } else {
      columnEndTimes[columnIndex] = endMs;
      columnIndexByEntry.set(entry, columnIndex);
    }
  }

  const totalColumns = Math.max(1, columnEndTimes.length);

  return sorted.map((entry) => {
    const start = getStart(entry);
    const end = getEnd(entry);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const durationMinutes = Math.max(MIN_BLOCK_MINUTES, (end.getTime() - start.getTime()) / 60_000);
    const columnIndex = columnIndexByEntry.get(entry) ?? 0;

    return {
      entry,
      top: (startMinutes - rangeStartMinutes) * pxPerMinute,
      height: durationMinutes * pxPerMinute,
      leftPercent: (columnIndex / totalColumns) * 100,
      widthPercent: (1 / totalColumns) * 100,
    };
  });
}
