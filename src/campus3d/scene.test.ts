import { describe, expect, it } from "vitest";

import { CAMPUS_MODEL_DATA } from "./data/campusModelData";
import { buildCampusScene, campusSceneStats } from "./scene";

const scene = buildCampusScene(CAMPUS_MODEL_DATA);
const stats = campusSceneStats(scene);

describe("campus scene assembly", () => {
  it("composes terrain, linework, buildings and outdoor steps", () => {
    expect(stats.linework.total).toBe(1291);
    expect(stats.linework.floating).toBe(0);
    expect(stats.terrainPrisms).toBeGreaterThan(0);
    expect(stats.buildings.missingData).toEqual([]);
    expect(stats.outdoorStepCount).toBeGreaterThan(0);
  });

  it("produces non-empty geometry for every realized layer", () => {
    const g = scene.lineworkGeometry;
    expect(g.markings.positions.length).toBeGreaterThan(0);
    expect(g.markings.indices.length).toBeGreaterThan(0);
    expect(g.slopes.positions.length).toBeGreaterThan(0);
    expect(g.steps.positions.length).toBeGreaterThan(0);
    expect(g.stepBoxes.length).toBeGreaterThan(0);
    expect(g.barriers.length).toBeGreaterThan(0);
  });

  it("keeps building geometry on positive bases with closed prisms", () => {
    for (const b of scene.buildings.buildings) {
      if (b.status !== "ok") continue;
      expect(b.baseY).toBeGreaterThanOrEqual(0);
      expect(b.totalHeight).toBeGreaterThan(0);
      for (const p of [...b.slabs, ...b.ceilings, ...b.caps]) {
        expect(p.polygon.length).toBeGreaterThan(2);
        expect(p.height).toBeGreaterThan(0);
      }
    }
  });

  it("emits no restricted dormitory interior data", () => {
    for (const b of scene.buildings.buildings) {
      if (!b.category.startsWith("寮")) continue;
      expect(b.rooms).toHaveLength(0);
    }
  });
});
