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

import type {
  CampusModelData,
  DrawingPoint,
  DrawingPolygon,
  DrawingSegment,
} from "../types";
import { drawingToModel, METERS_PER_DRAWING_UNIT } from "./drawingTransform";
import { polygonBBox, polygonCentroid } from "./polygon";
import {
  resolveBuildingRegistry,
  type ResolvedBuilding,
} from "../data/buildingRegistry";
import { addAnyStairs, type StepSpec } from "./stairs";
import {
  partitionFloor as partitionFloorPlan,
  splitWallAndStairSegments,
  type FloorPartitionStats,
  type StairRegionLike,
} from "./roomPartition";

const M_PER_UNIT = METERS_PER_DRAWING_UNIT;

/** Optional floor tag used by the renderer for per-floor isolation. */
export interface FloorTag {
  readonly floor?: number;
}

/** Extruded vertical prism: footprint polygon + bottom height + height. */
export interface PrismSpec {
  /** Footprint in model ground-plane coords [x, z]. */
  readonly polygon: readonly (readonly [number, number])[];
  readonly yBottom: number;
  readonly height: number;
  /** Source floor number (1-based) for floor isolation. */
  readonly floor?: number;
}

/** Wall segment rendered as an instanced box (same shape as StepSpec). */
export type WallSpec = StepSpec & FloorTag;

/** A closed ring in drawing coordinates (hole-free). */
export interface RoomRingSpec {
  readonly outer: readonly DrawingPoint[];
  readonly holes: readonly (readonly DrawingPoint[])[];
}

export type RoomKind = "room" | "corridor" | "stair";

/**
 * One selectable space on a floor, derived from the floor plan's actual
 * wall linework (see geo/roomPartition.ts). Dimensions are computed from
 * the calibrated drawing scale (0.84 m/unit) — estimates, not survey
 * measurements (docs/campus3d-provenance.md).
 */
export interface RoomSpec {
  /** Stable id: `${building}:f${floor}:r${index}`. */
  readonly id: string;
  readonly building: string;
  readonly floor: number;
  readonly label: string;
  readonly kind: RoomKind;
  /** Footprint rings in drawing coordinates. */
  readonly faces: readonly RoomRingSpec[];
  /** Area centroid in drawing coordinates. */
  readonly centroidDraw: DrawingPoint;
  /** Bounding-box extents in meters (not the room's true width/depth). */
  readonly widthM: number;
  readonly depthM: number;
  readonly areaM2: number;
  readonly perimeterM: number;
}

export type BuildingStatus = "ok" | "nodata" | "missing-data";

/** Per-floor room extraction outcome kept for the completion report. */
export interface FloorRoomReport {
  readonly floor: number;
  readonly stats: FloorPartitionStats;
}

export interface BuildingModel {
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly color: number;
  readonly status: BuildingStatus;
  readonly floors: number;
  /** Floor numbers that have generated geometry (for floor isolation). */
  readonly floorNumbers: readonly number[];
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
  readonly stairs: readonly (StepSpec & FloorTag)[];
  readonly rooms: readonly RoomSpec[];
  /** Per-floor partition statistics (empty for massing/nodata buildings). */
  readonly floorReports: readonly FloorRoomReport[];
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
  floor?: number,
): PrismSpec => ({
  polygon: toModelPoly(poly),
  yBottom,
  height,
  floor,
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
  floor?: number,
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
      floor,
    });
  }
  return out;
};

/* ---------- room partitioning (floor-plan polygons) ------------------ */

/** Ring perimeter in meters (outer + holes), for dimension reporting. */
const ringPerimeterM = (ring: RoomRingSpec): number => {
  let len = 0;
  const n = ring.outer.length;
  for (let i = 0; i < n; i++) {
    const a = ring.outer[i];
    const b = ring.outer[(i + 1) % n];
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  for (const hole of ring.holes) {
    const m = hole.length;
    for (let i = 0; i < m; i++) {
      const a = hole[i];
      const b = hole[(i + 1) % m];
      len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  }
  return len * M_PER_UNIT;
};

const ringAreaU2 = (ring: RoomRingSpec): number => {
  const area = (pts: readonly DrawingPoint[]) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a / 2);
  };
  return area(ring.outer) - ring.holes.reduce((acc, h) => acc + area(h), 0);
};

/**
 * Partition one floor into selectable rooms from the floor plan's actual
 * wall linework (geo/roomPartition.ts). Returns RoomSpecs plus the
 * partition statistics kept for the per-floor completion report.
 */
const partitionFloorRooms = (
  buildingKey: string,
  floorN: number,
  fills: readonly DrawingPolygon[],
  walls: readonly DrawingSegment[],
  stairs: readonly StairRegionLike[],
): { rooms: RoomSpec[]; stats: FloorPartitionStats } => {
  const { rooms, stats } = partitionFloorPlan(fills, walls, stairs);
  let roomIndex = 0;
  let seq = 0;
  const specs = rooms.map((r) => {
    const faces: RoomRingSpec[] = r.faces.map((f) => ({
      outer: f.outer,
      holes: f.holes,
    }));
    const kind: RoomKind =
      r.kind === "corridor"
        ? "corridor"
        : r.kind === "stair"
          ? "stair"
          : "room";
    const label =
      kind === "corridor"
        ? "廊下・共用部"
        : kind === "stair"
          ? "階段室"
          : `部屋 R${++roomIndex}`;
    const areaM2 =
      faces.reduce((a, f) => a + ringAreaU2(f), 0) * M_PER_UNIT ** 2;
    return {
      id: `${buildingKey}:f${floorN}:r${seq++}`,
      building: buildingKey,
      floor: floorN,
      label,
      kind,
      faces,
      centroidDraw: r.centroid,
      widthM: (r.bbox[2] - r.bbox[0]) * M_PER_UNIT,
      depthM: (r.bbox[3] - r.bbox[1]) * M_PER_UNIT,
      areaM2,
      perimeterM: faces.reduce((a, f) => a + ringPerimeterM(f), 0),
    } satisfies RoomSpec;
  });
  return { rooms: specs, stats };
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
  const massing =
    entry.kind === "outline" || isDorm(entry) || !d?.fl || !d.fl.length;
  const floorNumbers: readonly number[] = massing
    ? Array.from({ length: entry.floors ?? 1 }, (_, i) => i + 1)
    : (d.fl ?? []).map((f) => f.n);
  const common = {
    key: entry.key,
    name: entry.name,
    category: entry.category,
    color: entry.color ?? 0x888888,
    floors: entry.floors ?? 1,
    floorNumbers,
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
      floorReports: [],
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
      floorReports: [],
    };
  }

  const slabs: PrismSpec[] = [];
  const ceilings: PrismSpec[] = [];
  const caps: PrismSpec[] = [];
  const walls: WallSpec[] = [];
  const stairs: (StepSpec & FloorTag)[] = [];
  const rooms: RoomSpec[] = [];
  const floorReports: FloorRoomReport[] = [];
  const hh = entry.floorModelHeight * (entry.heightMultiplier ?? 1);

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
        slabs.push(prism(poly, y0, 0.03, fi + 1));
        walls.push(
          ...wallBoxes(perimeterSegments([poly]), y0, hh, 0.014, fi + 1),
        );
        if (fi < common.floors - 1) {
          ceilings.push(prism(poly, y0 + hh - 0.025, 0.025, fi + 1));
        }
      }
      caps.push(
        prism(poly, common.baseY + common.floors * hh, 0.03, common.floors),
      );
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
        slabs.push(prism(poly, y0, 0.03, num));
        ceilings.push(prism(poly, y0 + common.floorHeight - 0.025, 0.025, num));
      }
      // Stair tread linework is not wall: drop it from both the wall boxes
      // and the partition barriers (the tread regions become stair rooms).
      const { walls: barrierWalls } = splitWallAndStairSegments(
        f.w ?? [],
        f.st ?? [],
      );
      walls.push(
        ...wallBoxes(barrierWalls, y0, common.floorHeight, 0.008, num),
      );
      walls.push(
        ...wallBoxes(
          perimeterSegments(f.f),
          y0,
          common.floorHeight,
          0.014,
          num,
        ),
      );
      const part = partitionFloorRooms(
        entry.key,
        num,
        f.f,
        barrierWalls,
        f.st ?? [],
      );
      rooms.push(...part.rooms);
      floorReports.push({ floor: num, stats: part.stats });
      if (num < common.floors) {
        for (const r of (f.st ?? []) as readonly StairRegionLike[]) {
          const tmp: StepSpec[] = [];
          addAnyStairs(tmp, r, y0, common.floorHeight);
          for (const s of tmp) stairs.push({ ...s, floor: num });
        }
      }
    }
    const topF = fl[fl.length - 1] as FloorLike;
    for (const poly of topF.f) {
      caps.push(
        prism(poly, common.baseY + topF.n * common.floorHeight, 0.03, topF.n),
      );
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
    floorReports,
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
