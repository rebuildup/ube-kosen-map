import { describe, expect, it } from "vitest";

import { calculatePanViewBox } from "./dragPan";
import { addTouchPointer, removeTouchPointer } from "./pointerGesture";
import { clusterPointsOnScreen } from "./screenClustering";
import { shouldEmitTouchMapClick } from "./touchMapClick";
import { shouldIgnoreTouchTarget } from "./touchTargetGuard";
import {
  clamp,
  computeCenteredViewBox,
  computeFittedViewBox,
  floorIdToZ,
  niceInterval,
  normalizePointCoordinate,
  resolveInitialViewBox,
} from "./viewport";

const BOUNDS = { height: 1000, width: 500 };

const makePoint = (id: string, x: number, y: number) => ({
  coordinates: { x, y },
  id,
});

describe("clusterPointsOnScreen", () => {
  const identityScreen = (p: { coordinates: { x: number; y: number } }) => ({
    x: p.coordinates.x,
    y: p.coordinates.y,
  });
  const threshold = () => 50;

  it("groups nearby points and reports a centroid in map coordinates", () => {
    const points = [
      makePoint("a", 0, 0),
      makePoint("b", 10, 0),
      makePoint("c", 0, 10),
      makePoint("far", 1000, 1000),
    ];
    const clusters = clusterPointsOnScreen(points, identityScreen, threshold);
    expect(clusters).toHaveLength(2);
    const grouped = clusters.find((c) => c.count === 3);
    expect(grouped?.coordinates).toEqual({ x: 10 / 3, y: 10 / 3 });
    expect(grouped?.points.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
    expect(clusters.find((c) => c.count === 1)?.points[0].id).toBe("far");
  });

  it("keeps distant points as singleton clusters", () => {
    const points = [makePoint("a", 0, 0), makePoint("far", 1000, 1000)];
    const clusters = clusterPointsOnScreen(points, identityScreen, threshold);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  it("clusters in screen space, not map space", () => {
    // Two points far apart in map coords but adjacent on screen must cluster.
    const points = [makePoint("a", 0, 0), makePoint("b", 10000, 0)];
    const flatScreen = () => ({ x: 0, y: 0 });
    const clusters = clusterPointsOnScreen(points, flatScreen, threshold);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
    // centroid is still expressed in map coordinates
    expect(clusters[0].coordinates.x).toBe(5000);
  });

  it("respects per-point thresholds via pairwise max", () => {
    const points = [makePoint("near", 0, 0), makePoint("far", 80, 0)];
    const tight = clusterPointsOnScreen(points, identityScreen, () => 50);
    expect(tight).toHaveLength(2);
    const loose = clusterPointsOnScreen(points, identityScreen, (p) =>
      p.id === "far" ? 100 : 50,
    );
    expect(loose).toHaveLength(1);
  });

  it("excludes configured ids", () => {
    const points = [makePoint("a", 0, 0), makePoint("skip", 5, 0)];
    const clusters = clusterPointsOnScreen(
      points,
      identityScreen,
      threshold,
      new Set(["skip"]),
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].points.map((p) => p.id)).toEqual(["a"]);
  });

  it("returns an empty list for empty input", () => {
    expect(clusterPointsOnScreen([], identityScreen, threshold)).toEqual([]);
  });
});

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

  it("parses floor ids to z levels", () => {
    expect(floorIdToZ(null)).toBeNull();
    expect(floorIdToZ("")).toBeNull();
    expect(floorIdToZ("3F")).toBe(3);
    expect(floorIdToZ("10F-east")).toBe(10);
    expect(floorIdToZ("basement")).toBeNull();
  });

  it("normalizes anchor-area points to their center", () => {
    const point = {
      coordinates: { x: 1, y: 2 },
      anchorArea: { height: 20, width: 10, x: 100, y: 200, z: 4 },
      id: "a",
      title: "a",
      type: "toilet" as const,
    };
    expect(normalizePointCoordinate(point)).toEqual({
      x: 105,
      y: 210,
      z: 4,
    });
    const noArea = { ...point };
    delete (noArea as { anchorArea?: unknown }).anchorArea;
    expect(normalizePointCoordinate(noArea)).toEqual({ x: 1, y: 2 });
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

describe("calculatePanViewBox", () => {
  it("pans opposite to pointer delta scaled by viewBox/content ratio", () => {
    const result = calculatePanViewBox({
      contentRect: { height: 200, width: 200 },
      currentClient: { x: 30, y: 10 },
      startClient: { x: 10, y: 10 },
      startViewBox: { height: 100, width: 100, x: 0, y: 0 },
    });
    expect(result.x).toBe(-10);
    expect(result.y).toBe(0);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });
});

describe("pointer gesture helpers", () => {
  it("adds up to two unique pointers", () => {
    expect(addTouchPointer([], 1)).toEqual([1]);
    expect(addTouchPointer([1], 2)).toEqual([1, 2]);
    expect(addTouchPointer([1, 2], 3)).toEqual([1, 2]);
    expect(addTouchPointer([1, 2], 1)).toEqual([1, 2]);
  });

  it("removes pointers idempotently", () => {
    expect(removeTouchPointer([1, 2], 1)).toEqual([2]);
    expect(removeTouchPointer([1], 9)).toEqual([1]);
  });
});

describe("touch helpers", () => {
  it("emits map click only when handler exists", () => {
    const noop = () => {};
    expect(shouldEmitTouchMapClick("display", noop)).toBe(true);
    expect(shouldEmitTouchMapClick("display", undefined)).toBe(false);
    expect(shouldEmitTouchMapClick("interactive", undefined)).toBe(false);
  });

  it("ignores touches on UI controls unless dragging", () => {
    const base = {
      isDragging: false,
      isGesture: false,
      isOnCardOverlay: false,
      isOnUiControl: true,
    };
    expect(shouldIgnoreTouchTarget(base)).toBe(true);
    expect(shouldIgnoreTouchTarget({ ...base, isDragging: true })).toBe(false);
    expect(shouldIgnoreTouchTarget({ ...base, isOnUiControl: false })).toBe(
      false,
    );
  });
});
