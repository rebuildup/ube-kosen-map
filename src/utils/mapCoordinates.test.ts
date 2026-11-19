import { describe, expect, it } from "vitest";

import type { MapBounds, ViewBox } from "../types/map";
import {
  calculateDistance,
  calculatePanConstraints,
  clamp,
  constrainViewBox,
  constrainZoom,
  createViewBox,
  getCenterFromViewBox,
  getZoomFromViewBox,
  getSVGContentRect,
  lerp,
  parseViewBox,
  screenToSVG,
  svgToScreen,
  validateCoordinate,
  viewBoxToString,
} from "./mapCoordinates";

const bounds: MapBounds = { height: 100, viewBox: "0 0 100 100", width: 100 };

describe("clamp", () => {
  it("clamps values into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("interpolates linearly", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(10, 0, 1)).toBe(0);
  });
});

describe("calculateDistance", () => {
  it("computes euclidean distance", () => {
    expect(calculateDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("viewBox helpers", () => {
  it("creates a viewBox centered on a point", () => {
    const vb = createViewBox(50, 50, 2, bounds);
    expect(vb).toEqual({ height: 50, width: 50, x: 25, y: 25 });
  });

  it("round-trips viewBoxToString / parseViewBox", () => {
    const vb: ViewBox = { height: 40, width: 60, x: 1.5, y: -2 };
    expect(parseViewBox(viewBoxToString(vb))).toEqual(vb);
    expect(parseViewBox("invalid")).toBeNull();
  });

  it("derives zoom and center", () => {
    const vb: ViewBox = { height: 25, width: 50, x: 10, y: 20 };
    expect(getZoomFromViewBox(vb, bounds)).toBe(2);
    expect(getCenterFromViewBox(vb)).toEqual({ x: 35, y: 32.5 });
  });
});

describe("pan constraints", () => {
  it("constrains viewBox within padded bounds", () => {
    const vb: ViewBox = { height: 50, width: 50, x: -100, y: 500 };
    const constraints = calculatePanConstraints(bounds, vb);
    const constrained = constrainViewBox(vb, constraints);
    expect(constrained.x).toBeGreaterThanOrEqual(constraints.left);
    expect(constrained.x).toBeLessThanOrEqual(constraints.right);
    expect(constrained.y).toBeGreaterThanOrEqual(constraints.top);
    expect(constrained.y).toBeLessThanOrEqual(constraints.bottom);
  });
});

describe("zoom helpers", () => {
  it("clamps zoom into range", () => {
    expect(constrainZoom(0.01, 0.5, 8)).toBe(0.5);
    expect(constrainZoom(99, 0.5, 8)).toBe(8);
    expect(constrainZoom(2, 0.5, 8)).toBe(2);
  });
});

describe("SVG content rect", () => {
  const viewBox: ViewBox = { height: 100, width: 50, x: 0, y: 0 };

  it("letterboxes when container is wider than content ratio", () => {
    const rect = getSVGContentRect(
      { height: 200, width: 400, x: 0, y: 0 } as DOMRect,
      viewBox,
    );
    // originalRatio = 0.5, svgRatio = 2 -> height-constrained
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(200);
    expect(rect.offsetX).toBe(150);
    expect(rect.offsetY).toBe(0);
  });
});

describe("screen <-> SVG transforms", () => {
  const viewBox: ViewBox = { height: 100, width: 100, x: 0, y: 0 };
  const contentRect = {
    height: 200,
    offsetX: 0,
    offsetY: 0,
    width: 200,
    x: 0,
    y: 0,
  };
  const svgRect = {
    bottom: 200,
    height: 200,
    left: 0,
    right: 200,
    top: 0,
    width: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  it("maps screen center to viewBox center", () => {
    expect(screenToSVG(100, 100, svgRect, viewBox, contentRect)).toEqual({
      x: 50,
      y: 50,
    });
  });

  it("round-trips svgToScreen", () => {
    const screen = svgToScreen(25, 75, svgRect, viewBox, contentRect);
    expect(
      screenToSVG(screen.x, screen.y, svgRect, viewBox, contentRect),
    ).toEqual({ x: 25, y: 75 });
  });
});

describe("validateCoordinate", () => {
  it("flags out-of-bounds and clamps", () => {
    const result = validateCoordinate({ x: -5, y: 150 }, bounds);
    expect(result.outOfBounds).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.clamped.x).toBeLessThan(0);
    expect(result.clamped.y).toBeGreaterThan(100);
  });

  it("rejects NaN", () => {
    const result = validateCoordinate({ x: Number.NaN, y: 0 }, bounds);
    expect(result.isValid).toBe(false);
  });
});
