import { describe, expect, it } from "vitest";

import { calculatePanViewBox } from "./dragPan";
import { addTouchPointer, removeTouchPointer } from "./pointerGesture";
import { clusterPointsOnScreen } from "./screenClustering";
import { shouldEmitTouchMapClick } from "./touchMapClick";
import { shouldIgnoreTouchTarget } from "./touchTargetGuard";

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
