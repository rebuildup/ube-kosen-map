/**
 * Room partition extraction from floor-plan linework.
 *
 * The source floor plans (campus-map3.svg groups, extracted into
 * CampusModelData `fl` entries) draw each floor as a filled plate polygon
 * plus stroke linework: interior wall segments and stair treads. This module
 * turns that linework into actual room footprints:
 *
 *   plate fills + wall segments  ->  planar arrangement  ->  faces
 *   faces inside a plate         ->  room / corridor / stair polygons
 *
 * The result is exact polygon geometry in drawing coordinates — not the
 * former 1.0-unit grid approximation. Wall lines are treated as zero-width
 * barriers, so room polygons represent the clear dimensions between drawn
 * wall lines; real wall thickness is not modeled (see
 * docs/campus3d-provenance.md for the accuracy contract).
 *
 * Pure data only: no THREE, no DOM.
 */

import type { DrawingPoint, DrawingPolygon, DrawingSegment } from "../types";
import { pointInPolygon } from "./polygon";

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

/** One bounded face of the floor-plan arrangement. */
export interface RoomFace {
  /** Outer boundary ring (closed implicitly; last point != first). */
  readonly outer: readonly DrawingPoint[];
  /** Hole rings inside `outer` (courtyards, light wells). */
  readonly holes: readonly (readonly DrawingPoint[])[];
  /** Face area in drawing units squared (outer minus holes). */
  readonly areaU2: number;
}

export type RoomPartitionKind = "room" | "corridor" | "stair" | "sliver";

/** A selectable space on a floor: one face, or several faces of one stair. */
export interface PartitionedRoom {
  readonly kind: RoomPartitionKind;
  /** Index into the floor's `st` array when kind === "stair", else -1. */
  readonly stairIndex: number;
  readonly faces: readonly RoomFace[];
  readonly areaU2: number;
  /** Area centroid in drawing coordinates. */
  readonly centroid: DrawingPoint;
  /** Bounding box [x0, y0, x1, y1] in drawing coordinates. */
  readonly bbox: readonly [number, number, number, number];
  /**
   * Closed cycles of wall linework strictly inside this room's faces that
   * did not partition it — evidence the source drew a subdivision the
   * extractor missed. Zero means the face faithfully matches the linework.
   */
  readonly interiorClosedLoops: number;
}

export interface FloorPartitionStats {
  /** Wall segments consumed as barriers. */
  readonly wallSegments: number;
  /** Linework segments dropped as stair treads. */
  readonly stairSegments: number;
  /** Bounded faces found inside the plate union. */
  readonly faces: number;
  /** Faces kept but too small to be real rooms (drafting slivers). */
  readonly slivers: number;
  /** Hole walks that could not be attached to a shell. */
  readonly orphanHoles: number;
  /** Sum of kept face areas (drawing units^2). */
  readonly faceAreaU2: number;
  /** Sum of plate fill areas (drawing units^2). */
  readonly plateAreaU2: number;
  /** (faceArea - plateArea) / plateArea; should be ~0. */
  readonly areaDeltaRatio: number;
  /** Total closed interior wall loops found inside kept faces. */
  readonly interiorClosedLoops: number;
}

export interface FloorPartition {
  readonly rooms: readonly PartitionedRoom[];
  readonly stats: FloorPartitionStats;
}

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

/**
 * Vertex merge tolerance in drawing units (~6.7 cm at 0.84 m/unit).
 * Hand-drawn SVG endpoints that should coincide differ by less than this;
 * door openings are >= ~0.8 units wide, far above the tolerance.
 */
const SNAP = 0.08;
/** Faces smaller than this (drawing units^2, ~0.085 m^2) are slivers. */
const SLIVER_AREA_U2 = 0.12;
/** Faces narrower than ~0.42 m are wall pockets, not rooms. */
const SLIVER_MIN_DIM_U = 0.5;
/** Margin when testing whether a segment is stair treads. */
const STAIR_MARGIN = 0.15;

/* ------------------------------------------------------------------ */
/* Small geometry helpers                                              */
/* ------------------------------------------------------------------ */

const cross = (ax: number, ay: number, bx: number, by: number): number =>
  ax * by - ay * bx;

const dist = (a: DrawingPoint, b: DrawingPoint): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Shoelace signed area; sign follows the drawing (y-down) coordinate system. */
const ringArea = (ring: readonly DrawingPoint[]): number => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

const ringBBox = (
  ring: readonly DrawingPoint[],
): readonly [number, number, number, number] => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of ring) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
};

const ringCentroid = (ring: readonly DrawingPoint[]): DrawingPoint => {
  let sx = 0;
  let sy = 0;
  for (const p of ring) {
    sx += p[0];
    sy += p[1];
  }
  return [sx / ring.length, sy / ring.length];
};

/* ------------------------------------------------------------------ */
/* Stair regions                                                       */
/* ------------------------------------------------------------------ */

export type StairRegionLike =
  | readonly [number, number, number, number, number]
  | {
      readonly g: number;
      readonly cx: number;
      readonly cy: number;
      readonly ang: number;
      readonly len: number;
      readonly wid: number;
    };

const stairContains = (
  region: StairRegionLike,
  x: number,
  y: number,
  margin: number,
): boolean => {
  let cx: number;
  let cy: number;
  let ax: number;
  let ay: number;
  let bx: number;
  let by: number;
  let h1: number;
  let h2: number;
  if ("g" in region) {
    cx = region.cx;
    cy = region.cy;
    ax = Math.sin(region.ang);
    ay = -Math.cos(region.ang);
    bx = Math.cos(region.ang);
    by = Math.sin(region.ang);
    h1 = region.wid / 2 + margin;
    h2 = region.len / 2 + margin;
  } else {
    const a = (region[4] * Math.PI) / 180;
    cx = region[0];
    cy = region[1];
    ax = Math.cos(a);
    ay = Math.sin(a);
    bx = Math.cos(a + Math.PI / 2);
    by = Math.sin(a + Math.PI / 2);
    h1 = region[2] / 2 + margin;
    h2 = region[3] / 2 + margin;
  }
  const dx = x - cx;
  const dy = y - cy;
  return Math.abs(dx * ax + dy * ay) <= h1 && Math.abs(dx * bx + dy * by) <= h2;
};

/**
 * Split floor linework into wall barriers and stair treads. A segment is
 * treads when both endpoints fall inside a stair region (expanded by
 * STAIR_MARGIN so tread ends near the drawn boundary are still caught).
 */
export const splitWallAndStairSegments = (
  walls: readonly DrawingSegment[],
  stairs: readonly StairRegionLike[],
): { walls: DrawingSegment[]; stairSegments: number } => {
  if (!stairs.length) return { walls: [...walls], stairSegments: 0 };
  const kept: DrawingSegment[] = [];
  let dropped = 0;
  for (const s of walls) {
    const ax = s[0];
    const ay = s[1];
    const bx = s[2];
    const by = s[3];
    // Both endpoints must be inside the SAME stair region to be treads.
    const sameRegion = stairs.some(
      (r) =>
        stairContains(r, ax, ay, STAIR_MARGIN) &&
        stairContains(r, bx, by, STAIR_MARGIN),
    );
    if (sameRegion) {
      dropped++;
    } else {
      kept.push(s);
    }
  }
  return { walls: kept, stairSegments: dropped };
};

/* ------------------------------------------------------------------ */
/* Barrier preparation                                                */
/* ------------------------------------------------------------------ */

/**
 * How far a wall tip may reach to meet another barrier, in drawing units
 * (~29 cm at 0.84 m/unit). Floor-plan walls are drawn to the wall face, so
 * partitions stop a fraction of a unit short of the crossing wall or the
 * plate edge; without this reach the arrangement leaks and rooms merge.
 * The bound is well below any doorway width, so real openings stay open.
 */
const EXTEND_MAX = 0.35;

/**
 * Extend each interior wall segment's endpoints along the segment's own
 * axis until they touch another barrier (wall or plate edge). Never
 * shortens a segment; endpoints that already touch stay put.
 */
export const extendWallsToMeet = (
  walls: readonly DrawingSegment[],
  targets: readonly DrawingSegment[],
): DrawingSegment[] => {
  const hit = (
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    tx1: number,
    ty1: number,
    tx2: number,
    ty2: number,
  ): number => {
    const sx = tx2 - tx1;
    const sy = ty2 - ty1;
    const denom = cross(dx, dy, sx, sy);
    if (Math.abs(denom) < 1e-12) return Number.POSITIVE_INFINITY;
    const qpx = tx1 - ox;
    const qpy = ty1 - oy;
    const t = cross(qpx, qpy, sx, sy) / denom;
    const u = cross(qpx, qpy, dx, dy) / denom;
    if (t <= 1e-9 || t > EXTEND_MAX || u < -1e-9 || u > 1 + 1e-9) {
      return Number.POSITIVE_INFINITY;
    }
    return t;
  };
  // Distance from point to segment (0 when on it).
  const pointSegDist = (
    px: number,
    py: number,
    tx1: number,
    ty1: number,
    tx2: number,
    ty2: number,
  ): number => {
    const sx = tx2 - tx1;
    const sy = ty2 - ty1;
    const l2 = sx * sx + sy * sy;
    const t = l2
      ? Math.max(0, Math.min(1, ((px - tx1) * sx + (py - ty1) * sy) / l2))
      : 0;
    return Math.hypot(tx1 + sx * t - px, ty1 + sy * t - py);
  };
  const TOUCH = 0.06;
  return walls.map((s) => {
    const [x1, y1, x2, y2] = s;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return s;
    const ux = dx / len;
    const uy = dy / len;
    // Endpoint a extends opposite to the segment direction; b along it.
    const ends: { origin: DrawingPoint; dir: DrawingPoint }[] = [
      { origin: [x1, y1], dir: [-ux, -uy] },
      { origin: [x2, y2], dir: [ux, uy] },
    ];
    const out: number[] = [x1, y1, x2, y2];
    ends.forEach((e, ei) => {
      // Already touching a barrier: leave the endpoint alone.
      const touching = targets.some(
        (t) =>
          !(t[0] === s[0] && t[1] === s[1] && t[2] === s[2] && t[3] === s[3]) &&
          pointSegDist(e.origin[0], e.origin[1], ...t) < TOUCH,
      );
      if (touching) return;
      let best = Number.POSITIVE_INFINITY;
      for (const t of targets) {
        // Skip the segment itself (index ei*? — compare coordinates).
        if (t[0] === s[0] && t[1] === s[1] && t[2] === s[2] && t[3] === s[3]) {
          continue;
        }
        const d = hit(e.origin[0], e.origin[1], e.dir[0], e.dir[1], ...t);
        if (d < best) best = d;
      }
      if (best === Number.POSITIVE_INFINITY) return;
      const nx = e.origin[0] + e.dir[0] * best;
      const ny = e.origin[1] + e.dir[1] * best;
      if (ei === 0) {
        out[0] = nx;
        out[1] = ny;
      } else {
        out[2] = nx;
        out[3] = ny;
      }
    });
    return [out[0], out[1], out[2], out[3]] as DrawingSegment;
  });
};

/* ------------------------------------------------------------------ */
/* Arrangement construction                                            */
/* ------------------------------------------------------------------ */

interface RawSeg {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

const rawSeg = (s: DrawingSegment): RawSeg => ({
  ax: s[0],
  ay: s[1],
  bx: s[2],
  by: s[3],
});

/**
 * Split segments at every intersection (including endpoint touches and
 * collinear overlaps), then merge vertices closer than SNAP.
 * Returns atomic segments as pairs of snapped vertex ids.
 */
export const buildAtomicGraph = (
  input: readonly DrawingSegment[],
): { verts: DrawingPoint[]; segs: readonly (readonly [number, number])[] } => {
  const raws = input.map(rawSeg);
  const n = raws.length;
  const splits: number[][] = raws.map(() => [0, 1]);

  const addSplit = (i: number, t: number) => {
    if (t > 1e-9 && t < 1 - 1e-9) splits[i].push(t);
  };

  for (let i = 0; i < n; i++) {
    const a = raws[i];
    const rx = a.bx - a.ax;
    const ry = a.by - a.ay;
    for (let j = i + 1; j < n; j++) {
      const b = raws[j];
      const sx = b.bx - b.ax;
      const sy = b.by - b.ay;
      const denom = cross(rx, ry, sx, sy);
      const qpx = b.ax - a.ax;
      const qpy = b.ay - a.ay;
      if (Math.abs(denom) > 1e-12) {
        const t = cross(qpx, qpy, sx, sy) / denom;
        const u = cross(qpx, qpy, rx, ry) / denom;
        if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
          addSplit(i, Math.min(1, Math.max(0, t)));
          addSplit(j, Math.min(1, Math.max(0, u)));
        }
        continue;
      }
      // Parallel: only collinear overlaps matter.
      if (Math.abs(cross(qpx, qpy, rx, ry)) > 1e-9) continue;
      const len2 = rx * rx + ry * ry;
      if (len2 < 1e-18) continue;
      // Project b's endpoints onto a's parameter line.
      for (const [px, py] of [
        [b.ax, b.ay],
        [b.bx, b.by],
      ] as const) {
        const t = ((px - a.ax) * rx + (py - a.ay) * ry) / len2;
        // Distance from the projected point back to (px,py) ~ 0 (collinear).
        if (t > 1e-9 && t < 1 - 1e-9) {
          const dx = a.ax + rx * t - px;
          const dy = a.ay + ry * t - py;
          if (Math.hypot(dx, dy) < SNAP) addSplit(i, t);
        }
      }
      const len2b = sx * sx + sy * sy;
      if (len2b > 1e-18) {
        for (const [px, py] of [
          [a.ax, a.ay],
          [a.bx, a.by],
        ] as const) {
          const u = ((px - b.ax) * sx + (py - b.ay) * sy) / len2b;
          if (u > 1e-9 && u < 1 - 1e-9) {
            const dx = b.ax + sx * u - px;
            const dy = b.ay + sy * u - py;
            if (Math.hypot(dx, dy) < SNAP) addSplit(j, u);
          }
        }
      }
    }
  }

  // Emit atomic sub-segments with exact endpoints.
  const atomic: [DrawingPoint, DrawingPoint][] = [];
  for (let i = 0; i < n; i++) {
    const a = raws[i];
    const rx = a.bx - a.ax;
    const ry = a.by - a.ay;
    const ts = [...new Set(splits[i].map((t) => +t.toFixed(9)))].sort(
      (x, y) => x - y,
    );
    for (let k = 0; k + 1 < ts.length; k++) {
      const p = [a.ax + rx * ts[k], a.ay + ry * ts[k]] as DrawingPoint;
      const q = [a.ax + rx * ts[k + 1], a.ay + ry * ts[k + 1]] as DrawingPoint;
      if (dist(p, q) > 1e-7) atomic.push([p, q]);
    }
  }

  // Snap endpoints: union-find over points within SNAP.
  const parent = new Map<string, string>();
  const pts: DrawingPoint[] = [];
  const keyOf = (p: DrawingPoint) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = k;
    while (parent.get(c) !== c) {
      const nx = parent.get(c)!;
      parent.set(c, r);
      c = nx;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  // Spatial hash for neighbor lookup.
  const cell = SNAP;
  const grid = new Map<string, string[]>();
  const gkey = (x: number, y: number) =>
    `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const [p, q] of atomic) {
    for (const pt of [p, q]) {
      const k = keyOf(pt);
      if (parent.has(k)) continue;
      parent.set(k, k);
      pts.push(pt);
      const gx = Math.floor(pt[0] / cell);
      const gy = Math.floor(pt[1] / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const other of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
            const op = pts[Number(other)];
            if (dist(op, pt) <= SNAP) union(k, keyOf(op));
          }
        }
      }
      const gk = gkey(pt[0], pt[1]);
      const arr = grid.get(gk) ?? [];
      arr.push(String(pts.length - 1));
      grid.set(gk, arr);
    }
  }
  // Canonical position per cluster = member average.
  const sum = new Map<string, { x: number; y: number; n: number }>();
  const canon = new Map<string, DrawingPoint>();
  for (const pt of pts) {
    const r = find(keyOf(pt));
    const s = sum.get(r) ?? { x: 0, y: 0, n: 0 };
    s.x += pt[0];
    s.y += pt[1];
    s.n++;
    sum.set(r, s);
  }
  for (const [r, s] of sum) canon.set(r, [s.x / s.n, s.y / s.n]);

  // Rebuild segments between canonical vertices; dedupe.
  const vid = new Map<string, number>();
  const verts: DrawingPoint[] = [];
  const vidOf = (p: DrawingPoint): number => {
    const r = find(keyOf(p));
    const cp = canon.get(r)!;
    const k = `${cp[0].toFixed(5)},${cp[1].toFixed(5)}`;
    let id = vid.get(k);
    if (id === undefined) {
      id = verts.length;
      vid.set(k, id);
      verts.push(cp);
    }
    return id;
  };
  const seen = new Set<string>();
  const segs: [number, number][] = [];
  for (const [p, q] of atomic) {
    const a = vidOf(p);
    const b = vidOf(q);
    if (a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(k)) continue;
    seen.add(k);
    segs.push([a, b]);
  }
  return { verts, segs };
};

/* ------------------------------------------------------------------ */
/* Face extraction via directed-edge traversal                        */
/* ------------------------------------------------------------------ */

/**
 * Trace every directed-edge orbit. Each orbit is one boundary walk of a
 * face (or the unbounded exterior). Returns walks as vertex-id lists.
 */
export const traceFaces = (
  verts: readonly DrawingPoint[],
  segs: readonly (readonly [number, number])[],
): number[][] => {
  // Directed edges: even id = a->b, odd = b->a for seg index i.
  const edgeFrom = new Int32Array(segs.length * 2);
  const edgeTo = new Int32Array(segs.length * 2);
  const adj: number[][] = verts.map(() => []);
  segs.forEach(([a, b], i) => {
    edgeFrom[2 * i] = a;
    edgeTo[2 * i] = b;
    edgeFrom[2 * i + 1] = b;
    edgeTo[2 * i + 1] = a;
    adj[a].push(2 * i);
    adj[b].push(2 * i + 1);
  });
  for (const list of adj) {
    list.sort((ea, eb) => {
      const ax = verts[edgeTo[ea]][0] - verts[edgeFrom[ea]][0];
      const ay = verts[edgeTo[ea]][1] - verts[edgeFrom[ea]][1];
      const bx = verts[edgeTo[eb]][0] - verts[edgeFrom[eb]][0];
      const by = verts[edgeTo[eb]][1] - verts[edgeFrom[eb]][1];
      return Math.atan2(ay, ax) - Math.atan2(by, bx);
    });
  }
  const twin = (e: number) => e ^ 1;
  const visited = new Uint8Array(segs.length * 2);
  const walks: number[][] = [];
  const limit = segs.length * 2 + 4;
  for (let start = 0; start < edgeFrom.length; start++) {
    if (visited[start]) continue;
    const walk: number[] = [];
    let e = start;
    let guard = 0;
    while (!visited[e] && guard++ < limit) {
      visited[e] = 1;
      const u = edgeFrom[e];
      const v = edgeTo[e];
      walk.push(u);
      const list = adj[v];
      if (!list.length) break;
      const ti = list.indexOf(twin(e));
      // Next edge keeps the same face on the left: the outgoing edge just
      // clockwise of the twin in the CCW-sorted adjacency (verified by the
      // area-conservation tests in roomPartition.test.ts).
      const next = list[(ti - 1 + list.length) % list.length];
      e = next;
      if (e === start) break;
    }
    if (walk.length >= 3) walks.push(walk);
  }
  return walks;
};

/* ------------------------------------------------------------------ */
/* Walk cleanup and face assembly                                     */
/* ------------------------------------------------------------------ */

const cleanRing = (pts: readonly DrawingPoint[]): DrawingPoint[] => {
  // Drop consecutive duplicates, then collinear vertices, then spurs.
  const dedup: DrawingPoint[] = [];
  for (const p of pts) {
    const last = dedup[dedup.length - 1];
    if (!last || dist(last, p) > 1e-7) dedup.push(p);
  }
  if (dedup.length > 1 && dist(dedup[0], dedup[dedup.length - 1]) < 1e-7) {
    dedup.pop();
  }
  const noCollinear = (ring: DrawingPoint[]): DrawingPoint[] => {
    const out: DrawingPoint[] = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[(i - 1 + n) % n];
      const b = ring[i];
      const c = ring[(i + 1) % n];
      const c1 = cross(b[0] - a[0], b[1] - a[1], c[0] - b[0], c[1] - b[1]);
      // Keep the point unless it is (near-)collinear between neighbours.
      const between =
        Math.min(a[0], c[0]) - 1e-7 <= b[0] &&
        b[0] <= Math.max(a[0], c[0]) + 1e-7 &&
        Math.min(a[1], c[1]) - 1e-7 <= b[1] &&
        b[1] <= Math.max(a[1], c[1]) + 1e-7;
      if (Math.abs(c1) > 1e-9 || !between) out.push(b);
    }
    return out;
  };
  const ring = noCollinear(dedup);
  // Remove immediate backtracks a->b->a (dangling wall stubs): when the
  // vertex two steps ahead coincides with the current one, drop the spur.
  let changed = true;
  while (changed && ring.length > 3) {
    changed = false;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const c = ring[(i + 2) % n];
      if (dist(a, c) < 1e-7) {
        // Remove b (i+1) and the duplicate a (i+2); keep a single a.
        const idx = [(i + 1) % n, (i + 2) % n].sort((x, y) => y - x);
        ring.splice(idx[0], 1);
        ring.splice(idx[1], 1);
        changed = true;
        break;
      }
    }
  }
  return noCollinear(ring);
};

/**
 * Point inside a face: inside `outer` and outside every hole ring. Tries
 * the vertex centroid first, then edge midpoints nudged toward the face
 * interior on both sides.
 */
export const interiorPoint = (
  outer: readonly DrawingPoint[],
  holes: readonly (readonly DrawingPoint[])[] = [],
): DrawingPoint | null => {
  const inFace = (p: DrawingPoint) =>
    pointInPolygon(outer as DrawingPolygon, p[0], p[1]) &&
    !holes.some((h) => pointInPolygon(h as DrawingPolygon, p[0], p[1]));
  const c = ringCentroid(outer);
  if (inFace(c)) return c;
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const a = outer[i];
    const b = outer[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    for (const s of [1, -1]) {
      const px = mx + (-dy / l) * s * 0.05;
      const py = my + (dx / l) * s * 0.05;
      if (inFace([px, py])) return [px, py];
    }
  }
  return null;
};

export interface WalkInfo {
  readonly pts: DrawingPoint[];
  readonly signedArea: number;
  readonly area: number;
  readonly bbox: readonly [number, number, number, number];
  readonly centroid: DrawingPoint;
}

export const faceFromWalks = (
  verts: readonly DrawingPoint[],
  walks: readonly number[][],
): {
  faces: RoomFace[];
  orphanHoles: number;
  /** Geometry of unattached negative walks, for diagnostics. */
  orphanRings: WalkInfo[];
} => {
  const infos: WalkInfo[] = walks
    .map((w) => {
      const pts = cleanRing(w.map((id) => verts[id]));
      if (pts.length < 3) return null;
      const signed = ringArea(pts);
      if (Math.abs(signed) < 1e-9) return null;
      return {
        pts,
        signedArea: signed,
        area: Math.abs(signed),
        bbox: ringBBox(pts),
        centroid: ringCentroid(pts),
      };
    })
    .filter((x): x is WalkInfo => x !== null);

  // In drawing (y-down) coordinates the bounded faces produced by the
  // traversal have positive shoelace area; hole walks and the unbounded
  // exterior walk are negative. Verified by roomPartition.test.ts area
  // conservation. Exterior walks can never attach as holes: no bounded
  // shell is strictly larger than the exterior boundary that contains it.
  const shells = infos.filter((i) => i.signedArea > 0);
  const holes = infos.filter((i) => i.signedArea < 0);

  // Attach each hole to the smallest shell that strictly contains it.
  const holeRings = new Map<WalkInfo, DrawingPoint[][]>();
  const orphanRings: WalkInfo[] = [];
  for (const h of holes) {
    let best: WalkInfo | null = null;
    for (const s of shells) {
      if (s.area <= h.area + 1e-6) continue;
      if (
        !pointInPolygon(s.pts as DrawingPolygon, h.centroid[0], h.centroid[1])
      )
        continue;
      if (!best || s.area < best.area) best = s;
    }
    if (best) {
      const arr = holeRings.get(best) ?? [];
      arr.push(h.pts);
      holeRings.set(best, arr);
    } else {
      orphanRings.push(h);
    }
  }

  const faces: RoomFace[] = [];
  for (const s of shells) {
    const hs = holeRings.get(s) ?? [];
    const holeArea = hs.reduce((a, h) => a + Math.abs(ringArea(h)), 0);
    faces.push({
      outer: s.pts,
      holes: hs,
      areaU2: s.area - holeArea,
    });
  }
  return { faces, orphanHoles: orphanRings.length, orphanRings };
};

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Partition one floor's plate fills into room faces using its wall
 * linework. `fills` are the floor-slab polygons, `walls` the interior
 * linework segments, `stairs` the stair symbol regions — all in drawing
 * coordinates (see types.ts / campus3d-provenance.md).
 */
export const partitionFloor = (
  fills: readonly DrawingPolygon[],
  walls: readonly DrawingSegment[],
  stairs: readonly StairRegionLike[],
): FloorPartition => {
  const { walls: barrierWalls, stairSegments } = splitWallAndStairSegments(
    walls,
    stairs,
  );

  // Fill boundary edges are barriers too; edges shared by two plates of
  // the same floor are interior seams, not walls.
  const edgeCount = new Map<string, number>();
  const ek = (a: DrawingPoint, b: DrawingPoint) => {
    const ka = `${a[0].toFixed(4)},${a[1].toFixed(4)}`;
    const kb = `${b[0].toFixed(4)},${b[1].toFixed(4)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  for (const poly of fills) {
    for (let i = 0; i < poly.length; i++) {
      const k = ek(poly[i], poly[(i + 1) % poly.length]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }
  const fillEdges: DrawingSegment[] = [];
  for (const poly of fills) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((edgeCount.get(ek(a, b)) ?? 0) > 1) continue;
      fillEdges.push([a[0], a[1], b[0], b[1]]);
    }
  }

  // Walls are drawn to the wall face and stop short of crossings; extend
  // their tips to the nearest barrier so partitions actually close.
  const targets = [...barrierWalls, ...fillEdges];
  const extendedWalls = extendWallsToMeet(barrierWalls, targets);
  const segs: DrawingSegment[] = [...extendedWalls, ...fillEdges];

  const plateAreaU2 = fills.reduce((acc, p) => acc + Math.abs(ringArea(p)), 0);
  const emptyStats = (extra: Partial<FloorPartitionStats> = {}) => ({
    wallSegments: barrierWalls.length,
    stairSegments,
    faces: 0,
    slivers: 0,
    orphanHoles: 0,
    faceAreaU2: 0,
    plateAreaU2,
    areaDeltaRatio: 0,
    interiorClosedLoops: 0,
    ...extra,
  });

  if (!segs.length) {
    return { rooms: [], stats: emptyStats() };
  }

  const { verts, segs: atomic } = buildAtomicGraph(segs);
  const walks = traceFaces(verts, atomic);
  const { faces, orphanHoles } = faceFromWalks(verts, walks);

  // Keep only faces whose interior lies inside a plate fill.
  const kept: { face: RoomFace; sample: DrawingPoint }[] = [];
  for (const face of faces) {
    const sample = interiorPoint(face.outer, face.holes);
    if (!sample) continue;
    const inPlate = fills.some((p) => pointInPolygon(p, sample[0], sample[1]));
    if (inPlate) kept.push({ face, sample });
  }

  /* Interior linework audit: atomic edges strictly inside a kept face that
     are not part of its boundary. A closed cycle of such edges is a room
     outline the source drew but the partition failed to extract. */
  const vidKey = new Map<string, number>();
  verts.forEach((p, i) => vidKey.set(`${p[0]},${p[1]}`, i));
  const ptInRing = (poly: readonly DrawingPoint[], p: DrawingPoint) =>
    pointInPolygon(poly as DrawingPolygon, p[0], p[1]);
  const interiorClosedLoopsOf = (face: RoomFace): number => {
    const bset = new Set<string>();
    const rings = [face.outer, ...face.holes];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = vidKey.get(`${ring[i][0]},${ring[i][1]}`);
        const b = vidKey.get(
          `${ring[(i + 1) % ring.length][0]},${ring[(i + 1) % ring.length][1]}`,
        );
        if (a !== undefined && b !== undefined) {
          bset.add(a < b ? `${a}|${b}` : `${b}|${a}`);
        }
      }
    }
    const adj = new Map<number, number[]>();
    const link = (u: number, v: number) => {
      const au = adj.get(u) ?? [];
      au.push(v);
      adj.set(u, au);
      const av = adj.get(v) ?? [];
      av.push(u);
      adj.set(v, av);
    };
    for (const [a, b] of atomic) {
      if (bset.has(a < b ? `${a}|${b}` : `${b}|${a}`)) continue;
      const mx = (verts[a][0] + verts[b][0]) / 2;
      const my = (verts[a][1] + verts[b][1]) / 2;
      if (!ptInRing(face.outer, [mx, my])) continue;
      if (face.holes.some((h) => ptInRing(h, [mx, my]))) continue;
      link(a, b);
    }
    const seen = new Set<number>();
    let loops = 0;
    for (const start of adj.keys()) {
      if (seen.has(start)) continue;
      const stack = [start];
      const comp: number[] = [];
      while (stack.length) {
        const n = stack.pop()!;
        if (seen.has(n)) continue;
        seen.add(n);
        comp.push(n);
        for (const m of adj.get(n) ?? []) if (!seen.has(m)) stack.push(m);
      }
      if (
        comp.length >= 3 &&
        comp.every((n) => (adj.get(n)?.length ?? 0) === 2)
      ) {
        loops++;
      }
    }
    return loops;
  };
  const loopCount = new Map<RoomFace, number>();
  let interiorClosedLoops = 0;
  for (const k of kept) {
    const n = interiorClosedLoopsOf(k.face);
    loopCount.set(k.face, n);
    interiorClosedLoops += n;
  }

  const faceAreaU2 = kept.reduce((a, k) => a + k.face.areaU2, 0);
  const stats: FloorPartitionStats = {
    wallSegments: barrierWalls.length,
    stairSegments,
    faces: kept.length,
    slivers: kept.filter((k) => {
      const bb = ringBBox(k.face.outer);
      return (
        k.face.areaU2 < SLIVER_AREA_U2 ||
        Math.min(bb[2] - bb[0], bb[3] - bb[1]) < SLIVER_MIN_DIM_U
      );
    }).length,
    orphanHoles,
    faceAreaU2,
    plateAreaU2,
    areaDeltaRatio: plateAreaU2 ? (faceAreaU2 - plateAreaU2) / plateAreaU2 : 0,
    interiorClosedLoops,
  };

  /* ---- classify faces into selectable rooms ---- */

  interface FaceEntry {
    readonly face: RoomFace;
    readonly sample: DrawingPoint;
    readonly closedLoops: number;
    stairIndex: number;
    kind: RoomPartitionKind;
  }
  const entries: FaceEntry[] = kept.map((k) => {
    let stairIndex = -1;
    for (let i = 0; i < stairs.length; i++) {
      if (stairContains(stairs[i], k.sample[0], k.sample[1], 0)) {
        stairIndex = i;
        break;
      }
    }
    return {
      face: k.face,
      sample: k.sample,
      closedLoops: loopCount.get(k.face) ?? 0,
      stairIndex,
      kind: "room" as RoomPartitionKind,
    };
  });

  // Corridor heuristic (ported intent from the legacy partitioner): the
  // single dominant elongated non-stair face is the corridor/common zone.
  const nonStair = entries.filter((e) => e.stairIndex < 0);
  const byArea = nonStair.slice().sort((a, b) => b.face.areaU2 - a.face.areaU2);
  if (byArea.length >= 3) {
    const top = byArea[0];
    const second = byArea[1];
    const bb = ringBBox(top.face.outer);
    const w = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
    const d = Math.min(bb[2] - bb[0], bb[3] - bb[1]) || 0.1;
    if (top.face.areaU2 >= second.face.areaU2 * 1.2 && w / d > 2) {
      top.kind = "corridor";
    }
  }
  for (const e of entries) {
    const bb = ringBBox(e.face.outer);
    const minDim = Math.min(bb[2] - bb[0], bb[3] - bb[1]);
    if (e.face.areaU2 < SLIVER_AREA_U2 || minDim < SLIVER_MIN_DIM_U) {
      e.kind = "sliver";
    } else if (e.stairIndex >= 0) e.kind = "stair";
  }

  /* ---- group stair faces per stair region, emit rooms ---- */

  const rooms: PartitionedRoom[] = [];
  const stairGroups = new Map<number, FaceEntry[]>();
  const singles: FaceEntry[] = [];
  for (const e of entries) {
    if (e.kind === "sliver") continue;
    if (e.kind === "stair") {
      const arr = stairGroups.get(e.stairIndex) ?? [];
      arr.push(e);
      stairGroups.set(e.stairIndex, arr);
    } else {
      singles.push(e);
    }
  }

  const faceCentroid = (face: RoomFace): DrawingPoint => {
    const c = ringCentroid(face.outer);
    return c;
  };
  const entryArea = (e: FaceEntry) => e.face.areaU2;
  const emit = (
    kind: RoomPartitionKind,
    stairIndex: number,
    group: readonly FaceEntry[],
  ) => {
    const areaU2 = group.reduce((a, e) => a + entryArea(e), 0);
    const bb = group.reduce(
      (acc, e) => {
        const b = ringBBox(e.face.outer);
        return [
          Math.min(acc[0], b[0]),
          Math.min(acc[1], b[1]),
          Math.max(acc[2], b[2]),
          Math.max(acc[3], b[3]),
        ] as const;
      },
      [Infinity, Infinity, -Infinity, -Infinity] as const,
    );
    // Weighted centroid by face area.
    let cx = 0;
    let cy = 0;
    for (const e of group) {
      const c = faceCentroid(e.face);
      cx += c[0] * entryArea(e);
      cy += c[1] * entryArea(e);
    }
    cx /= areaU2 || 1;
    cy /= areaU2 || 1;
    rooms.push({
      kind,
      stairIndex,
      faces: group.map((e) => e.face),
      areaU2,
      centroid: [cx, cy],
      bbox: bb,
      interiorClosedLoops: group.reduce((a, e) => a + e.closedLoops, 0),
    });
  };

  // Deterministic ordering: stairs first (by region index), then
  // corridor, then rooms by descending area.
  const stairIdx = [...stairGroups.keys()].sort((a, b) => a - b);
  for (const si of stairIdx) emit("stair", si, stairGroups.get(si)!);
  const corridor = singles.filter((e) => e.kind === "corridor");
  const plain = singles
    .filter((e) => e.kind === "room")
    .sort((a, b) => b.face.areaU2 - a.face.areaU2 || a.sample[0] - b.sample[0]);
  for (const e of corridor) emit("corridor", -1, [e]);
  for (const e of plain) emit("room", -1, [e]);

  return { rooms, stats };
};
