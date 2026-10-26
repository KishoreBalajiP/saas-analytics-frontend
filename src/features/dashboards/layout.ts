import type { Widget } from "@/lib/api/types";

/** Dashboard grid: 12 columns; a widget's `position` is { x, y, w, h } in grid units. */
export const GRID_COLUMNS = 12;

export type WidgetPosition = { x: number; y: number; w: number; h: number };

export const WIDTH_OPTIONS = [
  { value: 4, label: "One third" },
  { value: 6, label: "Half" },
  { value: 8, label: "Two thirds" },
  { value: 12, label: "Full width" },
] as const;

// Static class names so Tailwind generates every span (md and up; phones stack).
const SPAN_CLASSES = [
  "md:col-span-1",
  "md:col-span-2",
  "md:col-span-3",
  "md:col-span-4",
  "md:col-span-5",
  "md:col-span-6",
  "md:col-span-7",
  "md:col-span-8",
  "md:col-span-9",
  "md:col-span-10",
  "md:col-span-11",
  "md:col-span-12",
];

const clampWidth = (w: unknown) =>
  Math.min(GRID_COLUMNS, Math.max(1, Math.round(Number(w) || GRID_COLUMNS / 2)));

export function columnSpanClass(position?: Partial<WidgetPosition> | null) {
  return SPAN_CLASSES[clampWidth(position?.w) - 1]!;
}

/**
 * Reading order: top to bottom, then left to right (ties keep list order).
 * Rendering in this order with column spans never overlaps widgets, even
 * ones saved on top of each other before positions were auto-assigned.
 */
export function orderWidgets<T extends Pick<Widget, "position">>(widgets: T[]): T[] {
  return widgets
    .map((widget, index) => ({ widget, index }))
    .sort(
      (a, b) =>
        (a.widget.position?.y ?? 0) - (b.widget.position?.y ?? 0) ||
        (a.widget.position?.x ?? 0) - (b.widget.position?.x ?? 0) ||
        a.index - b.index,
    )
    .map((entry) => entry.widget);
}

/**
 * Lay widgets out left to right in the given order, wrapping when a row is
 * full. Returns the position each widget should have.
 */
export function reflow(widgets: Array<{ _id: string; position?: Partial<WidgetPosition> | null }>) {
  const out = new Map<string, WidgetPosition>();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const widget of widgets) {
    const w = clampWidth(widget.position?.w);
    const h = Math.max(1, Math.round(Number(widget.position?.h) || 4));
    if (x + w > GRID_COLUMNS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    out.set(widget._id, { x, y, w, h });
    x += w;
    rowHeight = Math.max(rowHeight, h);
  }
  return out;
}

/** Positions that differ from what is saved (only those need saving). */
export function changedPositions(
  widgets: Array<{ _id: string; position?: Partial<WidgetPosition> | null }>,
  next: Map<string, WidgetPosition>,
) {
  return widgets.flatMap((widget) => {
    const target = next.get(widget._id);
    if (!target) return [];
    const p = widget.position ?? {};
    const same = p.x === target.x && p.y === target.y && p.w === target.w && p.h === target.h;
    return same ? [] : [{ id: widget._id, position: target }];
  });
}

/** New layout after moving one widget a step earlier (-1) or later (+1). */
export function moveWidget<T extends { _id: string; position?: Partial<WidgetPosition> | null }>(
  ordered: T[],
  id: string,
  step: -1 | 1,
) {
  const index = ordered.findIndex((w) => w._id === id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= ordered.length) return reflow(ordered);
  const next = [...ordered];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return reflow(next);
}

/** New layout after changing one widget's width. */
export function resizeWidget<T extends { _id: string; position?: Partial<WidgetPosition> | null }>(
  ordered: T[],
  id: string,
  width: number,
) {
  return reflow(
    ordered.map((w) =>
      w._id === id ? { ...w, position: { ...(w.position ?? {}), w: clampWidth(width) } } : w,
    ),
  );
}
