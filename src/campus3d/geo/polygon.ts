/**
 * 2D geometry helpers on drawing coordinates (see types.ts).
 * Ported from the legacy campus-3d implementation; kept renderer-free so the
 * classification and generation logic stays testable.
 */

import type { DrawingPoint, DrawingPolygon, DrawingSegment } from "../types";
import { GEO } from "./drawingTransform";

/** East direction in drawing coordinates (same constant the transform uses). */
const EAST_DRAW = [GEO.eastCos, GEO.eastSin] as const;

export const pointInPolygon = (
  poly: DrawingPolygon,
  x: number,
  y: number,
): boolean => {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y) {
      const xin = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < xin) inside = !inside;
    }
  }
  return inside;
};

/** Distance from point to polygon boundary; 0 when inside. */
export const distanceToPolygon = (
  poly: DrawingPolygon,
  x: number,
  y: number,
): number => {
  if (pointInPolygon(poly, x, y)) return 0;
  let best = Number.POSITIVE_INFINITY;
  const n = poly.length;
  for (let j = 0; j < n; j++) {
    const i = j;
    const ax = poly[i][0];
    const ay = poly[i][1];
    const bx = poly[(i + 1) % n][0];
    const by = poly[(i + 1) % n][1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2
      ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2))
      : 0;
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
    if (d < best) best = d;
  }
  return best;
};

export const polygonBBox = (
  poly: DrawingPolygon,
): readonly [number, number, number, number] => {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
};

export const polygonCentroid = (poly: DrawingPolygon): DrawingPoint => {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / poly.length, sy / poly.length];
};

/** The fill polygon with the largest bounding-box area. */
export const mainPolygon = (
  polys: readonly DrawingPolygon[],
): DrawingPolygon | null => {
  let best: DrawingPolygon | null = null;
  let bestArea = -1;
  for (const f of polys) {
    const bb = polygonBBox(f);
    const area = (bb[2] - bb[0]) * (bb[3] - bb[1]);
    if (area > bestArea) {
      bestArea = area;
      best = f;
    }
  }
  return best;
};

export interface DrawingFrame {
  readonly cx: number;
  readonly cy: number;
  readonly ux: number;
  readonly uy: number;
  readonly vx: number;
  readonly vy: number;
  readonly umin: number;
  readonly umax: number;
  readonly vmin: number;
  readonly vmax: number;
  /** Frame coords (relative to centroid) -> drawing coords. */
  readonly point: (u: number, v: number) => DrawingPoint;
}

/**
 * Long-axis frame of a polygon (u points roughly east, v is u's left-hand
 * side). The axis is chosen as the edge direction whose bounding rectangle
 * is smallest — not the longest single edge — so a long side split into
 * segments does not flip the frame. Ported from the legacy frameOf.
 */
export const frameOf = (poly: DrawingPolygon): DrawingFrame => {
  let best: { ux: number; uy: number; area: number; ur: number } | null = null;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    let ex = b[0] - a[0];
    let ey = b[1] - a[1];
    const el = Math.hypot(ex, ey);
    if (el < 0.5) continue;
    ex /= el;
    ey /= el;
    let u0 = Number.POSITIVE_INFINITY;
    let u1 = Number.NEGATIVE_INFINITY;
    let v0 = Number.POSITIVE_INFINITY;
    let v1 = Number.NEGATIVE_INFINITY;
    for (const p of poly) {
      const du = p[0] * ex + p[1] * ey;
      const dv = p[0] * -ey + p[1] * ex;
      if (du < u0) u0 = du;
      if (du > u1) u1 = du;
      if (dv < v0) v0 = dv;
      if (dv > v1) v1 = dv;
    }
    const area = (u1 - u0) * (v1 - v0);
    const ur = u1 - u0;
    if (
      !best ||
      area < best.area * 0.98 ||
      (area < best.area * 1.02 && ur > best.ur)
    ) {
      best = { ux: ex, uy: ey, area, ur };
    }
  }
  if (!best) throw new Error("frameOf: polygon has no usable edge");
  let { ux, uy } = best;
  // Orient u toward drawing-space east so frames are comparable.
  if (ux * EAST_DRAW[0] + uy * EAST_DRAW[1] < 0) {
    ux = -ux;
    uy = -uy;
  }
  const vx = -uy;
  const vy = ux;
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p[0];
    cy += p[1];
  }
  cx /= n;
  cy /= n;
  let umin = Number.POSITIVE_INFINITY;
  let umax = Number.NEGATIVE_INFINITY;
  let vmin = Number.POSITIVE_INFINITY;
  let vmax = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    const du = (p[0] - cx) * ux + (p[1] - cy) * uy;
    const dv = (p[0] - cx) * vx + (p[1] - cy) * vy;
    if (du < umin) umin = du;
    if (du > umax) umax = du;
    if (dv < vmin) vmin = dv;
    if (dv > vmax) vmax = dv;
  }
  const point = (u: number, v: number): DrawingPoint => [
    cx + ux * u + vx * v,
    cy + uy * u + vy * v,
  ];
  return { cx, cy, ux, uy, vx, vy, umin, umax, vmin, vmax, point };
};

export const segmentLength = (s: DrawingSegment): number =>
  Math.hypot(s[2] - s[0], s[3] - s[1]);

/** Segment angle folded into [0, PI). */
export const segmentAngle = (s: DrawingSegment): number =>
  Math.atan2(s[3] - s[1], s[2] - s[0]) % Math.PI;

/** Angular difference folded into [0, PI/2]. */
export const angleDelta = (a: number, b: number): number => {
  const d = Math.abs(a - b) % Math.PI;
  return Math.min(d, Math.PI - d);
};
