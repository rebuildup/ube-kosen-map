import { describe, expect, it } from "vitest";

import { CAMPUS_MODEL_DATA } from "../data/campusModelData";
import { TERRAIN_STEP_MODEL } from "./drawingTransform";
import { classifyLinework } from "./linework";
import { buildLineworkGeometry } from "./lineworkGeometry";
import { createTerrainSurface } from "./surface";

const result = classifyLinework(CAMPUS_MODEL_DATA);

describe("terrain surface", () => {
  it("returns layer-unit heights within the documented range", () => {
    const surface = createTerrainSurface(CAMPUS_MODEL_DATA);
    // Sample a grid over the drawing extent.
    for (let x = 20; x <= 460; x += 40) {
      for (let y = 20; y <= 700; y += 40) {
        const h = surface.heightAt(x, y);
        expect(h).toBeGreaterThanOrEqual(0);
        // Highest layer is 8; concrete sheets cap at (8-1)+0.4 = 7.4.
        expect(h).toBeLessThanOrEqual(8.4);
      }
    }
  });

  it("rises by one terrain step per layer", () => {
    expect(TERRAIN_STEP_MODEL).toBeCloseTo(1 / 26.25, 6);
  });
});

describe("linework classification", () => {
  it("classifies every source segment exactly once", () => {
    const expected = CAMPUS_MODEL_DATA.tlines.reduce(
      (a, t) => a + t.s.length,
      0,
    );
    expect(result.stats.total).toBe(expected);
    expect(result.stats.total).toBe(1291);
    expect(result.segments.every((s) => s.cls !== null)).toBe(true);
    const sum = Object.values(result.stats.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(result.stats.total);
    expect(result.stats.floating).toBe(0);
  });

  it("keeps the documented shed-site findings", () => {
    // 国際寮西側 has no matching linework in the source (0 segments), as in
    // the legacy inventory. C棟/寮F棟 sites activate once the dorm-plan
    // buildings (cbld/eroom) are ported.
    const kokusai = result.shedSites.find((s) => s.key === "kokusai");
    expect(kokusai?.n).toBe(0);
  });

  it("produces barrier groups matching the documented fences", () => {
    // Tennis-court fence: 4 sides -> 4 groups.
    expect(result.stats.fenceGroups).toBe(4);
    expect(result.stats.netGroups).toBeGreaterThan(0);
    expect(result.stats.stairGroups).toBeGreaterThan(0);
    expect(result.stats.stepLenM).toBeGreaterThan(0);
  });
});

describe("linework geometry", () => {
  const geo = buildLineworkGeometry({
    result,
    data: CAMPUS_MODEL_DATA,
  });

  it("emits valid triangle meshes for markings, slopes and step edges", () => {
    for (const mesh of [geo.markings, geo.slopes, geo.steps]) {
      expect(mesh.positions.length % 3).toBe(0);
      expect(mesh.indices.length % 3).toBe(0);
      expect(mesh.positions.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
      for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
    }
    // Markings carry per-vertex colors.
    expect(geo.markings.colors?.length).toBe(
      (geo.markings.positions.length / 3) * 3,
    );
  });

  it("emits positive step boxes and barrier posts", () => {
    expect(geo.stepBoxes.length).toBeGreaterThan(0);
    for (const s of geo.stepBoxes) {
      expect(s.sx).toBeGreaterThan(0);
      expect(s.sy).toBeGreaterThan(0);
      expect(s.sz).toBeGreaterThan(0);
      expect(Number.isFinite(s.y)).toBe(true);
    }
    const net = geo.barriers.find((b) => b.kind === "net");
    const fence = geo.barriers.find((b) => b.kind === "fence");
    expect(net?.posts.length).toBeGreaterThan(0);
    expect(fence?.posts.length).toBeGreaterThan(0);
    for (const b of geo.barriers) {
      expect(b.mesh.positions.length % 3).toBe(0);
      expect(b.mesh.uvs?.length).toBe((b.mesh.positions.length / 3) * 2);
    }
  });
});
