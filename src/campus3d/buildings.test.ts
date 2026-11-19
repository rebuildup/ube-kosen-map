import { describe, expect, it } from "vitest";

import { CAMPUS_MODEL_DATA } from "./data/campusModelData";
import { withComplementedBuildings } from "./data/complemented";
import { BUILDING_REGISTRY } from "./data/buildingRegistry";
import { buildCampusModel } from "./geo/buildings";

const DATA = withComplementedBuildings(CAMPUS_MODEL_DATA);
const model = buildCampusModel(DATA);

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
