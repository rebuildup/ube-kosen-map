import { describe, expect, it } from "vitest";

import type { InteractivePoint } from "../../../types/map";
import {
  adaptiveCluster,
  clusterPoints,
  dbscanCluster,
  findClusterForPoint,
  getClusterBounds,
  getClusterTypes,
  isPointInCluster,
} from "./clustering";
import { calculatePanViewBox } from "./dragPan";
import { addTouchPointer, removeTouchPointer } from "./pointerGesture";
import {
  disableSvgChildHitTesting,
  enableSvgChildHitTesting,
  getDragHitTestingClassName,
} from "./svgHitTesting";
import { shouldEmitTouchMapClick } from "./touchMapClick";
import { shouldIgnoreTouchTarget } from "./touchTargetGuard";

const makePoint = (
  id: string,
  x: number,
  y: number,
  type: InteractivePoint["type"] = "toilet",
): InteractivePoint => ({
  coordinates: { x, y },
  id,
  title: id,
  type,
});

describe("clusterPoints", () => {
  it("returns all points as singles when clustering is disabled", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 1, 1)];
    const result = clusterPoints(points, { enabled: false });
    expect(result.clusters).toHaveLength(0);
    expect(result.singles).toHaveLength(2);
  });

  it("groups nearby points into a cluster", () => {
    const points = [
      makePoint("a", 0, 0),
      makePoint("b", 10, 0),
      makePoint("c", 0, 10),
      makePoint("far", 1000, 1000),
    ];
    const result = clusterPoints(points, { minPoints: 2, radius: 50 });
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].count).toBe(3);
    expect(result.clusters[0].points.map((p) => p.id).sort()).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.singles.map((p) => p.id)).toEqual(["far"]);
  });

  it("computes cluster centroid", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 10, 20)];
    const result = clusterPoints(points, { minPoints: 2, radius: 100 });
    expect(result.clusters[0].coordinates).toEqual({ x: 5, y: 10 });
  });
});

describe("dbscanCluster", () => {
  it("does not cluster points below density threshold", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 10, 0)];
    const result = dbscanCluster(points, { minPoints: 3, radius: 50 });
    expect(result.clusters).toHaveLength(0);
    expect(result.singles).toHaveLength(2);
  });

  it("clusters density-connected points", () => {
    const points = [
      makePoint("a", 0, 0),
      makePoint("b", 10, 0),
      makePoint("c", 20, 0),
      makePoint("far", 1000, 1000),
    ];
    const result = dbscanCluster(points, { minPoints: 2, radius: 15 });
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].count).toBe(3);
    expect(result.singles.map((p) => p.id)).toEqual(["far"]);
  });
});

describe("adaptiveCluster", () => {
  it("shrinks radius at higher zoom", () => {
    const points = [
      makePoint("a", 0, 0),
      makePoint("b", 60, 0),
      makePoint("c", 120, 0),
    ];
    const zoomedOut = adaptiveCluster(points, 1, { minPoints: 2, radius: 100 });
    const zoomedIn = adaptiveCluster(points, 4, { minPoints: 2, radius: 100 });
    expect(
      zoomedOut.clusters.length + zoomedIn.clusters.length,
    ).toBeGreaterThan(0);
    expect(zoomedIn.clusters[0]?.count ?? 0).toBeLessThanOrEqual(
      zoomedOut.clusters[0]?.count ?? 0,
    );
  });

  it("falls back to zoom 1 for invalid zoom", () => {
    const result = adaptiveCluster([makePoint("a", 0, 0)], Number.NaN);
    expect(result.singles).toHaveLength(1);
  });
});

describe("cluster utilities", () => {
  const cluster = {
    coordinates: { x: 0, y: 0 },
    count: 2,
    id: "cluster-a-b",
    points: [makePoint("a", 0, 0), makePoint("b", 10, 10, "trash")],
  };

  it("finds cluster membership", () => {
    expect(isPointInCluster(cluster.points[0], cluster)).toBe(true);
    expect(isPointInCluster(makePoint("z", 0, 0), cluster)).toBe(false);
    expect(findClusterForPoint(cluster.points[1], [cluster])?.id).toBe(
      "cluster-a-b",
    );
    expect(findClusterForPoint(makePoint("z", 0, 0), [cluster])).toBeNull();
  });

  it("reports types and bounds", () => {
    expect(getClusterTypes(cluster).sort()).toEqual(["toilet", "trash"]);
    expect(getClusterBounds(cluster)).toEqual({
      height: 10,
      maxX: 10,
      maxY: 10,
      minX: 0,
      minY: 0,
      width: 10,
    });
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

describe("svg hit testing helpers", () => {
  it("toggles the drag hit-testing class", () => {
    const classes = new Set<string>();
    const svg = {
      classList: {
        add: (c: string) => classes.add(c),
        contains: (c: string) => classes.has(c),
        remove: (c: string) => classes.delete(c),
      },
    } as unknown as SVGSVGElement;
    const cls = getDragHitTestingClassName();
    disableSvgChildHitTesting(svg);
    expect(svg.classList.contains(cls)).toBe(true);
    enableSvgChildHitTesting(svg);
    expect(svg.classList.contains(cls)).toBe(false);
    // null-safe
    disableSvgChildHitTesting(null);
    enableSvgChildHitTesting(undefined);
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
