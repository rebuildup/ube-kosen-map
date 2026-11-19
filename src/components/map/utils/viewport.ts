import { CAMPUS_MAP_BOUNDS } from "../../../data/buildings";
import type {
  Coordinate,
  InteractivePoint,
  MapMode,
  ViewBox,
} from "../../../types/map";

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** グリッド間隔を人間が読みやすいキリの良い数値に丸める */
export const niceInterval = (raw: number): number => {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  if (n < 1.5) return mag;
  if (n < 3.5) return 2 * mag;
  if (n < 7.5) return 5 * mag;
  return 10 * mag;
};

export const floorIdToZ = (floorId: string | null): number | null => {
  if (!floorId) return null;
  const matched = floorId.match(/^(\d+)/);
  if (!matched) return null;
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizePointCoordinate = (
  point: InteractivePoint,
): Coordinate => {
  if (!point.anchorArea) return point.coordinates;
  const { anchorArea } = point;
  return {
    x: anchorArea.x + anchorArea.width / 2,
    y: anchorArea.y + anchorArea.height / 2,
    z: point.coordinates.z ?? anchorArea.z,
  };
};

type Bounds = { width: number; height: number };

const panLimits = (
  zoom: number,
  bounds: Bounds,
): { minX: number; maxX: number; minY: number; maxY: number } => {
  const mapWidth = bounds.width;
  const mapHeight = bounds.height;
  const targetWidth = mapWidth / zoom;
  const targetHeight = mapHeight / zoom;
  const horizontalPadding = mapWidth * 0.2;
  const verticalPadding = mapHeight * 0.2;

  return {
    maxX: mapWidth + horizontalPadding - targetWidth,
    maxY: mapHeight + verticalPadding - targetHeight,
    minX: -horizontalPadding,
    minY: -verticalPadding,
  };
};

export const computeFittedViewBox = (
  points: InteractivePoint[],
  zoom: number,
  bounds: Bounds = CAMPUS_MAP_BOUNDS,
): ViewBox => {
  const mapWidth = bounds.width;
  const mapHeight = bounds.height;
  const targetWidth = mapWidth / zoom;
  const targetHeight = mapHeight / zoom;

  let centerX = mapWidth / 2;
  let centerY = mapHeight / 2;

  if (points.length > 0) {
    const xs = points.map((p) => p.coordinates.x);
    const ys = points.map((p) => p.coordinates.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    centerX = (minX + maxX) / 2;
    centerY = (minY + maxY) / 2;
  }

  const { minX, maxX, minY, maxY } = panLimits(zoom, bounds);

  return {
    height: targetHeight,
    width: targetWidth,
    x: clamp(centerX - targetWidth / 2, minX, maxX),
    y: clamp(centerY - targetHeight / 2, minY, maxY),
  };
};

export const computeCenteredViewBox = (
  center: Coordinate,
  zoom: number,
  bounds: Bounds = CAMPUS_MAP_BOUNDS,
): ViewBox => {
  const mapWidth = bounds.width;
  const mapHeight = bounds.height;
  const targetWidth = mapWidth / zoom;
  const targetHeight = mapHeight / zoom;

  const { minX, maxX, minY, maxY } = panLimits(zoom, bounds);

  return {
    height: targetHeight,
    width: targetWidth,
    x: clamp(center.x - targetWidth / 2, minX, maxX),
    y: clamp(center.y - targetHeight / 2, minY, maxY),
  };
};

export const resolveInitialViewBox = (
  points: InteractivePoint[],
  mode: MapMode | undefined,
  zoom: number,
  bounds: Bounds = CAMPUS_MAP_BOUNDS,
  initialCenter?: Coordinate,
): ViewBox => {
  if (initialCenter) {
    return computeCenteredViewBox(initialCenter, zoom, bounds);
  }
  if (mode === "display" && points.length > 0) {
    return computeFittedViewBox(points, zoom, bounds);
  }
  return computeFittedViewBox([], zoom, bounds);
};
