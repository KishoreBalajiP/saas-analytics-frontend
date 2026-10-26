import { describe, expect, it } from "vitest";

import {
  changedPositions,
  columnSpanClass,
  moveWidget,
  orderWidgets,
  reflow,
  resizeWidget,
} from "./layout";

const w = (id: string, x: number, y: number, width = 6, h = 4) => ({
  _id: id,
  position: { x, y, w: width, h },
});

describe("dashboard layout", () => {
  it("orders widgets top-to-bottom then left-to-right, keeping list order for overlaps", () => {
    const ordered = orderWidgets([w("c", 0, 4), w("b", 6, 0), w("a", 0, 0), w("a2", 0, 0)]);
    expect(ordered.map((x) => x._id)).toEqual(["a", "a2", "b", "c"]);
  });

  it("reflows into rows of 12 columns without overlap", () => {
    const next = reflow([w("a", 0, 0), w("b", 0, 0), w("c", 0, 0, 12, 5)]);
    expect(next.get("a")).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(next.get("b")).toEqual({ x: 6, y: 0, w: 6, h: 4 });
    expect(next.get("c")).toEqual({ x: 0, y: 4, w: 12, h: 5 });
  });

  it("moves and resizes, reporting only changed positions", () => {
    const widgets = [w("a", 0, 0), w("b", 6, 0)];
    const moved = moveWidget(widgets, "b", -1);
    expect(moved.get("b")).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(
      changedPositions(widgets, moved)
        .map((c) => c.id)
        .sort(),
    ).toEqual(["a", "b"]);
    const resized = resizeWidget(widgets, "a", 12);
    expect(resized.get("a")).toEqual({ x: 0, y: 0, w: 12, h: 4 });
    expect(resized.get("b")).toEqual({ x: 0, y: 4, w: 6, h: 4 });
    expect(changedPositions(widgets, reflow(widgets))).toEqual([]);
  });

  it("maps widths to static column-span classes", () => {
    expect(columnSpanClass({ w: 4 })).toBe("md:col-span-4");
    expect(columnSpanClass({ w: 40 })).toBe("md:col-span-12");
    expect(columnSpanClass(null)).toBe("md:col-span-6");
  });
});
