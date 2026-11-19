/**
 * Complemented building outlines traced from the 学生便覧 building-location
 * diagram (publishable per docs/campus3d-data-policy.md). Only exterior
 * footprints are included: dormitory interior plans derived from the
 * 寮生手帳 are restricted and intentionally absent.
 *
 * Ported from the legacy implementation's outline constants
 * (E_POLY/B_POLY/C_POLY/Y_POLY on feat/campus-3d-model).
 */

import type { BuildingData, CampusModelData, DrawingPolygon } from "../types";

const E_POLY: DrawingPolygon = [
  [144.6, 273.7],
  [202.9, 329.9],
  [193.3, 339.8],
  [135.1, 283.5],
];
const B_POLY: DrawingPolygon = [
  [99.7, 307.0],
  [126.3, 333.0],
  [119.1, 340.3],
  [107.5, 328.9],
  [109.9, 326.5],
  [95.0, 311.8],
];
const C_POLY: DrawingPolygon = [
  [154.1, 323.6],
  [195.4, 360.7],
  [187.4, 369.7],
  [146.1, 332.5],
];
const Y_POLY: DrawingPolygon = [
  [132.6, 321.1],
  [145.8, 307.9],
  [155.5, 317.6],
  [142.2, 330.8],
];

/** Outline-only building data for the four complemented structures. */
export const COMPLEMENTED_BUILDINGS: Readonly<Record<string, BuildingData>> = {
  eroom: { f: [E_POLY] },
  bbld: { f: [B_POLY] },
  cbld: { f: [C_POLY] },
  yokujo: { f: [Y_POLY] },
};

/** Terrain layer each complemented building sits on (legacy DATA.bases). */
export const COMPLEMENTED_BASES: Readonly<Record<string, number>> = {
  eroom: 4,
  bbld: 4,
  cbld: 4,
  yokujo: 4,
};

/**
 * Merge the complemented outlines into the extracted dataset. The result is
 * the public model dataset: dormitory interiors are not part of it.
 */
export const withComplementedBuildings = (
  data: CampusModelData,
): CampusModelData => ({
  ...data,
  bld: { ...data.bld, ...COMPLEMENTED_BUILDINGS },
  bases: { ...data.bases, ...COMPLEMENTED_BASES },
});
