/**
 * Terrain surface height in drawing-coordinate space.
 *
 * The surface at a point is the topmost base-layer polygon covering it,
 * measured in layer units (one layer = TERRAIN_LAYER_HEIGHT_M meters).
 * Concrete podium sheets rise only 0.4 m, modeled as (layer - 1) + 0.4.
 * Ported from the legacy implementation.
 */

import type { CampusModelData } from "../types";
import { pointInPolygon } from "./polygon";

export interface TerrainSurface {
  /** Surface height in layer units (may be fractional for sheets). */
  readonly heightAt: (x: number, y: number) => number;
}

export const createTerrainSurface = (data: CampusModelData): TerrainSurface => {
  const heightAt = (x: number, y: number): number => {
    let best = 0;
    for (const t of data.terr) {
      for (const poly of t.p) {
        if (pointInPolygon(poly, x, y) && t.l > best) best = t.l;
      }
    }
    let sheet = false;
    for (const t of data.terr) {
      if (!t.sheet) continue;
      for (const poly of t.p) {
        if (pointInPolygon(poly, x, y) && t.l >= best) sheet = true;
      }
    }
    return sheet ? best - 1 + 0.4 : best;
  };
  return { heightAt };
};
