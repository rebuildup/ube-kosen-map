/**
 * Regenerate the committed room extraction report.
 * Usage: bun run tools/room-report.mts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildRoomReport } from "../src/campus3d/roomReport.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const report = buildRoomReport();
const out = join(root, "docs", "evidence", "room-report.json");
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(
  `room-report: ${report.summary.totalRooms} rooms across ` +
    `${report.summary.floorsWithRooms}/${report.summary.floors} floors ` +
    `(${report.summary.buildings} buildings) -> ${out}`,
);
