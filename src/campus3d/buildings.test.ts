import { describe, expect, it } from "vitest";

import { CAMPUS_MODEL_DATA } from "./data/campusModelData";
import { withComplementedBuildings } from "./data/complemented";
import { BUILDING_REGISTRY } from "./data/buildingRegistry";
import { buildCampusModel } from "./geo/buildings";
import { pointInPolygon } from "./geo/polygon";
import { METERS_PER_DRAWING_UNIT } from "./geo/drawingTransform";
import type { RoomRingSpec } from "./geo/buildings";

const DATA = withComplementedBuildings(CAMPUS_MODEL_DATA);
const model = buildCampusModel(DATA);

const ringArea = (pts: readonly (readonly [number, number])[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
};

const M2 = METERS_PER_DRAWING_UNIT ** 2;

const ringAreaM2 = (ring: RoomRingSpec): number =>
  (ringArea(ring.outer) - ring.holes.reduce((a, h) => a + ringArea(h), 0)) * M2;

const edgeLengths = (ring: RoomRingSpec): number[] => {
  const out: number[] = [];
  for (const pts of [ring.outer, ...ring.holes]) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
  }
  return out;
};

describe("campus model generation", () => {
  it("generates every renderable registry building without silent skips", () => {
    expect(model.report.missingData).toEqual([]);
    const renderable = BUILDING_REGISTRY.filter((b) => b.kind !== "nodata");
    expect(model.buildings.filter((b) => b.status === "ok")).toHaveLength(
      renderable.length,
    );
    expect(model.report.nodata).toBe(
      BUILDING_REGISTRY.filter((b) => b.kind === "nodata").length,
    );
  });

  it("includes the four complemented outline buildings", () => {
    for (const key of ["eroom", "bbld", "cbld", "yokujo"]) {
      const b = model.buildings.find((m) => m.key === key);
      expect(b?.status).toBe("ok");
      expect(b?.slabs.length).toBeGreaterThan(0);
      expect(b?.walls.length).toBeGreaterThan(0);
      expect(b?.caps.length).toBeGreaterThan(0);
    }
  });

  it("produces floor slabs, walls and stairs for floor buildings", () => {
    const keiei = model.buildings.find((b) => b.key === "keiei");
    expect(keiei?.status).toBe("ok");
    expect(keiei!.slabs.length).toBeGreaterThan(0);
    expect(keiei!.walls.length).toBeGreaterThan(0);
    expect(keiei!.stairs.length).toBeGreaterThan(0);
    expect(keiei!.rooms.length).toBeGreaterThan(0);
    for (const s of keiei!.stairs) {
      expect(s.sx).toBeGreaterThan(0);
      expect(s.sy).toBeGreaterThan(0);
      expect(s.sz).toBeGreaterThan(0);
    }
    // Stair steps are solid boxes whose heights accumulate: the smallest
    // is one riser (~0.19 m rule -> 19 risers over a 3.6 m floor) and the
    // largest reaches the full floor height.
    const heights = keiei!.stairs.map((s) => s.sy);
    const riserModel = 3.6 / 19 / 26.25;
    const floorModel = 3.6 / 26.25;
    expect(Math.min(...heights)).toBeCloseTo(riserModel, 3);
    // Return-flight stairs top out at (RISERS-1)/RISERS of the floor.
    expect(Math.max(...heights)).toBeGreaterThan(0.9 * floorModel);
    expect(Math.max(...heights)).toBeLessThanOrEqual(floorModel + 1e-9);
  });

  it("keeps dormitories as exterior massing without interior rooms", () => {
    for (const key of ["ryod", "kokusai", "ryof", "shokudo", "eroom"]) {
      const b = model.buildings.find((m) => m.key === key);
      expect(b?.status).toBe("ok");
      expect(b!.rooms).toHaveLength(0);
      expect(b!.walls.length).toBeGreaterThan(0);
      // Dorm floor height is 3.0 m, school buildings 3.6 m.
      expect(b!.floorHeight).toBeCloseTo(3.0 / 26.25, 6);
    }
    const school = model.buildings.find((b) => b.key === "keiei");
    expect(school!.floorHeight).toBeCloseTo(3.6 / 26.25, 6);
  });

  it("derives room polygons from floor-plan linework, not grid cells", () => {
    const withRooms = model.buildings.filter((b) => b.rooms.length > 0);
    expect(withRooms.length).toBeGreaterThan(0);
    for (const b of withRooms) {
      for (const r of b.rooms) {
        // Stable domain id: building + floor + sequence.
        expect(r.id).toBe(
          `${b.key}:f${r.floor}:r${Number(r.id.split(":r")[1])}`,
        );
        expect(r.faces.length).toBeGreaterThan(0);
        for (const face of r.faces) {
          // Rings are implicitly closed: >=3 distinct vertices, positive area.
          expect(face.outer.length).toBeGreaterThanOrEqual(3);
          expect(ringArea(face.outer)).toBeGreaterThan(0);
          // Every hole sits strictly inside its outer ring.
          for (const hole of face.holes) {
            expect(hole.length).toBeGreaterThanOrEqual(3);
            const cx = hole.reduce((a, p) => a + p[0], 0) / hole.length;
            const cy = hole.reduce((a, p) => a + p[1], 0) / hole.length;
            expect(pointInPolygon(face.outer, cx, cy)).toBe(true);
            expect(ringArea(hole)).toBeLessThan(ringArea(face.outer));
          }
          // Polygon area matches the reported area (within rounding).
          const faceArea =
            (ringArea(face.outer) -
              face.holes.reduce((a, h) => a + ringArea(h), 0)) *
            M2;
          expect(faceArea).toBeGreaterThan(0);
        }
        // Reported area equals the sum of face areas.
        const sum = r.faces.reduce((a, f) => a + ringAreaM2(f), 0);
        expect(r.areaM2).toBeCloseTo(sum, 6);
        // All edge lengths are positive (no degenerate segments).
        for (const len of r.faces.flatMap(edgeLengths)) {
          expect(len).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps room areas area-conserving per floor", () => {
    for (const b of model.buildings) {
      for (const rep of b.floorReports) {
        const roomsArea = b.rooms
          .filter((r) => r.floor === rep.floor)
          .reduce((a, r) => a + r.areaM2, 0);
        // Rooms are the kept faces minus slivers, so they must stay within
        // the traced face area and cover almost all of it.
        const faceM2 = rep.stats.faceAreaU2 * M2;
        expect(roomsArea, `${b.key}#${rep.floor}`).toBeLessThanOrEqual(
          faceM2 * 1.0001,
        );
        expect(faceM2 - roomsArea).toBeLessThan(faceM2 * 0.02);
      }
    }
  });

  it("places every building on a non-negative base with positive height", () => {
    for (const b of model.buildings) {
      if (b.status !== "ok") continue;
      expect(b.baseY).toBeGreaterThanOrEqual(0);
      expect(b.totalHeight).toBeGreaterThan(0);
      for (const p of [...b.slabs, ...b.caps]) {
        expect(p.height).toBeGreaterThan(0);
        expect(p.polygon.length).toBeGreaterThan(2);
      }
    }
  });
});
