/**
 * Terrain solid generation, ported from the legacy terrain pass.
 *
 * Each base-layer polygon (_00–_08) becomes an extruded prism whose height
 * equals its layer index times TERRAIN_STEP_MODEL; concrete podium sheets
 * rise only 0.4 model units above the layer below. Output is renderer-free
 * prism specs plus per-layer colors for the renderer adapter.
 */

import type { CampusModelData, TerrainLayer } from "../types";
import {
  drawingToModel,
  metersToModelUnits,
  TERRAIN_STEP_MODEL,
} from "./drawingTransform";
import type { PrismSpec } from "./buildings";

export interface TerrainPrism extends PrismSpec {
  readonly layer: number;
  readonly sheet: boolean;
}

export interface TerrainModel {
  readonly prisms: readonly TerrainPrism[];
  /** Layer index -> normalized height 0..1 (for renderer color ramp). */
  readonly maxLayer: number;
}

// Legacy used MU(0.4): a 0.4 m podium rise in model units.
const SHEET_H = metersToModelUnits(0.4);

export const buildTerrain = (data: CampusModelData): TerrainModel => {
  const prisms: TerrainPrism[] = [];
  let maxLayer = 0;
  for (const t of data.terr as readonly TerrainLayer[]) {
    maxLayer = Math.max(maxLayer, t.l);
    const h = Math.max(t.l * TERRAIN_STEP_MODEL, 0.02);
    for (const poly of t.p) {
      const polygon = poly.map((p) => {
        const m = drawingToModel(p[0], p[1]);
        return [m.x, m.z] as const;
      });
      if (t.sheet) {
        prisms.push({
          polygon,
          layer: t.l,
          sheet: true,
          yBottom: (t.l - 1) * TERRAIN_STEP_MODEL,
          height: SHEET_H,
        });
      } else {
        prisms.push({
          polygon,
          layer: t.l,
          sheet: false,
          yBottom: 0,
          height: h,
        });
      }
    }
  }
  return { prisms, maxLayer };
};
