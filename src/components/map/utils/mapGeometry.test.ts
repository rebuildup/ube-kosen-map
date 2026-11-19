import { describe, expect, it } from "vitest";

import { CAMPUS_MAP_BOUNDS } from "../../../data/mapBounds";
import { computeCardPosition } from "./cardPlacement";
import {
  clientToMapCoordinate,
  getSVGContentRect,
  clientToViewBoxCoordinate,
  viewBoxToScreenCoordinate,
} from "./coordinateTransform";
import { layoutPinLabels } from "./pinLabelLayout";
import {
  MAP_LAYER_TRANSFORM,
  ROTATED_MAP_BOUNDS,
  inverseTransformPinCoordinate,
  transformPinCoordinate,
} from "./pinTransform";
import {
  computeDragZoomViewBox,
  computePinchViewBox,
  computePointZoomViewBox,
  computeSpanLimits,
  zoomViewBoxAtPoint,
  zoomViewBoxCentered,
  type PinchZoomStart,
} from "./viewport";

const LIMITS = computeSpanLimits(
  { ...ROTATED_MAP_BOUNDS, marginX: 200, marginY: 200 },
  0.3,
  80,
);

const VB = { height: 400, width: 600, x: 100, y: 50 };

describe("pinTransform", () => {
  it("rotates map coordinates into the fixed 90° viewBox space", () => {
    // 90° rotation maps (x, y) -> (H - y, x) translated into positive space.
    const p = transformPinCoordinate(0, 0);
    expect(p.x).toBeCloseTo(CAMPUS_MAP_BOUNDS.height);
    expect(p.y).toBeCloseTo(0);
  });

  it("round-trips through the inverse transform", () => {
    const original = { x: 123.4, y: 456.7 };
    const rotated = transformPinCoordinate(original.x, original.y);
    const back = inverseTransformPinCoordinate(rotated.x, rotated.y);
    expect(back.x).toBeCloseTo(original.x);
    expect(back.y).toBeCloseTo(original.y);
  });

  it("applies pin scale/offset before rotation", () => {
    const scaled = transformPinCoordinate(10, 20, {
      offsetX: 1,
      offsetY: 2,
      scale: 2,
    });
    const manual = transformPinCoordinate(21, 42);
    expect(scaled.x).toBeCloseTo(manual.x);
    expect(scaled.y).toBeCloseTo(manual.y);
  });

  it("produces swapped bounds for the 90° rotation", () => {
    expect(ROTATED_MAP_BOUNDS.width).toBeCloseTo(CAMPUS_MAP_BOUNDS.height);
    expect(ROTATED_MAP_BOUNDS.height).toBeCloseTo(CAMPUS_MAP_BOUNDS.width);
    expect(MAP_LAYER_TRANSFORM).toContain("rotate(90)");
  });
});

describe("viewport zoom helpers", () => {
  it("zoomViewBoxCentered keeps the center fixed and clamps span", () => {
    const zoomed = zoomViewBoxCentered(VB, 0.5, LIMITS);
    expect(zoomed.width).toBeCloseTo(VB.width * 0.5);
    expect(zoomed.height).toBeCloseTo(VB.height * 0.5);
    expect(zoomed.x + zoomed.width / 2).toBeCloseTo(VB.x + VB.width / 2);
    expect(zoomed.y + zoomed.height / 2).toBeCloseTo(VB.y + VB.height / 2);
    // zoom out beyond maxSpan clamps to maxSpan
    const clamped = zoomViewBoxCentered(VB, 100, LIMITS);
    expect(clamped.width).toBe(LIMITS.maxSpan.width);
    expect(clamped.height).toBe(LIMITS.maxSpan.height);
  });

  it("zoomViewBoxAtPoint keeps the anchor stationary", () => {
    const anchor = { x: 200, y: 150 };
    const next = zoomViewBoxAtPoint(VB, anchor, 0.5, LIMITS);
    const ratio = next.width / VB.width;
    expect(next.x).toBeCloseTo(anchor.x - (anchor.x - VB.x) * ratio);
    expect(next.y).toBeCloseTo(anchor.y - (anchor.y - VB.y) * ratio);
  });

  it("computePinchViewBox scales from the gesture center fraction", () => {
    const start: PinchZoomStart = {
      centerFrac: { x: 0.5, y: 0.5 },
      centerViewBox: { x: 400, y: 250 },
      distance: 100,
      viewBox: VB,
    };
    const next = computePinchViewBox(start, 2, LIMITS);
    expect(next.width).toBeCloseTo(VB.width * 2);
    // center stays at its fractional position
    expect(next.x + next.width * 0.5).toBeCloseTo(400);
    expect(next.y + next.height * 0.5).toBeCloseTo(250);
  });

  it("computeDragZoomViewBox centers on the drag anchor", () => {
    const next = computeDragZoomViewBox(VB, { x: 300, y: 200 }, 0.5);
    expect(next.width).toBeCloseTo(VB.width * 0.5);
    expect(next.x + next.width / 2).toBeCloseTo(300);
    expect(next.y + next.height / 2).toBeCloseTo(200);
  });

  it("computePointZoomViewBox respects asymmetric pan padding", () => {
    const vb = computePointZoomViewBox({ x: 0, y: 0 }, 2, ROTATED_MAP_BOUNDS);
    // left/top padding is 30% of map size, right/bottom 10%
    const mapW = ROTATED_MAP_BOUNDS.width;
    const mapH = ROTATED_MAP_BOUNDS.height;
    expect(vb.x).toBeGreaterThanOrEqual(-mapW * 0.3 - 1e-9);
    expect(vb.y).toBeGreaterThanOrEqual(-mapH * 0.3 - 1e-9);
    expect(vb.x).toBeLessThanOrEqual(mapW * 0.1);
    // target span = bounds / zoomLevel
    expect(vb.width).toBeCloseTo(mapW / 2);
    expect(vb.height).toBeCloseTo(mapH / 2);
  });
});

describe("coordinateTransform", () => {
  const svgRect = { height: 400, left: 10, top: 20, width: 800 };
  const bounds = { height: 1000, width: 500 };

  it("clientToViewBoxCoordinate maps client coords into viewBox space", () => {
    // viewBox aspect 600:400 = 1.5; svg 800:400 = 2 → pillarboxed content.
    const viewBox = { height: 400, width: 600, x: 0, y: 0 };
    const content = getSVGContentRect(svgRect, viewBox, bounds);
    expect(content.width).toBeCloseTo(600);
    expect(content.offsetX).toBeCloseTo(100);
    // center of painted content -> center of viewBox
    const center = clientToViewBoxCoordinate(
      svgRect.left + content.offsetX + content.width / 2,
      svgRect.top + content.height / 2,
      viewBox,
      svgRect,
      bounds,
    );
    expect(center.x).toBeCloseTo(300);
    expect(center.y).toBeCloseTo(200);
  });

  it("viewBoxToScreenCoordinate round-trips with clientToViewBoxCoordinate", () => {
    const viewBox = VB;
    const client = { x: 300, y: 200 };
    const viewBoxPoint = clientToViewBoxCoordinate(
      client.x,
      client.y,
      viewBox,
      svgRect,
      bounds,
    );
    const back = viewBoxToScreenCoordinate(
      viewBoxPoint.x,
      viewBoxPoint.y,
      viewBox,
      svgRect,
      svgRect,
      bounds,
    );
    // container == svg rect position for this test
    expect(back?.x).toBeCloseTo(client.x - svgRect.left);
    expect(back?.y).toBeCloseTo(client.y - svgRect.top);
  });

  it("clientToMapCoordinate clamps far-outside clicks and rejects huge jumps", () => {
    const viewBox = { height: 1000, width: 500, x: 0, y: 0 };
    const rect = { height: 400, left: 0, top: 0, width: 400 };
    // inside -> returns a coordinate
    const inside = clientToMapCoordinate(200, 200, viewBox, rect, bounds);
    expect(inside).not.toBeNull();
    // absurdly far -> null (drag-release stray click guard)
    const far = clientToMapCoordinate(99999, 99999, viewBox, rect, bounds);
    expect(far).toBeNull();
  });
});

describe("computeCardPosition", () => {
  const containerRect = { height: 600, left: 0, top: 0, width: 800 };
  const viewBox = { height: 400, width: 600, x: 0, y: 0 };

  it("prefers a viable placement near the anchor", () => {
    const pos = computeCardPosition({
      anchor: { x: 300, y: 200 },
      containerRect,
      screenEvent: { clientX: 400, clientY: 300 },
      viewBox,
    });
    expect(["bottom", "left", "right", "top"]).toContain(pos.placement);
    expect(pos.x).toBeGreaterThan(0);
    expect(pos.y).toBeGreaterThan(0);
  });

  it("falls back to container center when nothing is viable", () => {
    const tiny = { height: 40, left: 0, top: 0, width: 40 };
    const pos = computeCardPosition({
      anchor: { x: 0, y: 0 },
      containerRect: tiny,
      screenEvent: { clientX: 20, clientY: 20 },
      viewBox,
    });
    expect(pos.x).toBeCloseTo(20);
    expect(pos.y).toBeCloseTo(20);
  });
});

describe("layoutPinLabels", () => {
  const viewport = { height: 400, width: 800 };

  it("assigns non-overlapping directions for spread-out pins", () => {
    const items = [
      { labelText: "A", screenPosition: { x: 100, y: 100 } },
      { labelText: "B", screenPosition: { x: 700, y: 300 } },
    ];
    const result = layoutPinLabels(items, viewport, 600);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.showLabel)).toBe(true);
    // left-side pin defaults to right label; right-side pin to left
    expect(result[0].direction).toBe("right");
    expect(result[1].direction).toBe("left");
  });

  it("hides labels that cannot be placed without overlap", () => {
    // Identical pins at the same spot: only the left and right slots exist,
    // so at most two labels can be shown; the rest must be hidden.
    const items = Array.from({ length: 5 }, () => ({
      labelText: "同じ場所",
      screenPosition: { x: 400, y: 200 },
    }));
    const result = layoutPinLabels(items, viewport, 600);
    const shown = result.filter((r) => r.showLabel);
    expect(shown.length).toBe(2);
  });
});
