/**
 * Coordinate transforms for the campus 3D model.
 *
 * Two coordinate spaces are involved:
 * - "drawing coordinates": the source map's SVG space (x right, y down),
 *   shared with the 2D map data in src/data/.
 * - "model coordinates": the 3D scene space. x/z are the ground plane
 *   (z grows "south" on screen), y is height. One model unit is
 *   M_PER_MODEL meters horizontally; vertical sizes are converted from
 *   real meters through the same scale so heights and plan dimensions
 *   share one ruler.
 *
 * Calibration provenance: docs/campus3d-provenance.md.
 */

/** School reference position used for lat/lon display (drawing origin). */
export const CAMPUS_REFERENCE = {
  lat0: 33.955361,
  lon0: 131.274861,
} as const;

/**
 * Drawing -> real-world transform. `geoS` is meters per drawing unit
 * (calibrated against HP building areas and photos); `geoEC`/`geoES` are the
 * east direction in drawing coordinates (rotation ~15.5 deg measured from
 * the orientation compass on the official campus diagram).
 */
export const GEO = {
  metersPerUnit: 0.84,
  eastCos: 0.9636,
  eastSin: 0.2672,
  originDrawX: 235.27,
  originDrawY: 355.26,
} as const;

const METERS_PER_DEG_LAT = 110_922;
const METERS_PER_DEG_LON = 92_430;

/** Real-world size of one drawing unit. */
export const METERS_PER_DRAWING_UNIT = GEO.metersPerUnit;

/**
 * Model-plane scale: drawing units -> model units. The model uses a fixed
 * scale so that 1 model unit = M_PER_MODEL meters in every direction.
 */
export const MODEL_UNITS_PER_DRAWING_UNIT = 0.032;
export const METERS_PER_MODEL_UNIT =
  METERS_PER_DRAWING_UNIT / MODEL_UNITS_PER_DRAWING_UNIT;

/** Real floor height in meters (school buildings; dorms use 3.0). */
export const SCHOOL_FLOOR_HEIGHT_M = 3.6;
/** Terrain: one base-map layer step = 1.0 m of elevation. */
export const TERRAIN_LAYER_HEIGHT_M = 1.0;
/** Elevation of layer 0 in meters (SRTM-based estimate). */
export const TERRAIN_BASE_ELEVATION_M = 27.4;

/** Convert real meters to model units (the single vertical/horizontal ruler). */
export const metersToModelUnits = (meters: number): number =>
  meters / METERS_PER_MODEL_UNIT;

export const TERRAIN_STEP_MODEL = metersToModelUnits(TERRAIN_LAYER_HEIGHT_M);
export const SCHOOL_FLOOR_MODEL = metersToModelUnits(SCHOOL_FLOOR_HEIGHT_M);

/** Elevation in meters for a terrain layer index. */
export const elevationOfLayer = (layer: number): number =>
  TERRAIN_BASE_ELEVATION_M + layer * TERRAIN_LAYER_HEIGHT_M;

export interface ModelPoint {
  readonly x: number;
  readonly z: number;
}

/** Drawing coordinates -> model ground-plane coordinates. */
export const drawingToModel = (drawX: number, drawY: number): ModelPoint => ({
  x: (drawX - GEO.originDrawX) * MODEL_UNITS_PER_DRAWING_UNIT,
  z: (drawY - GEO.originDrawY) * MODEL_UNITS_PER_DRAWING_UNIT,
});

export interface GeoPosition {
  readonly lat: number;
  readonly lon: number;
  /** East/North offset in meters from the reference point. */
  readonly e: number;
  readonly n: number;
}

/** Drawing coordinates -> approximate lat/lon and ENU offset. */
export const drawingToGeo = (drawX: number, drawY: number): GeoPosition => {
  const u = drawX - GEO.originDrawX;
  const v = -(drawY - GEO.originDrawY);
  const e = GEO.metersPerUnit * (GEO.eastCos * u - GEO.eastSin * v);
  const n = GEO.metersPerUnit * (GEO.eastSin * u + GEO.eastCos * v);
  return {
    lat: CAMPUS_REFERENCE.lat0 + n / METERS_PER_DEG_LAT,
    lon: CAMPUS_REFERENCE.lon0 + e / METERS_PER_DEG_LON,
    e,
    n,
  };
};

/**
 * Magnetic/true-north offset in degrees: true north is the model's -Z
 * direction rotated by this angle (calibrated from the campus diagram's
 * orientation compass and GSI map data).
 */
export const NORTH_OFFSET_DEGREES =
  (-Math.atan2(GEO.eastSin, GEO.eastCos) * 180) / Math.PI;
