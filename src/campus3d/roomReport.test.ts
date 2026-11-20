import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildRoomReport, ROOM_REPORT_SCHEMA } from "./roomReport";

const report = buildRoomReport();

describe("room extraction report", () => {
  it("covers every registry building and configured floor", () => {
    expect(report.schema).toBe(ROOM_REPORT_SCHEMA);
    expect(report.summary.buildings).toBe(report.buildings.length);
    // Every building has at least one floor entry.
    for (const b of report.buildings) {
      expect(
        report.floors.some((f) => f.building === b.key),
        b.key,
      ).toBe(true);
    }
  });

  it("marks dimensions as calibrated estimates, never measured", () => {
    expect(report.scale.basis).toBe("calibrated");
    expect(report.scale.measured).toBe(false);
    for (const f of report.floors) {
      for (const r of f.rooms) {
        expect(r.accuracy).toBe("calibrated-estimate");
      }
    }
  });

  it("keeps partitioned floors area-conserving", () => {
    for (const f of report.floors) {
      if (f.status !== "partitioned") continue;
      expect(f.areaDeltaRatio, `${f.building}#${f.floor}`).not.toBeNull();
      expect(
        Math.abs(f.areaDeltaRatio!),
        `${f.building}#${f.floor}`,
      ).toBeLessThan(0.02);
    }
  });

  it("has unique room ids and positive dimensions", () => {
    const ids = new Set<string>();
    for (const f of report.floors) {
      for (const r of f.rooms) {
        expect(ids.has(r.id), r.id).toBe(false);
        ids.add(r.id);
        expect(r.areaM2).toBeGreaterThan(0);
        expect(r.widthM).toBeGreaterThan(0);
        expect(r.depthM).toBeGreaterThan(0);
        expect(r.faceCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("never emits rooms for dormitory or outline buildings", () => {
    const massing = new Set(report.summary.massingOnly);
    for (const f of report.floors) {
      if (massing.has(f.building)) {
        expect(f.rooms, `${f.building}#${f.floor}`).toHaveLength(0);
      }
    }
  });

  it("stays consistent with the committed JSON snapshot", () => {
    const committed = JSON.parse(
      readFileSync(
        new URL("../../quality/room-report.json", import.meta.url),
        "utf8",
      ),
    );
    expect(report).toEqual(committed);
  });
});
