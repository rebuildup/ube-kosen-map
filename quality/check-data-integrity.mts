#!/usr/bin/env node
// Dependency-free data integrity check for the campus map.
// Runnable via `node quality/check-data-integrity.mts` (Node >= 22.6 type
// stripping) so it can execute in environments without node_modules, e.g.
// the system-quality challenge harness.
//
// Prints `DATA_INTEGRITY_VIOLATION: <detail>` per violation and exits 1
// when any violation exists. This diagnostic string is part of the
// challenge contract and must not be renamed casually.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CAMPUS_MAP_BOUNDS } from "../src/data/buildings.ts";
import { BUILDING_FLOOR_CONFIGS } from "../src/data/floorConfig.ts";
import amenitiesJson from "../src/data/mapAmenities.json" with { type: "json" };
import { floorNumberFromId } from "../src/components/map/utils/viewport.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const violations: string[] = [];

function violate(detail: string): void {
  violations.push(detail);
  console.error(`DATA_INTEGRITY_VIOLATION: ${detail}`);
}

type Amenity = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  x?: unknown;
  y?: unknown;
  z?: unknown;
  buildingId?: unknown;
  floorId?: unknown;
};

const VALID_AMENITY_TYPES = new Set(["toilet", "trash"]);
const BOUNDS_MARGIN = 250;

const svgText = readFileSync(join(root, "public/campus-map3.svg"), "utf8");
if (!svgText.includes("<svg")) {
  violate("public/campus-map3.svg does not contain an <svg> element");
}
const svgIds = new Set(
  [...svgText.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
);

const buildingIds = new Set<string>();
const buildingFloorIds = new Map<string, Set<string>>();

for (const building of BUILDING_FLOOR_CONFIGS) {
  if (buildingIds.has(building.id)) {
    violate(`duplicate building id in floorConfig: ${building.id}`);
  }
  buildingIds.add(building.id);

  const floorIds = new Set<string>();
  for (const floor of building.floors) {
    if (floorIds.has(floor.id)) {
      violate(`duplicate floor id ${floor.id} in building ${building.id}`);
    }
    floorIds.add(floor.id);
    if (!svgIds.has(floor.svgGroupId)) {
      violate(
        `floor ${building.id}/${floor.id} references missing SVG group "${floor.svgGroupId}"`,
      );
    }
  }
  buildingFloorIds.set(building.id, floorIds);

  if (building.defaultFloor !== "" && !floorIds.has(building.defaultFloor)) {
    violate(
      `building ${building.id} defaultFloor "${building.defaultFloor}" is not a known floor`,
    );
  }

  if (building.svgGroupId && !svgIds.has(building.svgGroupId)) {
    violate(
      `building ${building.id} references missing SVG group "${building.svgGroupId}"`,
    );
  }

  const { x, y, radius } = building.center;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < -BOUNDS_MARGIN ||
    x > CAMPUS_MAP_BOUNDS.width + BOUNDS_MARGIN ||
    y < -BOUNDS_MARGIN ||
    y > CAMPUS_MAP_BOUNDS.height + BOUNDS_MARGIN
  ) {
    violate(`building ${building.id} center is outside map bounds`);
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    violate(`building ${building.id} has non-positive detection radius`);
  }
}

if (!Array.isArray(amenitiesJson)) {
  violate("mapAmenities.json is not an array");
} else {
  const seenIds = new Set<string>();
  for (const [index, raw] of (amenitiesJson as Amenity[]).entries()) {
    const label = typeof raw?.id === "string" ? raw.id : `index ${index}`;
    if (typeof raw?.id !== "string" || !raw.id) {
      violate(`amenity at index ${index} has no string id`);
      continue;
    }
    if (seenIds.has(raw.id)) {
      violate(`duplicate amenity id: ${raw.id}`);
    }
    seenIds.add(raw.id);

    if (typeof raw.type !== "string" || !VALID_AMENITY_TYPES.has(raw.type)) {
      violate(`amenity ${label} has invalid type: ${String(raw.type)}`);
    }
    if (
      typeof raw.x !== "number" ||
      typeof raw.y !== "number" ||
      !Number.isFinite(raw.x) ||
      !Number.isFinite(raw.y) ||
      raw.x < -BOUNDS_MARGIN ||
      raw.x > CAMPUS_MAP_BOUNDS.width + BOUNDS_MARGIN ||
      raw.y < -BOUNDS_MARGIN ||
      raw.y > CAMPUS_MAP_BOUNDS.height + BOUNDS_MARGIN
    ) {
      violate(`amenity ${label} coordinates are outside map bounds`);
    }
    if (
      raw.z !== undefined &&
      (typeof raw.z !== "number" || !Number.isInteger(raw.z) || raw.z < 1)
    ) {
      violate(`amenity ${label} has invalid floor level z`);
    }
    if (raw.buildingId !== undefined) {
      if (typeof raw.buildingId !== "string") {
        violate(`amenity ${label} buildingId is not a string`);
      } else if (!buildingIds.has(raw.buildingId)) {
        violate(
          `amenity ${label} references unknown building "${raw.buildingId}"`,
        );
      } else if (raw.floorId !== undefined) {
        const floors = buildingFloorIds.get(raw.buildingId);
        if (
          typeof raw.floorId === "string" &&
          floors &&
          floors.size > 0 &&
          !floors.has(raw.floorId)
        ) {
          violate(
            `amenity ${label} references unknown floor "${raw.floorId}" in ${raw.buildingId}`,
          );
        }
        // z is the floor number shown by the renderer; it must agree with
        // the numeric prefix of floorId (e.g. "2F" -> z 2).
        if (
          typeof raw.floorId === "string" &&
          typeof raw.z === "number" &&
          floorNumberFromId(raw.floorId) !== null &&
          floorNumberFromId(raw.floorId) !== raw.z
        ) {
          violate(
            `amenity ${label} floor level z=${raw.z} disagrees with floorId "${raw.floorId}"`,
          );
        }
      }
    }
  }
}

if (violations.length === 0) {
  console.log(
    `DATA_INTEGRITY_OK: ${BUILDING_FLOOR_CONFIGS.length} buildings, ` +
      `${(amenitiesJson as unknown[]).length} amenities, ${svgIds.size} SVG ids`,
  );
} else {
  console.log(`DATA_INTEGRITY_FAILED: ${violations.length} violation(s)`);
}
process.exit(violations.length === 0 ? 0 : 1);
