import { describe, expect, it } from "vitest";

import {
  clamp,
  computeCenteredViewBox,
  computeFittedViewBox,
  effectivePointCoordinate,
  floorNumberFromId,
  niceInterval,
  resolveInitialViewBox,
} from "./viewport";

const BOUNDS = { height: 1000, width: 500 };

describe("viewport helpers", () => {
  it("clamps values into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("rounds grid intervals to nice numbers", () => {
    expect(niceInterval(0.04)).toBe(0.05);
    expect(niceInterval(0.17)).toBe(0.2);
    expect(niceInterval(0.4)).toBe(0.5);
    expect(niceInterval(1.2)).toBe(1);
    expect(niceInterval(4)).toBe(5);
    expect(niceInterval(9)).toBe(10);
  });

  it("parses floor ids to floor numbers", () => {
    expect(floorNumberFromId(null)).toBeNull();
    expect(floorNumberFromId("")).toBeNull();
    expect(floorNumberFromId("3F")).toBe(3);
    expect(floorNumberFromId("10F-east")).toBe(10);
    expect(floorNumberFromId("basement")).toBeNull();
  });

  it("normalizes anchor-area points to their center", () => {
    const point = {
      coordinates: { x: 1, y: 2 },
      anchorArea: { height: 20, width: 10, x: 100, y: 200, z: 4 },
      id: "a",
      title: "a",
      type: "toilet" as const,
    };
    expect(effectivePointCoordinate(point)).toEqual({
      x: 105,
      y: 210,
      z: 4,
    });
    const noArea = { ...point };
    delete (noArea as { anchorArea?: unknown }).anchorArea;
    expect(effectivePointCoordinate(noArea)).toEqual({ x: 1, y: 2 });
  });

  it("computes a fitted viewBox centered on points within pan limits", () => {
    const points = [
      {
        coordinates: { x: 100, y: 100 },
        id: "a",
        title: "a",
        type: "toilet" as const,
      },
      {
        coordinates: { x: 300, y: 300 },
        id: "b",
        title: "b",
        type: "trash" as const,
      },
    ];
    const vb = computeFittedViewBox(points, 1, BOUNDS);
    // zoom 1 → viewBox covers full map; center biased toward points but clamped
    expect(vb.width).toBe(500);
    expect(vb.height).toBe(1000);
    expect(vb.x).toBeGreaterThanOrEqual(-100);
    expect(vb.y).toBeGreaterThanOrEqual(-200);
  });

  it("computes a centered viewBox honoring zoom and clamping", () => {
    const vb = computeCenteredViewBox({ x: 250, y: 500 }, 2, BOUNDS);
    expect(vb.width).toBe(250);
    expect(vb.height).toBe(500);
    // center (250,500) → x = 250-125 = 125, y = 500-250 = 250
    expect(vb.x).toBeCloseTo(125);
    expect(vb.y).toBeCloseTo(250);
    // zoomed-in view near edge is clamped inside padded bounds
    const edge = computeCenteredViewBox({ x: 0, y: 0 }, 4, BOUNDS);
    expect(edge.x).toBeGreaterThanOrEqual(-100);
    expect(edge.y).toBeGreaterThanOrEqual(-200);
  });

  it("resolves initial viewBox by mode, center, and points", () => {
    const center = { x: 10, y: 20 };
    const withCenter = resolveInitialViewBox([], "display", 1, BOUNDS, center);
    const plain = resolveInitialViewBox([], "display", 1, BOUNDS);
    const interactive = resolveInitialViewBox(
      [
        {
          coordinates: { x: 400, y: 900 },
          id: "a",
          title: "a",
          type: "toilet" as const,
        },
      ],
      "interactive",
      1,
      BOUNDS,
    );
    expect(withCenter).not.toEqual(plain);
    // interactive mode ignores points and centers the whole map
    expect(interactive).toEqual(plain);
  });
});
