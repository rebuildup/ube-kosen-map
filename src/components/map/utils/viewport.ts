import { CAMPUS_MAP_BOUNDS } from "../../../data/mapBounds";
import type {
  Coordinate,
  InteractivePoint,
  MapMode,
  ViewBox,
} from "../../../types/map";
import type { MapBoundsSize } from "./coordinateTransform";

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

export const floorNumberFromId = (floorId: string | null): number | null => {
  if (!floorId) return null;
  const matched = floorId.match(/^(\d+)/);
  if (!matched) return null;
  const parsed = Number.parseInt(matched[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Effective map-space coordinate: anchorArea center when present. */
export const effectivePointCoordinate = (
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

const panLimits = (
  zoom: number,
  bounds: MapBoundsSize,
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
  bounds: MapBoundsSize = CAMPUS_MAP_BOUNDS,
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
  bounds: MapBoundsSize = CAMPUS_MAP_BOUNDS,
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
  bounds: MapBoundsSize = CAMPUS_MAP_BOUNDS,
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

/** Span limits derived from zoom bounds and the adjusted map bounds. */
export interface ViewBoxSpanLimits {
  /** Smallest allowed viewBox span (max zoom-out extent). */
  maxSpan: { height: number; width: number };
  /** Largest allowed viewBox span (max zoom-in extent). */
  minSpan: { height: number; width: number };
}

export const computeSpanLimits = (
  adjustedBounds: {
    height: number;
    marginX: number;
    marginY: number;
    width: number;
  },
  minZoom: number,
  maxZoom: number,
): ViewBoxSpanLimits => ({
  maxSpan: {
    height: (adjustedBounds.height + adjustedBounds.marginY * 2) / minZoom,
    width: (adjustedBounds.width + adjustedBounds.marginX * 2) / minZoom,
  },
  minSpan: {
    height: (adjustedBounds.height + adjustedBounds.marginY * 2) / maxZoom,
    width: (adjustedBounds.width + adjustedBounds.marginX * 2) / maxZoom,
  },
});

const clampSpan = (viewBox: ViewBox, limits: ViewBoxSpanLimits): ViewBox => ({
  ...viewBox,
  height: clamp(viewBox.height, limits.minSpan.height, limits.maxSpan.height),
  width: clamp(viewBox.width, limits.minSpan.width, limits.maxSpan.width),
});

/** Zoom by `scale` around the viewBox center (zoom in: scale < 1). */
export const zoomViewBoxCentered = (
  viewBox: ViewBox,
  scale: number,
  limits: ViewBoxSpanLimits,
): ViewBox => {
  const next = clampSpan(
    {
      height: viewBox.height * scale,
      width: viewBox.width * scale,
      x: viewBox.x,
      y: viewBox.y,
    },
    limits,
  );
  const centerX = viewBox.x + viewBox.width / 2;
  const centerY = viewBox.y + viewBox.height / 2;
  return {
    ...next,
    x: centerX - next.width / 2,
    y: centerY - next.height / 2,
  };
};

/** Zoom by `factor` keeping `anchor` (viewBox space) stationary. */
export const zoomViewBoxAtPoint = (
  viewBox: ViewBox,
  anchor: Coordinate,
  factor: number,
  limits: ViewBoxSpanLimits,
): ViewBox => {
  const next = clampSpan(
    {
      height: viewBox.height * factor,
      width: viewBox.width * factor,
      x: viewBox.x,
      y: viewBox.y,
    },
    limits,
  );
  return {
    ...next,
    x: anchor.x - (anchor.x - viewBox.x) * (next.width / viewBox.width),
    y: anchor.y - (anchor.y - viewBox.y) * (next.height / viewBox.height),
  };
};

export interface PinchZoomStart {
  /** Fraction of the start viewBox occupied by the gesture center. */
  centerFrac: { x: number; y: number };
  /** Gesture center in viewBox space at gesture start. */
  centerViewBox: Coordinate;
  distance: number;
  viewBox: ViewBox;
}

/**
 * Two-finger pinch: `distanceRatio` is startDistance / currentDistance
 * (>1 zooms in). The center stays fixed at its fractional viewBox position.
 */
export const computePinchViewBox = (
  start: PinchZoomStart,
  distanceRatio: number,
  limits: ViewBoxSpanLimits,
): ViewBox => {
  const next = clampSpan(
    {
      height: start.viewBox.height * distanceRatio,
      width: start.viewBox.width * distanceRatio,
      x: start.viewBox.x,
      y: start.viewBox.y,
    },
    limits,
  );
  return {
    ...next,
    x: start.centerViewBox.x - start.centerFrac.x * next.width,
    y: start.centerViewBox.y - start.centerFrac.y * next.height,
  };
};

/** Shift+drag zoom: resize from the drag-start viewBox around `centerViewBox`. */
export const computeDragZoomViewBox = (
  startViewBox: ViewBox,
  centerViewBox: Coordinate,
  zoomFactor: number,
): ViewBox => ({
  height: startViewBox.height * zoomFactor,
  width: startViewBox.width * zoomFactor,
  x: centerViewBox.x - (startViewBox.width * zoomFactor) / 2,
  y: centerViewBox.y - (startViewBox.height * zoomFactor) / 2,
});

/**
 * Zoom to `point` at `zoomLevel` (viewBox span = bounds / zoomLevel).
 * Uses asymmetric padding (30% left/top, 10% right/bottom) so the target
 * stays reachable near map edges.
 */
export const computePointZoomViewBox = (
  point: Coordinate,
  zoomLevel: number,
  bounds: MapBoundsSize,
): ViewBox => {
  const mapWidth = bounds.width;
  const mapHeight = bounds.height;
  const targetWidth = mapWidth / zoomLevel;
  const targetHeight = mapHeight / zoomLevel;

  const paddingLeft = mapWidth * 0.3;
  const paddingRight = mapWidth * 0.1;
  const paddingTop = mapHeight * 0.3;
  const paddingBottom = mapHeight * 0.1;

  const maxX = mapWidth + paddingRight - targetWidth;
  const minX = -paddingLeft;
  const maxY = mapHeight + paddingBottom - targetHeight;
  const minY = -paddingTop;

  return {
    height: targetHeight,
    width: targetWidth,
    x: clamp(point.x - targetWidth / 2, minX, maxX),
    y: clamp(point.y - targetHeight / 2, minY, maxY),
  };
};
