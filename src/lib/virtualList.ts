// Windowed (virtualized) list math — pure, dependency-free.
//
// The conversation list renders only the rows inside the viewport plus a small
// overscan, with spacer elements standing in for everything above and below.
// Rows are fixed-height (one height per density, see styles.css `.row`), which
// keeps the math exact: a 50,000-thread mailbox costs the same ~40 DOM rows as
// a 50-thread one. The React side (ThreadList in App.tsx) feeds scroll
// position + viewport height in; everything here is unit-tested.

export interface VirtualWindow {
  start: number; // first rendered row index (inclusive)
  end: number; // last rendered row index (exclusive)
  topPad: number; // px of spacer above the rendered slice
  bottomPad: number; // px of spacer below the rendered slice
}

// Row heights per density — keep in sync with `.row { height: … }` in
// styles.css (default) and the `[data-density="compact"]` override.
export const ROW_HEIGHT = 44;
export const ROW_HEIGHT_COMPACT = 34;

export function rowHeightFor(density: string | undefined): number {
  return density === "compact" ? ROW_HEIGHT_COMPACT : ROW_HEIGHT;
}

export function virtualWindow(
  count: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 10
): VirtualWindow {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };
  // Clamp to the last row: after a view switch the remembered scrollTop can
  // briefly exceed the new (shorter) content until the browser fires the
  // corrective scroll event — never render an empty window for that frame.
  const first = Math.min(Math.floor(Math.max(0, scrollTop) / rowHeight), count - 1);
  const visible = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1;
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return {
    start,
    end,
    topPad: start * rowHeight,
    bottomPad: Math.max(0, (count - end) * rowHeight),
  };
}

// Scroll-follow for keyboard navigation: the scrollTop that brings row `index`
// fully into view, or null when it is already visible (so the caller never
// scrolls — and never re-renders — needlessly). Mirrors `scrollIntoView({
// block: "nearest" })` semantics, but works with windowed rows that may not be
// in the DOM yet.
export function followScrollTop(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number
): number | null {
  if (index < 0 || rowHeight <= 0) return null;
  const rowTop = index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowTop < scrollTop) return rowTop;
  if (rowBottom > scrollTop + viewportHeight) return Math.max(0, rowBottom - viewportHeight);
  return null;
}
