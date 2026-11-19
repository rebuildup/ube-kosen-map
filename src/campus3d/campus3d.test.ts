import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CAMPUS_MODEL_DATA } from "./data/campusModelData";
import { withComplementedBuildings } from "./data/complemented";
import {
  BUILDING_REGISTRY,
  resolveBuildingRegistry,
} from "./data/buildingRegistry";
import { validateMap2dLink } from "./data/map2dBuildings";
import {
  CAMPUS_REFERENCE,
  GEO,
  METERS_PER_DRAWING_UNIT,
  METERS_PER_MODEL_UNIT,
  MODEL_UNITS_PER_DRAWING_UNIT,
  NORTH_OFFSET_DEGREES,
  SCHOOL_FLOOR_HEIGHT_M,
  TERRAIN_LAYER_HEIGHT_M,
  drawingToGeo,
  drawingToModel,
  elevationOfLayer,
  metersToModelUnits,
} from "./geo/drawingTransform";

describe("drawingTransform", () => {
  it("keeps one ruler: model units convert back to the same meters", () => {
    // 1 drawing unit = 0.84 m; 1 model unit = 26.25 m.
    expect(METERS_PER_MODEL_UNIT).toBeCloseTo(
      METERS_PER_DRAWING_UNIT / MODEL_UNITS_PER_DRAWING_UNIT,
      10,
    );
    expect(metersToModelUnits(METERS_PER_MODEL_UNIT)).toBeCloseTo(1, 10);
  });

  it("maps the geo origin drawing coordinate to zero ENU offset", () => {
    const geo = drawingToGeo(GEO.originDrawX, GEO.originDrawY);
    expect(geo.e).toBeCloseTo(0, 6);
    expect(geo.n).toBeCloseTo(0, 6);
    expect(geo.lat).toBeCloseTo(CAMPUS_REFERENCE.lat0, 8);
    expect(geo.lon).toBeCloseTo(CAMPUS_REFERENCE.lon0, 8);
  });

  it("places drawing points on the model plane with the documented scale", () => {
    const p = drawingToModel(GEO.originDrawX + 10, GEO.originDrawY - 5);
    expect(p.x).toBeCloseTo(10 * MODEL_UNITS_PER_DRAWING_UNIT, 10);
    expect(p.z).toBeCloseTo(-5 * MODEL_UNITS_PER_DRAWING_UNIT, 10);
  });

  it("derives elevation and north offset from the calibrated constants", () => {
    expect(elevationOfLayer(0)).toBeCloseTo(27.4, 10);
    expect(elevationOfLayer(8)).toBeCloseTo(
      27.4 + 8 * TERRAIN_LAYER_HEIGHT_M,
      10,
    );
    // East direction (0.9636, 0.2672) is ~15.5 degrees off drawing +x.
    expect(NORTH_OFFSET_DEGREES).toBeCloseTo(-15.5, 0);
  });
});

describe("campus model data", () => {
  it("contains the extracted terrain, linework, buildings and steps", () => {
    expect(CAMPUS_MODEL_DATA.terr).toHaveLength(9);
    expect(CAMPUS_MODEL_DATA.tlines).toHaveLength(7);
    expect(CAMPUS_MODEL_DATA.osteps).toHaveLength(8);
    expect(Object.keys(CAMPUS_MODEL_DATA.bld)).toHaveLength(20);
    expect(Object.keys(CAMPUS_MODEL_DATA.bases)).toHaveLength(20);
  });

  it("covers every non-complemented registry building with geometry", () => {
    const missing = BUILDING_REGISTRY.filter(
      (b) =>
        b.kind !== "nodata" && !b.complemented && !CAMPUS_MODEL_DATA.bld[b.key],
    ).map((b) => b.key);
    expect(missing).toEqual([]);
  });

  it("applies the documented terrain base correction", () => {
    const resolved = resolveBuildingRegistry(CAMPUS_MODEL_DATA);
    const techno = resolved.find((b) => b.key === "techno");
    const jisshu = resolved.find((b) => b.key === "jisshu");
    expect(techno?.terrainLayer).toBe(7);
    expect(jisshu?.terrainLayer).toBe(7);
    // Raw extraction reads layer 5 for both.
    expect(CAMPUS_MODEL_DATA.bases.techno).toBe(5);
    expect(CAMPUS_MODEL_DATA.bases.jisshu).toBe(5);
  });

  it("assigns dorm floor heights of 3.0 m and school heights of 3.6 m", () => {
    const resolved = resolveBuildingRegistry(CAMPUS_MODEL_DATA);
    const ryod = resolved.find((b) => b.key === "ryod");
    const keiei = resolved.find((b) => b.key === "keiei");
    expect(ryod?.floorHeightM).toBe(3.0);
    expect(keiei?.floorHeightM).toBe(SCHOOL_FLOOR_HEIGHT_M);
  });
});

describe("public data boundary", () => {
  // Dormitory room numbers and handbook-derived interior descriptions are
  // restricted (docs/campus3d-data-policy.md). The registry must never carry
  // them: this repo is public, so UI hiding cannot protect the data.
  const DORM_KEYS = new Set([
    "ryod",
    "kokusai",
    "ryof",
    "shokudo",
    "eroom",
    "bbld",
    "cbld",
    "yokujo",
  ]);

  it("keeps dorm room numbers and handbook citations out of the registry", () => {
    for (const b of BUILDING_REGISTRY) {
      if (!DORM_KEYS.has(b.key)) continue;
      const text = `${b.rooms ?? ""} ${b.note ?? ""}`;
      expect(text, b.key).not.toMatch(/[0-9]{4}/);
      expect(text, b.key).not.toContain("寮生手帳");
    }
  });

  it("keeps four-digit room numbers out of every registry entry", () => {
    for (const b of BUILDING_REGISTRY) {
      const text = `${b.rooms ?? ""} ${b.note ?? ""}`;
      expect(text, b.key).not.toMatch(/\b\d{4}\b/);
    }
  });

  it("never attaches hand-transcribed interior plans to dormitories", () => {
    // `rooms`/`fr` on a floor is the hand-transcribed plan channel, which is
    // restricted for dormitories. campus-map.svg floor plates (`f`/`w`/`st`)
    // are publishable and may remain.
    const data = withComplementedBuildings(CAMPUS_MODEL_DATA);
    for (const b of BUILDING_REGISTRY) {
      if (!b.category.startsWith("寮")) continue;
      for (const fl of data.bld[b.key]?.fl ?? []) {
        expect(fl.rooms, `${b.key}#${fl.n}`).toBeUndefined();
        expect(fl.fr, `${b.key}#${fl.n}`).toBeUndefined();
      }
    }
  });

  it("keeps restricted pin identifiers out of the public source tree", () => {
    const root = fileURLToPath(new URL(".", import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
        const text = readFileSync(p, "utf8");
        for (const marker of ["PIN_DEFINITIONS", "HUB_INFO"]) {
          if (text.includes(marker)) offenders.push(`${p}: ${marker}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe("2D map link", () => {
  it("covers every 3D building and every 2D building without dangling ids", () => {
    const issues = validateMap2dLink(BUILDING_REGISTRY.map((b) => b.key));
    expect(issues).toEqual([]);
  });
});
