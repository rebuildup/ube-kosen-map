/**
 * Types for the campus 3D model dataset.
 *
 * All coordinates in this module are "drawing coordinates" of the source
 * campus map (campus-map.svg / campus-map3.svg space): x grows right, y grows
 * down, in the same units as the 2D map's un-rotated SVG space.
 * See docs/campus3d-provenance.md for sources and calibration.
 */

/** A point or segment endpoint in drawing coordinates. */
export type DrawingPoint = readonly [number, number];

/** A closed polygon ring in drawing coordinates. */
export type DrawingPolygon = readonly DrawingPoint[];

/** A line segment [x1, y1, x2, y2] in drawing coordinates. */
export type DrawingSegment = readonly [number, number, number, number];

/**
 * A terrain base layer. `l` is the layer index (0-8); each layer is a step of
 * LAYER_M meters. Polygons in `p` are the filled areas of that layer.
 * `sheet` marks concrete podium sheets that rise only 0.4 m instead of a
 * full layer step.
 */
export interface TerrainLayer {
  readonly l: number;
  readonly sheet?: boolean;
  readonly p: readonly DrawingPolygon[];
}

/** A ground linework layer extracted from the base map. */
export interface LineworkLayer {
  readonly l: number;
  readonly s: readonly DrawingSegment[];
}

/** A stair symbol region [cx, cy, width, height, angleDeg] in drawing coords. */
export type StairRegion = readonly [number, number, number, number, number];

/** A room/zone rectangle produced by hand-transcribed floor plans. */
export interface PlanRoom {
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  readonly label: string;
  readonly room: boolean;
  readonly stair: boolean;
}

/** Generated stair placement inside a plan floor. */
export interface PlanStair {
  readonly g: number;
  readonly cx: number;
  readonly cy: number;
  readonly ang: number;
  readonly len: number;
  readonly wid: number;
}

/** Long-axis frame used by hand-transcribed plans. */
export interface PlanFrame {
  readonly cx: number;
  readonly cy: number;
  readonly ux: number;
  readonly uy: number;
  readonly vx: number;
  readonly vy: number;
}

/**
 * One floor of a building.
 * - `f`: floor-slab fill polygons ("塗り" = floor plates)
 * - `w`: wall/divider line segments ("線画" = walls and partitions)
 * - `st`: stair symbol regions
 * - `rooms`/`fr`: present only for hand-transcribed plan floors
 */
export interface BuildingFloor {
  readonly n: number;
  readonly f: readonly DrawingPolygon[];
  readonly w: readonly DrawingSegment[];
  readonly st: readonly StairRegion[];
  readonly rooms?: readonly PlanRoom[];
  readonly fr?: PlanFrame;
}

/**
 * Building geometry extracted from the source map.
 * `fl` buildings have per-floor data; `f` buildings are outline-only
 * (single-story structures drawn as filled polygons).
 */
export interface BuildingData {
  readonly fl?: readonly BuildingFloor[];
  readonly f?: readonly DrawingPolygon[];
}

/** Outdoor steps extracted from ladder symbols in the base layers. */
export interface OutdoorSteps {
  readonly r: StairRegion;
  readonly l: number;
}

/** The raw extracted campus model dataset (before plan assembly). */
export interface CampusModelData {
  readonly terr: readonly TerrainLayer[];
  readonly tlines: readonly LineworkLayer[];
  readonly bld: Readonly<Record<string, BuildingData>>;
  readonly bases: Readonly<Record<string, number>>;
  /** Applied correction: techno and jisshu sit on layer 7, not their read layer. */
  readonly basesOverride?: Readonly<Record<string, number>>;
  readonly osteps: readonly OutdoorSteps[];
}
