/**
 * Anomaly scan over every partitioned floor: flags oversized rooms,
 * degenerate rooms, orphan holes, and classification outliers for
 * human review against the source plans.
 * Usage: bun run tools/anomaly-scan.mts
 */
import { CAMPUS_MODEL_DATA } from "../src/campus3d/data/campusModelData.ts";
import { withComplementedBuildings } from "../src/campus3d/data/complemented.ts";
import { buildCampusModel } from "../src/campus3d/geo/buildings.ts";
import { METERS_PER_DRAWING_UNIT } from "../src/campus3d/geo/drawingTransform.ts";

const M2 = METERS_PER_DRAWING_UNIT ** 2;
const data = withComplementedBuildings(CAMPUS_MODEL_DATA);
const model = buildCampusModel(data);

interface Flag {
  floor: string;
  room?: string;
  kind: string;
  detail: string;
}
const flags: Flag[] = [];

for (const b of model.buildings) {
  for (const rep of b.floorReports) {
    const fid = `${b.key}#${rep.floor}`;
    const s = rep.stats;
    if (s.orphanHoles > 0) {
      flags.push({
        floor: fid,
        kind: "orphanHoles",
        detail: `${s.orphanHoles} hole walks unattached`,
      });
    }
    if (s.faces <= 1) {
      flags.push({
        floor: fid,
        kind: "open-face",
        detail: `only ${s.faces} face(s); plate ${s.plateAreaU2.toFixed(1)}u2`,
      });
      continue;
    }
    const rooms = b.rooms.filter((r) => r.floor === rep.floor);
    const plateM2 = s.plateAreaU2 * M2;
    for (const r of rooms) {
      const share = r.areaM2 / plateM2;
      const minDim = Math.min(r.widthM, r.depthM);
      if (share > 0.45) {
        flags.push({
          floor: fid,
          room: r.id,
          kind: "oversized",
          detail: `${r.areaM2.toFixed(0)}m2 = ${(share * 100).toFixed(0)}% of plate, bbox ${r.widthM.toFixed(1)}x${r.depthM.toFixed(1)}m, verts=${r.faces.reduce((a, f) => a + f.outer.length, 0)}`,
        });
      }
      if (r.areaM2 < 1.0 || minDim < 0.8) {
        flags.push({
          floor: fid,
          room: r.id,
          kind: "degenerate",
          detail: `${r.areaM2.toFixed(2)}m2, bbox ${r.widthM.toFixed(1)}x${r.depthM.toFixed(1)}m`,
        });
      }
      // Corridor heuristic sanity: corridor should be elongated.
      if (
        r.kind === "corridor" &&
        Math.max(r.widthM, r.depthM) / (Math.min(r.widthM, r.depthM) || 1) < 1.5
      ) {
        flags.push({
          floor: fid,
          room: r.id,
          kind: "corridor-shape",
          detail: `bbox ${r.widthM.toFixed(1)}x${r.depthM.toFixed(1)}m not elongated`,
        });
      }
    }
  }
}

// Summary per floor for context.
const rows: string[] = [];
for (const b of model.buildings) {
  for (const rep of b.floorReports) {
    const rooms = b.rooms.filter((r) => r.floor === rep.floor);
    const kinds = rooms.reduce<Record<string, number>>(
      (a, r) => ((a[r.kind] = (a[r.kind] ?? 0) + 1), a),
      {},
    );
    rows.push(
      `${b.key}#${rep.floor}: faces=${rep.stats.faces} rooms=${rooms.length} [${Object.entries(
        kinds,
      )
        .map(([k, v]) => `${k}:${v}`)
        .join(
          ",",
        )}] orphanHoles=${rep.stats.orphanHoles} slivers=${rep.stats.slivers}`,
    );
  }
}
console.log(rows.join("\n"));
console.log("\n=== FLAGS ===");
for (const f of flags) {
  console.log(`${f.floor} [${f.kind}] ${f.room ?? ""} ${f.detail}`);
}
console.log(`\ntotal flags: ${flags.length}`);
