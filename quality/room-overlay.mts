/**
 * Generate SVG overlay evidence: source floor-plan fills + wall linework
 * with the extracted room polygons drawn on top, one file per floor.
 * Usage: bun run quality/room-overlay.mts [building ...]
 * Output: docs/evidence/room-overlay-<building>-f<floor>.svg
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CAMPUS_MODEL_DATA } from "../src/campus3d/data/campusModelData.ts";
import { withComplementedBuildings } from "../src/campus3d/data/complemented.ts";
import { buildCampusModel } from "../src/campus3d/geo/buildings.ts";
import type { DrawingPoint, DrawingPolygon } from "../src/campus3d/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "evidence");

// Representative floors covering classroom, corridor+stair, and large-hall
// partitions. Override via CLI args as "building:floor".
const DEFAULT_TARGETS = ["keiei:1", "kikiden:2", "toshokan:1", "ippan:1"];

const KIND_FILL: Record<string, string> = {
  room: "#7fb069",
  corridor: "#6a9ec4",
  stair: "#d9a05b",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ringPath = (pts: readonly DrawingPoint[], close = true): string => {
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(" ");
  return close ? `${d} Z` : d;
};

const polyPath = (poly: DrawingPolygon): string => ringPath(poly);

const renderFloor = (
  buildingKey: string,
  floorN: number,
): { svg: string; rooms: number } => {
  const data = withComplementedBuildings(CAMPUS_MODEL_DATA);
  const fl = data.bld[buildingKey]?.fl?.find((f) => f.n === floorN);
  if (!fl) throw new Error(`no floor data for ${buildingKey}#${floorN}`);
  const model = buildCampusModel(data);
  const b = model.buildings.find((x) => x.key === buildingKey);
  const rooms = (b?.rooms ?? []).filter((r) => r.floor === floorN);

  // Bounding box over fills + walls + rooms.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (p: readonly number[]) => {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  };
  for (const poly of fl.f) for (const p of poly) grow(p);
  for (const s of fl.w) grow([s[0], s[1]]);

  const parts: string[] = [];
  parts.push(
    `<rect x="${x0 - 2}" y="${y0 - 2}" width="${x1 - x0 + 4}" height="${y1 - y0 + 4}" fill="#f4f1ea"/>`,
  );
  // Source fills (floor plates).
  for (const poly of fl.f) {
    parts.push(
      `<path d="${polyPath(poly)}" fill="#d8d2c4" stroke="#8f887a" stroke-width="0.12"/>`,
    );
  }
  // Source wall/divider linework.
  for (const s of fl.w) {
    parts.push(
      `<line x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}" stroke="#3a3a3a" stroke-width="0.09"/>`,
    );
  }
  // Extracted room polygons on top.
  for (const r of rooms) {
    for (const face of r.faces) {
      const d =
        ringPath(face.outer) + face.holes.map((h) => ringPath(h)).join("");
      parts.push(
        `<path d="${d}" fill="${KIND_FILL[r.kind] ?? "#999"}" fill-opacity="0.45" fill-rule="evenodd" stroke="#1f3b1f" stroke-width="0.1"/>`,
      );
    }
  }
  // Room labels at face centroids (vertex-average is fine for evidence).
  for (const r of rooms) {
    const cx = r.centroidDraw[0];
    const cy = r.centroidDraw[1];
    const fs = Math.max(1.2, (x1 - x0) / 60);
    parts.push(
      `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" font-size="${fs.toFixed(2)}" text-anchor="middle" fill="#222">${esc(r.label)}</text>`,
    );
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - 2} ${y0 - 2} ${x1 - x0 + 4} ${y1 - y0 + 4}">` +
    `<title>${esc(buildingKey)} floor ${floorN} — source linework + extracted room polygons</title>` +
    parts.join("") +
    `</svg>\n`;
  return { svg, rooms: rooms.length };
};

const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((t) => {
      const [k, f] = t.split(":");
      return { key: k, floor: Number(f) };
    })
  : DEFAULT_TARGETS.map((t) => {
      const [k, f] = t.split(":");
      return { key: k, floor: Number(f) };
    });

mkdirSync(outDir, { recursive: true });
for (const { key, floor } of targets) {
  const { svg, rooms } = renderFloor(key, floor);
  const file = join(outDir, `room-overlay-${key}-f${floor}.svg`);
  writeFileSync(file, svg);
  console.log(`${file} (${rooms} rooms)`);
}
