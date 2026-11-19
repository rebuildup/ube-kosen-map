/**
 * Stair-step generation, ported from the legacy implementation.
 *
 * Produces box specs ({x, y, z, rotY, sx, sy, sz}) in model space; the
 * renderer turns each spec into an instanced box. Pure data only.
 */

import {
  drawingToModel,
  METERS_PER_DRAWING_UNIT,
  METERS_PER_MODEL_UNIT,
  MODEL_UNITS_PER_DRAWING_UNIT,
  TERRAIN_STEP_MODEL,
} from "./drawingTransform";

/** One rendered step box, in model space (y-up, north = -Z). */
export interface StepSpec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotY: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
}

/** Region spec: [cx, cy, width, height, angleDeg] in drawing coordinates. */
export type StepRegion = readonly [number, number, number, number, number];

const DU = MODEL_UNITS_PER_DRAWING_UNIT; // drawing units -> model units
const M_PER_UNIT = METERS_PER_DRAWING_UNIT; // drawing units -> meters
const M_PER_MODEL = METERS_PER_MODEL_UNIT; // model units -> meters

/**
 * Simple stacked steps for outdoor terrain transitions (legacy addSteps).
 * `y0` and `totalH` are in model units; the region is in drawing coords.
 */
export const addStepBoxes = (
  list: StepSpec[],
  region: StepRegion,
  y0: number,
  totalH: number,
  nSteps: number,
): void => {
  const [cx, cy, w, h, angDeg] = region;
  const ang = (angDeg * Math.PI) / 180;
  const tx = Math.cos(ang + Math.PI / 2);
  const ty = Math.sin(ang + Math.PI / 2);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const flight = Math.abs(w * tx) + Math.abs(h * ty);
  const width = Math.abs(w * ux) + Math.abs(h * uy);
  if (flight < 0.6 || width < 0.6) return;
  const c = drawingToModel(cx, cy);
  const phi = Math.atan2(ty, tx);
  for (let k = 0; k < nSteps; k++) {
    const hh = (totalH * (k + 1)) / nSteps;
    const along = -flight / 2 + ((k + 0.5) * flight) / nSteps;
    list.push({
      x: c.x + tx * along * DU,
      z: c.z + ty * along * DU,
      y: y0 + hh / 2,
      rotY: -phi,
      sx: (flight / nSteps) * DU,
      sy: hh,
      sz: width * DU,
    });
  }
};

/**
 * Stair inside a stairwell: straight flight when it fits, otherwise a
 * landing-and-return (two-lane) stair (legacy buildStair).
 * `flightU`/`widthU` are drawing units; heights are model units.
 */
export const addStairBoxes = (
  list: StepSpec[],
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  ux: number,
  uy: number,
  flightU: number,
  widthU: number,
  y0: number,
  totalH: number,
): void => {
  const flight = flightU;
  const width = widthU;
  if (flight < 0.6 || width < 0.6) return;
  const c = drawingToModel(cx, cy);
  const phi = Math.atan2(ty, tx);
  const RISERS = Math.max(10, Math.round((totalH * M_PER_MODEL) / 0.19));
  const HALF = Math.floor(RISERS / 2);
  const flightM = flight * M_PER_UNIT;
  const widthM = width * M_PER_UNIT;
  const straightOK = flightM >= (RISERS - 1) * 0.26 + 0.75 && widthM <= 1.9;
  if (straightOK) {
    for (let k = 0; k < RISERS; k++) {
      const hh = (totalH * (k + 1)) / RISERS;
      const along = -flight / 2 + ((k + 0.5) * flight) / RISERS;
      list.push({
        x: c.x + tx * along * DU,
        z: c.z + ty * along * DU,
        y: y0 + hh / 2,
        rotY: -phi,
        sx: (flight / RISERS) * DU,
        sy: hh,
        sz: width * DU,
      });
    }
    return;
  }
  const landing = Math.min(1.15 / M_PER_UNIT, flight * 0.3);
  const runLen = flight - landing;
  const laneW = width / 2;
  for (let i = 0; i < HALF; i++) {
    // Up flight: lower lane ascends toward +t.
    const hh = (totalH * (i + 1)) / RISERS;
    const along = -flight / 2 + ((i + 0.5) * runLen) / HALF;
    list.push({
      x: c.x + (tx * along + ux * (-laneW / 2)) * DU,
      z: c.z + (ty * along + uy * (-laneW / 2)) * DU,
      y: y0 + hh / 2,
      rotY: -phi,
      sx: (runLen / HALF) * DU,
      sy: hh,
      sz: laneW * DU,
    });
  }
  // Landing: full width at mid height.
  list.push({
    x: c.x + tx * (flight / 2 - landing / 2) * DU,
    z: c.z + ty * (flight / 2 - landing / 2) * DU,
    y: y0 + totalH / 4,
    rotY: -phi,
    sx: landing * DU,
    sy: totalH / 2,
    sz: width * DU,
  });
  for (let i = 0; i < HALF; i++) {
    // Return flight: other lane ascends toward -t.
    const hh = (totalH * (HALF + i + 1)) / RISERS;
    const along = flight / 2 - landing - ((i + 0.5) * runLen) / HALF;
    list.push({
      x: c.x + (tx * along + ux * (laneW / 2)) * DU,
      z: c.z + (ty * along + uy * (laneW / 2)) * DU,
      y: y0 + hh / 2,
      rotY: -phi,
      sx: (runLen / HALF) * DU,
      sy: hh,
      sz: laneW * DU,
    });
  }
};

/** Region-based stair convenience (legacy addStairs). */
export const addRegionStairs = (
  list: StepSpec[],
  region: StepRegion,
  y0: number,
  totalH: number,
): void => {
  const [cx, cy, w, h, angDeg] = region;
  const ang = (angDeg * Math.PI) / 180;
  const tx = Math.cos(ang + Math.PI / 2);
  const ty = Math.sin(ang + Math.PI / 2);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const flight = Math.abs(w * tx) + Math.abs(h * ty);
  const width = Math.abs(w * ux) + Math.abs(h * uy);
  addStairBoxes(list, cx, cy, tx, ty, ux, uy, flight, width, y0, totalH);
};

/** Outdoor steps from DATA.osteps: one layer-step rise, 4 steps. */
export const outdoorSteps = (
  osteps: readonly { readonly r: StepRegion; readonly l: number }[],
): StepSpec[] => {
  const list: StepSpec[] = [];
  for (const o of osteps) {
    addStepBoxes(list, o.r, o.l * TERRAIN_STEP_MODEL, TERRAIN_STEP_MODEL, 4);
  }
  return list;
};
