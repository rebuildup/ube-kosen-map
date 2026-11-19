import { describe, expect, it } from "vitest";

import { CAMPUS_MAP_BOUNDS } from "../../../data/buildings";
import type { BuildingFloorConfig } from "../../../data/floorConfig";
import type { ViewBox } from "../../../types/map";
import {
  clientToMapCoordinate,
  clientToViewBoxCoordinate,
  getSVGContentRect,
  viewBoxToScreenCoordinate,
  type MeasuredRect,
} from "./coordinateTransform";
import {
  resolveDetectedFloorId,
  resolveFocusedFloorId,
} from "./floorSelection";
import {
  inverseTransformPinCoordinate,
  transformPinCoordinate,
} from "./pinTransform";
import {
  computePinchViewBox,
  computePointZoomViewBox,
  zoomViewBoxAtPoint,
  zoomViewBoxCentered,
  type PinchZoomStart,
  type ViewBoxSpanLimits,
} from "./viewport";

/** Deterministic PRNG so failures reproduce. */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rand = mulberry32(0x5eed);
const randRange = (min: number, max: number) => min + rand() * (max - min);

const GENEROUS_LIMITS: ViewBoxSpanLimits = {
  maxSpan: { height: 1e9, width: 1e9 },
  minSpan: { height: 1e-6, width: 1e-6 },
};

const randomViewBox = (): ViewBox => ({
  height: randRange(10, 2000),
  width: randRange(10, 2000),
  x: randRange(-2000, 2000),
  y: randRange(-2000, 2000),
});

describe("transform properties", () => {
  it("pin transform round-trips over the whole map extent", () => {
    for (let i = 0; i < 500; i += 1) {
      const x = randRange(0, CAMPUS_MAP_BOUNDS.width);
      const y = randRange(0, CAMPUS_MAP_BOUNDS.height);
      const rotated = transformPinCoordinate(x, y);
      const back = inverseTransformPinCoordinate(rotated.x, rotated.y);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it("pin transform keeps rotated coordinates inside positive space", () => {
    for (let i = 0; i < 200; i += 1) {
      const rotated = transformPinCoordinate(
        randRange(0, CAMPUS_MAP_BOUNDS.width),
        randRange(0, CAMPUS_MAP_BOUNDS.height),
      );
      expect(rotated.x).toBeGreaterThanOrEqual(0);
      expect(rotated.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("zoomViewBoxAtPoint preserves the anchor fraction when unclamped", () => {
    for (let i = 0; i < 200; i += 1) {
      const vb = randomViewBox();
      const anchor = {
        x: vb.x + vb.width * randRange(0.1, 0.9),
        y: vb.y + vb.height * randRange(0.1, 0.9),
      };
      const next = zoomViewBoxAtPoint(vb, anchor, randRange(0.6, 1.6), GENEROUS_LIMITS);
      const fracBeforeX = (anchor.x - vb.x) / vb.width;
      const fracAfterX = (anchor.x - next.x) / next.width;
      const fracBeforeY = (anchor.y - vb.y) / vb.height;
      const fracAfterY = (anchor.y - next.y) / next.height;
      expect(fracAfterX).toBeCloseTo(fracBeforeX, 6);
      expect(fracAfterY).toBeCloseTo(fracBeforeY, 6);
    }
  });

  it("zoom helpers never exceed span limits", () => {
    const limits: ViewBoxSpanLimits = {
      maxSpan: { height: 5000, width: 5000 },
      minSpan: { height: 50, width: 50 },
    };
    for (let i = 0; i < 200; i += 1) {
      const vb = randomViewBox();
      for (const factor of [0.01, 0.5, 1, 2, 100]) {
        const zoomed = zoomViewBoxAtPoint(
          vb,
          { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 },
          factor,
          limits,
        );
        expect(zoomed.width).toBeGreaterThanOrEqual(limits.minSpan.width);
        expect(zoomed.width).toBeLessThanOrEqual(limits.maxSpan.width);
        expect(zoomed.height).toBeGreaterThanOrEqual(limits.minSpan.height);
        expect(zoomed.height).toBeLessThanOrEqual(limits.maxSpan.height);

        const centered = zoomViewBoxCentered(vb, factor, limits);
        expect(centered.width).toBeGreaterThanOrEqual(limits.minSpan.width);
        expect(centered.width).toBeLessThanOrEqual(limits.maxSpan.width);
        expect(centered.height).toBeGreaterThanOrEqual(limits.minSpan.height);
        expect(centered.height).toBeLessThanOrEqual(limits.maxSpan.height);
      }
    }
  });

  it("zoomViewBoxCentered preserves the center when unclamped", () => {
    for (let i = 0; i < 200; i += 1) {
      const vb = randomViewBox();
      const next = zoomViewBoxCentered(vb, randRange(0.6, 1.6), GENEROUS_LIMITS);
      expect(next.x + next.width / 2).toBeCloseTo(vb.x + vb.width / 2, 6);
      expect(next.y + next.height / 2).toBeCloseTo(vb.y + vb.height / 2, 6);
    }
  });

  it("computePinchViewBox keeps the gesture center at its viewBox fraction", () => {
    for (let i = 0; i < 200; i += 1) {
      const startViewBox = randomViewBox();
      const centerFrac = { x: randRange(0.1, 0.9), y: randRange(0.1, 0.9) };
      const start: PinchZoomStart = {
        centerFrac,
        centerViewBox: {
          x: startViewBox.x + centerFrac.x * startViewBox.width,
          y: startViewBox.y + centerFrac.y * startViewBox.height,
        },
        distance: randRange(20, 200),
        viewBox: startViewBox,
      };
      const next = computePinchViewBox(
        start,
        randRange(0.6, 1.6),
        GENEROUS_LIMITS,
      );
      expect((start.centerViewBox.x - next.x) / next.width).toBeCloseTo(
        centerFrac.x,
        6,
      );
      expect((start.centerViewBox.y - next.y) / next.height).toBeCloseTo(
        centerFrac.y,
        6,
      );
    }
  });

  it("computePointZoomViewBox keeps the target inside padded bounds", () => {
    const bounds = CAMPUS_MAP_BOUNDS;
    for (let i = 0; i < 200; i += 1) {
      const point = {
        x: randRange(-500, bounds.width + 500),
        y: randRange(-500, bounds.height + 500),
      };
      // zoomLevel >= 1 keeps the target span smaller than the padded map
      // extent, so the min/max clamp bounds stay ordered.
      const zoomLevel = randRange(1, 10);
      const vb = computePointZoomViewBox(point, zoomLevel, bounds);
      const padL = bounds.width * 0.3;
      const padR = bounds.width * 0.1;
      const padT = bounds.height * 0.3;
      const padB = bounds.height * 0.1;
      expect(vb.x).toBeGreaterThanOrEqual(-padL - 1e-6);
      expect(vb.x).toBeLessThanOrEqual(
        bounds.width + padR - vb.width + 1e-6,
      );
      expect(vb.y).toBeGreaterThanOrEqual(-padT - 1e-6);
      expect(vb.y).toBeLessThanOrEqual(
        bounds.height + padB - vb.height + 1e-6,
      );
    }
  });
});

describe("screen/viewBox transform properties", () => {
  const bounds = CAMPUS_MAP_BOUNDS;

  const randomSetup = () => {
    const viewBox = randomViewBox();
    const svgRect: MeasuredRect = {
      height: randRange(300, 1200),
      left: randRange(-50, 50),
      top: randRange(-50, 50),
      width: randRange(300, 1200),
    };
    return { svgRect, viewBox };
  };

  it("viewBox->screen->viewBox round-trips inside the painted content", () => {
    for (let i = 0; i < 300; i += 1) {
      const { svgRect, viewBox } = randomSetup();
      const fx = randRange(0.05, 0.95);
      const fy = randRange(0.05, 0.95);
      const vbPoint = {
        x: viewBox.x + fx * viewBox.width,
        y: viewBox.y + fy * viewBox.height,
      };
      const screen = viewBoxToScreenCoordinate(
        vbPoint.x,
        vbPoint.y,
        viewBox,
        svgRect,
        svgRect,
        bounds,
      );
      expect(screen).not.toBeNull();
      if (!screen) continue;
      // screen is container-relative; container == svg rect here, so client
      // coords equal screen coords + svgRect origin.
      const clientX = screen.x + svgRect.left;
      const clientY = screen.y + svgRect.top;
      const back = clientToViewBoxCoordinate(
        clientX,
        clientY,
        viewBox,
        svgRect,
        bounds,
      );
      expect(back.x).toBeCloseTo(vbPoint.x, 4);
      expect(back.y).toBeCloseTo(vbPoint.y, 4);
    }
  });

  it("getSVGContentRect always fits inside the SVG element", () => {
    for (let i = 0; i < 300; i += 1) {
      const { svgRect, viewBox } = randomSetup();
      const content = getSVGContentRect(svgRect, viewBox, bounds);
      expect(content.offsetX).toBeGreaterThanOrEqual(-1e-9);
      expect(content.offsetY).toBeGreaterThanOrEqual(-1e-9);
      expect(content.width).toBeLessThanOrEqual(svgRect.width + 1e-9);
      expect(content.height).toBeLessThanOrEqual(svgRect.height + 1e-9);
      expect(content.offsetX + content.width).toBeLessThanOrEqual(
        svgRect.width + 1e-6,
      );
      expect(content.offsetY + content.height).toBeLessThanOrEqual(
        svgRect.height + 1e-6,
      );
    }
  });

  it("clientToMapCoordinate rejects implausibly far clicks", () => {
    const viewBox: ViewBox = { height: 1000, width: 500, x: 0, y: 0 };
    const svgRect: MeasuredRect = {
      height: 500,
      left: 0,
      top: 0,
      width: 800,
    };
    expect(
      clientToMapCoordinate(1e7, 1e7, viewBox, svgRect, bounds),
    ).toBeNull();
    const center = clientToMapCoordinate(
      svgRect.left + svgRect.width / 2,
      svgRect.top + svgRect.height / 2,
      viewBox,
      svgRect,
      bounds,
    );
    expect(center).not.toBeNull();
    if (center) {
      expect(center.x).toBeGreaterThanOrEqual(-bounds.width * 2);
      expect(center.x).toBeLessThanOrEqual(bounds.width * 3);
      expect(center.y).toBeGreaterThanOrEqual(-bounds.height * 2);
      expect(center.y).toBeLessThanOrEqual(bounds.height * 3);
    }
  });
});

describe("floor selection transitions", () => {
  const building = (
    floors: { id: string }[],
    defaultFloor: string,
  ): BuildingFloorConfig => ({
    center: { radius: 100, x: 0, y: 0 },
    defaultFloor,
    floors: floors.map((f) => ({ ...f, label: f.id, svgGroupId: `g-${f.id}` })),
    id: "b1",
    name: "test",
  });

  it("resolveFocusedFloorId keeps a still-valid previous floor", () => {
    const b = building([{ id: "1F" }, { id: "2F" }], "1F");
    expect(resolveFocusedFloorId(b, "2F")).toBe("2F");
  });

  it("resolveFocusedFloorId falls back to default for unknown previous floor", () => {
    const b = building([{ id: "1F" }, { id: "2F" }], "1F");
    expect(resolveFocusedFloorId(b, "9F")).toBe("1F");
    expect(resolveFocusedFloorId(b, null)).toBe("1F");
  });

  it("resolveFocusedFloorId resolves null for missing or floorless buildings", () => {
    expect(resolveFocusedFloorId(null, "1F")).toBeNull();
    expect(resolveFocusedFloorId(building([], ""), "1F")).toBeNull();
  });

  it("resolveDetectedFloorId always uses the building default", () => {
    const b = building([{ id: "1F" }, { id: "2F" }], "2F");
    expect(resolveDetectedFloorId(b)).toBe("2F");
    expect(resolveDetectedFloorId(null)).toBeNull();
    expect(resolveDetectedFloorId(building([], ""))).toBeNull();
  });
});
