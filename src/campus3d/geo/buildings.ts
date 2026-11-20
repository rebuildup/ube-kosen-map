/**
 * Building geometry generation, ported from the legacy implementation's
 * building pass and reduced to renderer-free specs.
 *
 * Output is intermediate representation only: prism footprints for slabs and
 * ceilings, box specs for walls and stairs, and room partition records for
 * selection. The renderer adapter (#57) turns specs into THREE objects.
 *
 * Public-scope note (docs/campus3d-data-policy.md): dormitory-category
 * buildings render as exterior massing only — interior partitions and room
 * numbers are restricted data and are never generated here.
 */

import type { CampusModelData, DrawingPolygon, DrawingSegment } from "../types";
import { drawingToModel, METERS_PER_DRAWING_UNIT } from "./drawingTransform";
import { polygonBBox, polygonCentroid, pointInPolygon } from "./polygon";
import {
  resolveBuildingRegistry,
  type ResolvedBuilding,
} from "../data/buildingRegistry";
import { addAnyStairs, type StepSpec, type StepRegion } from "./stairs";

const M_PER_UNIT = METERS_PER_DRAWING_UNIT;

/** Extruded vertical prism: footprint polygon + bottom height + height. */
export interface PrismSpec {
  /** Footprint in model ground-plane coords [x, z]. */
  readonly polygon: readonly (readonly [number, number])[];
  readonly yBottom: number;
  readonly height: number;
}

/** Wall segment rendered as an instanced box (same shape as StepSpec). */
export type WallSpec = StepSpec;

/** A stair symbol region inside a floor plan. */
type StairRegionLike =
  | StepRegion
  | {
      readonly g: number;
      readonly cx: number;
      readonly cy: number;
      readonly ang: number;
      readonly len: number;
      readonly wid: number;
    };

/** One partitioned room/zone on a floor (generic labels only). */
export interface RoomSpec {
  readonly building: string;
  readonly floor: number;
  readonly label: string;
  /** Centroid in drawing coordinates. */
  readonly cx: number;
  readonly cy: number;
  readonly widthM: number;
  readonly depthM: number;
  readonly areaM2: number;
  /** Grid cells [x, y] in drawing coords, for floor-mesh generation. */
  readonly cells: readonly (readonly [number, number])[];
  readonly cellSize: number;
  readonly stair: boolean;
}

export type BuildingStatus = "ok" | "nodata" | "missing-data";

export interface BuildingModel {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly color: number;
  readonly status: BuildingStatus;
  readonly floors: number;
  /** Registry free-text room summary (publishable descriptions only). */
  readonly roomsInfo: string;
  readonly note: string;
  readonly baseY: number;
  readonly floorHeight: number;
  readonly totalHeight: number;
  /** Label anchor in model space. */
  readonly labelPos: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  /** Centroid in drawing coords (for 2D cross-checks). */
  readonly centroidDraw: readonly [number, number] | null;
  readonly slabs: readonly PrismSpec[];
  readonly ceilings: readonly PrismSpec[];
  readonly caps: readonly PrismSpec[];
  readonly walls: readonly WallSpec[];
  readonly stairs: readonly StepSpec[];
  readonly rooms: readonly RoomSpec[];
}

export interface CampusModel {
  readonly buildings: readonly BuildingModel[];
  readonly report: {
    readonly total: number;
    readonly ok: number;
    readonly nodata: number;
    readonly missingData: string[];
    readonly roomCount: number;
  };
}

const DORM_CATEGORIES = ["寮"];
const isDorm = (b: ResolvedBuilding): boolean =>
  DORM_CATEGORIES.some((c) => b.category.startsWith(c));

const toModelPoly = (poly: DrawingPolygon) =>
  poly.map((p) => {
    const m = drawingToModel(p[0], p[1]);
    return [m.x, m.z] as const;
  });

const prism = (
  poly: DrawingPolygon,
  yBottom: number,
  height: number,
): PrismSpec => ({
  polygon: toModelPoly(poly),
  yBottom,
  height,
});

/** Perimeter segments of fill polygons (exterior walls). */
const perimeterSegments = (
  fills: readonly DrawingPolygon[],
): DrawingSegment[] => {
  const out: DrawingSegment[] = [];
  for (const poly of fills) {
    const n = poly.length;
    for (let j = 0; j < n; j++) {
      const a = poly[j];
      const b = poly[(j + 1) % n];
      out.push([a[0], a[1], b[0], b[1]]);
    }
  }
  return out;
};

/** Wall segments -> instanced box specs. */
const wallBoxes = (
  segs: readonly DrawingSegment[],
  y0: number,
  h: number,
  thick: number,
): WallSpec[] => {
  const out: WallSpec[] = [];
  for (const sg of segs) {
    const a = drawingToModel(sg[0], sg[1]);
    const b = drawingToModel(sg[2], sg[3]);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 0.001;
    out.push({
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
      y: y0 + h / 2,
      rotY: -Math.atan2(dz, dx),
      sx: len,
      sy: h,
      sz: thick,
    });
  }
  return out;
};

/* ---------- room partitioning (generic labels; spec=null path only) ---- */

const segDist = (px: number, py: number, sg: DrawingSegment): number => {
  const ax = sg[0];
  const ay = sg[1];
  const bx = sg[2];
  const by = sg[3];
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = ax + dx * t - px;
  const ey = ay + dy * t - py;
  return Math.hypot(ex, ey);
};

interface CellComp {
  cells: [number, number][];
  stair: boolean;
  label: string | null;
  isRoom: boolean;
  cx: number;
  cy: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Partition a floor's fill polygons into room/zone cells using the wall
 * segments and stair regions. Ported from the legacy spec=null path with
 * dorm-specific labeling (room numbers, spec modes, hub pins) removed —
 * those are restricted data or personal information.
 */
const partitionFloor = (
  buildingKey: string,
  floorN: number,
  fills: readonly DrawingPolygon[],
  walls: readonly DrawingSegment[],
  stairs: readonly StairRegionLike[],
): RoomSpec[] => {
  const CS = 1.0;
  interface StairRect {
    cx: number;
    cy: number;
    ax: number;
    ay: number;
    bx: number;
    by: number;
    h1: number;
    h2: number;
  }
  const srects: StairRect[] = stairs.map((r) => {
    if (!("g" in r)) {
      const a = ((r[4] || 0) * Math.PI) / 180;
      return {
        cx: r[0],
        cy: r[1],
        ax: Math.cos(a),
        ay: Math.sin(a),
        bx: Math.cos(a + Math.PI / 2),
        by: Math.sin(a + Math.PI / 2),
        h1: r[2] / 2,
        h2: r[3] / 2,
      };
    }
    return {
      cx: r.cx,
      cy: r.cy,
      ax: Math.sin(r.ang),
      ay: -Math.cos(r.ang),
      bx: Math.cos(r.ang),
      by: Math.sin(r.ang),
      h1: r.wid / 2,
      h2: r.len / 2,
    };
  });
  const stairIdAt = (x: number, y: number): number => {
    for (let i = 0; i < srects.length; i++) {
      const r = srects[i];
      const dx = x - r.cx;
      const dy = y - r.cy;
      if (
        Math.abs(dx * r.ax + dy * r.ay) <= r.h1 &&
        Math.abs(dx * r.bx + dy * r.by) <= r.h2
      ) {
        return i;
      }
    }
    return -1;
  };

  const comps: CellComp[] = [];
  const stairCells = new Map<number, [number, number][]>();
  for (const poly of fills) {
    const bb = polygonBBox(poly);
    const nx = Math.max(1, Math.ceil((bb[2] - bb[0]) / CS));
    const ny = Math.max(1, Math.ceil((bb[3] - bb[1]) / CS));
    const state = new Int8Array(nx * ny); // 0=outside 1=free 2=wall 3=stair
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = bb[0] + (i + 0.5) * CS;
        const y = bb[1] + (j + 0.5) * CS;
        const k = j * nx + i;
        if (!pointInPolygon(poly, x, y)) {
          state[k] = 0;
          continue;
        }
        const sid = stairIdAt(x, y);
        if (sid >= 0) {
          state[k] = 3;
          const arr = stairCells.get(sid) ?? [];
          arr.push([x, y]);
          stairCells.set(sid, arr);
          continue;
        }
        let blocked = false;
        for (const sg of walls) {
          if (
            x < Math.min(sg[0], sg[2]) - 0.85 ||
            x > Math.max(sg[0], sg[2]) + 0.85 ||
            y < Math.min(sg[1], sg[3]) - 0.85 ||
            y > Math.max(sg[1], sg[3]) + 0.85
          ) {
            continue;
          }
          if (segDist(x, y, sg) < 0.75) {
            blocked = true;
            break;
          }
        }
        state[k] = blocked ? 2 : 1;
      }
    }
    const seen = new Uint8Array(nx * ny);
    for (let j2 = 0; j2 < ny; j2++) {
      for (let i2 = 0; i2 < nx; i2++) {
        const k0 = j2 * nx + i2;
        if (state[k0] !== 1 || seen[k0]) continue;
        const cells: [number, number][] = [];
        const stack = [k0];
        seen[k0] = 1;
        while (stack.length) {
          const c = stack.pop()!;
          const ci = c % nx;
          const cj = (c - ci) / nx;
          cells.push([bb[0] + (ci + 0.5) * CS, bb[1] + (cj + 0.5) * CS]);
          for (const d of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const ni = ci + d[0];
            const nj = cj + d[1];
            if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
            const nk = nj * nx + ni;
            if (state[nk] === 1 && !seen[nk]) {
              seen[nk] = 1;
              stack.push(nk);
            }
          }
        }
        if (cells.length >= 2)
          comps.push({
            cells,
            stair: false,
            label: null,
            isRoom: false,
            cx: 0,
            cy: 0,
            x0: 0,
            y0: 0,
            x1: 0,
            y1: 0,
          });
      }
    }
  }
  for (const cells of stairCells.values()) {
    if (cells.length >= 2) {
      comps.push({
        cells,
        stair: true,
        label: "階段室",
        isRoom: false,
        cx: 0,
        cy: 0,
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
      });
    }
  }
  if (!comps.length) return [];

  /* Aggregate each component. */
  for (const cp of comps) {
    let sx = 0;
    let sy = 0;
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (const c of cp.cells) {
      sx += c[0];
      sy += c[1];
      if (c[0] < x0) x0 = c[0];
      if (c[1] < y0) y0 = c[1];
      if (c[0] > x1) x1 = c[0];
      if (c[1] > y1) y1 = c[1];
    }
    cp.cx = sx / cp.cells.length;
    cp.cy = sy / cp.cells.length;
    cp.x0 = x0;
    cp.y0 = y0;
    cp.x1 = x1;
    cp.y1 = y1;
  }

  /* Generic labeling: the largest elongated component is corridor/common. */
  const candidates = comps.filter((cp) => !cp.stair);
  const sorted = candidates
    .slice()
    .sort((a, b) => b.cells.length - a.cells.length);
  if (sorted.length >= 3) {
    const top = sorted[0];
    const next = sorted[1];
    const tw = Math.max(top.x1 - top.x0, top.y1 - top.y0);
    const td = Math.min(top.x1 - top.x0, top.y1 - top.y0) || 0.1;
    if (top.cells.length >= next.cells.length * 1.25 && tw / td > 2.2) {
      top.label = "廊下・共用部";
    }
  }
  let rn = 1;
  for (const cp of comps) {
    if (cp.stair) continue;
    if (cp.label) continue;
    if (cp.cells.length < 4) {
      cp.label = "小室";
      continue;
    }
    cp.label = `部屋 R${rn++}`;
    cp.isRoom = true;
  }

  return comps.map((cp) => ({
    building: buildingKey,
    floor: floorN,
    label: cp.label ?? "部屋",
    cx: cp.cx,
    cy: cp.cy,
    widthM: (cp.x1 - cp.x0 + CS) * M_PER_UNIT,
    depthM: (cp.y1 - cp.y0 + CS) * M_PER_UNIT,
    areaM2: cp.cells.length * CS * CS * M_PER_UNIT * M_PER_UNIT,
    cells: cp.cells,
    cellSize: CS,
    stair: cp.stair,
  }));
};

/* ---------- per-building generation ---------- */

interface FloorLike {
  readonly n: number;
  readonly f: readonly DrawingPolygon[];
  readonly w: readonly DrawingSegment[];
  readonly st: readonly StairRegionLike[];
}

const generateBuilding = (
  entry: ResolvedBuilding,
  data: CampusModelData,
): BuildingModel => {
  const d = data.bld[entry.key];
  const common = {
    key: entry.key,
    name: entry.name,
    category: entry.category,
    color: entry.color ?? 0x888888,
    floors: entry.floors ?? 1,
    roomsInfo: entry.rooms ?? "",
    note: entry.note ?? "",
    baseY: entry.baseModelY,
    floorHeight: entry.floorModelHeight,
    centroidDraw: null as readonly [number, number] | null,
  };
  if (entry.kind === "nodata") {
    return {
      ...common,
      status: "nodata",
      totalHeight: 0,
      labelPos: { x: 0, y: 0, z: 0 },
      slabs: [],
      ceilings: [],
      caps: [],
      walls: [],
      stairs: [],
      rooms: [],
    };
  }
  if (!d) {
    return {
      ...common,
      status: "missing-data",
      totalHeight: 0,
      labelPos: { x: 0, y: 0, z: 0 },
      slabs: [],
      ceilings: [],
      caps: [],
      walls: [],
      stairs: [],
      rooms: [],
    };
  }

  const slabs: PrismSpec[] = [];
  const ceilings: PrismSpec[] = [];
  const caps: PrismSpec[] = [];
  const walls: WallSpec[] = [];
  const stairs: StepSpec[] = [];
  const rooms: RoomSpec[] = [];
  const hh = entry.floorModelHeight * (entry.heightMultiplier ?? 1);
  const massing =
    entry.kind === "outline" || isDorm(entry) || !d.fl || !d.fl.length;

  // Outline for centroid/label: first floor's fills or outline polygons.
  const outlineFills: readonly DrawingPolygon[] =
    d.fl && d.fl.length ? d.fl[0].f : (d.f ?? []);
  const mainFill =
    outlineFills.length > 0
      ? outlineFills.reduce((best, poly) => {
          const bb = polygonBBox(poly);
          const area = (bb[2] - bb[0]) * (bb[3] - bb[1]);
          const bbB = polygonBBox(best);
          return area > (bbB[2] - bbB[0]) * (bbB[3] - bbB[1]) ? poly : best;
        })
      : null;
  const centroid = mainFill ? polygonCentroid(mainFill) : null;
  const cw = centroid ? drawingToModel(centroid[0], centroid[1]) : null;

  let totalHeight: number;
  if (massing) {
    // Outline buildings and dorms: per-floor slab + perimeter walls,
    // ceiling on all but the top floor, cap on top. No interiors.
    const fills = d.f ?? d.fl?.[0]?.f ?? [];
    for (const poly of fills) {
      for (let fi = 0; fi < common.floors; fi++) {
        const y0 = common.baseY + fi * hh;
        slabs.push(prism(poly, y0, 0.03));
        walls.push(...wallBoxes(perimeterSegments([poly]), y0, hh, 0.014));
        if (fi < common.floors - 1) {
          ceilings.push(prism(poly, y0 + hh - 0.025, 0.025));
        }
      }
      caps.push(prism(poly, common.baseY + common.floors * hh, 0.03));
    }
    totalHeight = common.floors * hh;
  } else {
    // Floor buildings: per-floor slabs, ceilings, interior + perimeter
    // walls, stairs between floors, room partitions.
    const fl = d.fl!;
    for (const f of fl as readonly FloorLike[]) {
      const num = f.n;
      const y0 = common.baseY + (num - 1) * common.floorHeight;
      for (const poly of f.f) {
        slabs.push(prism(poly, y0, 0.03));
        ceilings.push(prism(poly, y0 + common.floorHeight - 0.025, 0.025));
      }
      walls.push(...wallBoxes(f.w ?? [], y0, common.floorHeight, 0.008));
      walls.push(
        ...wallBoxes(perimeterSegments(f.f), y0, common.floorHeight, 0.014),
      );
      rooms.push(...partitionFloor(entry.key, num, f.f, f.w ?? [], f.st ?? []));
      if (num < common.floors) {
        for (const r of (f.st ?? []) as readonly StairRegionLike[]) {
          addAnyStairs(stairs, r, y0, common.floorHeight);
        }
      }
    }
    const topF = fl[fl.length - 1] as FloorLike;
    for (const poly of topF.f) {
      caps.push(prism(poly, common.baseY + topF.n * common.floorHeight, 0.03));
    }
    totalHeight = common.floors * common.floorHeight;
  }

  return {
    ...common,
    status: "ok",
    totalHeight,
    labelPos: cw
      ? { x: cw.x, y: common.baseY + totalHeight + 0.34, z: cw.z }
      : { x: 0, y: common.baseY + totalHeight + 0.34, z: 0 },
    slabs,
    ceilings,
    caps,
    walls,
    stairs,
    rooms,
  };
};

/** Generate the whole campus model from the public dataset + registry. */
export const buildCampusModel = (data: CampusModelData): CampusModel => {
  const registry = resolveBuildingRegistry(data);
  const buildings = registry.map((entry) => generateBuilding(entry, data));
  const missingData = buildings
    .filter((b) => b.status === "missing-data")
    .map((b) => b.key);
  return {
    buildings,
    report: {
      total: buildings.length,
      ok: buildings.filter((b) => b.status === "ok").length,
      nodata: buildings.filter((b) => b.status === "nodata").length,
      missingData,
      roomCount: buildings.reduce((a, b) => a + b.rooms.length, 0),
    },
  };
};
