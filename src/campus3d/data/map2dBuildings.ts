/**
 * Link between the 3D model's building keys and the 2D map's building ids
 * (BUILDING_FLOOR_CONFIGS in src/data/floorConfig.ts).
 *
 * The two datasets were authored separately, so this table is the single
 * place that declares which 2D buildings correspond to each 3D building.
 * Most are 1:1; `ippan` is the exception — the 2D map splits 一般棟 and
 * 物質棟 while the 3D model presents them as one building, and the legacy
 * `jisshu2` entry was a stale name merged into `jisshu`.
 */

import { BUILDING_FLOOR_CONFIGS } from "../../data/floorConfig";

/** 3D building key -> 2D map building ids (empty for complemented-only buildings). */
export const CAMPUS3D_TO_MAP2D: Readonly<Record<string, readonly string[]>> = {
  keiei: ["building-keiei"],
  techno: ["building-techno"],
  kikiden: ["building-kikiden"],
  ippan: ["building-ippan", "building-busshitsu"],
  senkouka: ["building-senkouka"],
  toshokan: ["building-toshokan"],
  gakuseikan: ["building-gakuseikan"],
  tamokuteki: ["building-tamokuteki"],
  kaikatu1: ["building-kaikatu1"],
  kaikatu2: ["building-kaikatu2"],
  ryod: ["building-ryo-d"],
  kokusai: ["building-kokusai-ryo"],
  ryof: ["building-ryo-f"],
  shokudo: ["building-ryo-shokudo"],
  gym1: ["building-gym1"],
  gym2: ["building-gym2"],
  budo: ["building-budo"],
  monodukuri: ["building-monodukuri"],
  jisshu: ["building-jisshu"],
  kikaijikken: ["building-kikai-jikken"],
  // Complemented buildings absent from the 2D source map:
  eroom: [],
  bbld: [],
  cbld: [],
  yokujo: [],
  // Stale entry merged into jisshu:
  jisshu2: [],
};

export interface Map2dLinkIssue {
  readonly kind: "unknown-3d-key" | "unknown-2d-id" | "uncovered-2d-building";
  readonly detail: string;
}

/**
 * Cross-check the link table against both registries. Returns an empty array
 * when every referenced id exists and every 2D building is covered.
 */
export function validateMap2dLink(
  building3dKeys: readonly string[],
): Map2dLinkIssue[] {
  const issues: Map2dLinkIssue[] = [];
  const known2d = new Set(BUILDING_FLOOR_CONFIGS.map((b) => b.id));
  const covered2d = new Set<string>();

  for (const key of building3dKeys) {
    const links = CAMPUS3D_TO_MAP2D[key];
    if (!links) {
      issues.push({
        kind: "unknown-3d-key",
        detail: `3D building "${key}" has no entry in CAMPUS3D_TO_MAP2D`,
      });
      continue;
    }
    for (const id of links) {
      if (!known2d.has(id)) {
        issues.push({
          kind: "unknown-2d-id",
          detail: `3D building "${key}" references unknown 2D id "${id}"`,
        });
      } else {
        covered2d.add(id);
      }
    }
  }

  for (const b of BUILDING_FLOOR_CONFIGS) {
    if (!covered2d.has(b.id)) {
      issues.push({
        kind: "uncovered-2d-building",
        detail: `2D building "${b.id}" (${b.name}) is not covered by any 3D building`,
      });
    }
  }

  return issues;
}
