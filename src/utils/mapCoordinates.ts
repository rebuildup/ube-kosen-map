/**
 * Map Coordinate Transformation Utilities
 *
 * This module provides mathematically correct coordinate transformations
 * between world coordinates and viewport coordinates for map zoom/pan operations.
 *
 * Coordinate Systems:
 * - World Coordinates: The actual SVG coordinate system (0,0 to mapWidth,mapHeight)
 * - Viewport Coordinates: Screen pixel coordinates relative to the map container
 * - ViewBox: SVG viewBox for zoom/pan (x, y, width, height)
 */

import type {
  ContentRect,
  Coordinate,
  CoordinateValidation,
  MapBounds,
  PanConstraints,
  ViewBox,
} from "../types/map";

// Legacy type aliases for backward compatibility
export interface Point {
  x: number;
  y: number;
}

export interface MapViewState {
  viewCenter: Point;
  zoom: number;
  viewportSize: { width: number; height: number };
}

export interface ViewportBounds {
  width: number;
  height: number;
}

// ============================================================================
// Core Utilities
// ============================================================================

/**
 * Clamp a value between min and max
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Calculate distance between two points
 */
export function calculateDistance(point1: Coordinate, point2: Coordinate): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.hypot(dx, dy);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Linear interpolation between two points
 */
export function lerpPoint(start: Coordinate, end: Coordinate, t: number): Coordinate {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
  };
}

// ============================================================================
// ViewBox Utilities
// ============================================================================

/**
 * Calculate ViewBox from zoom level and center point
 */
export function createViewBox(
  centerX: number,
  centerY: number,
  zoom: number,
  mapBounds: MapBounds,
): ViewBox {
  const width = mapBounds.width / zoom;
  const height = mapBounds.height / zoom;

  return {
    height,
    width,
    x: centerX - width / 2,
    y: centerY - height / 2,
  };
}

/**
 * Calculate ViewBox string for SVG
 */
export function viewBoxToString(viewBox: ViewBox): string {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

/**
 * Parse ViewBox string to ViewBox object
 */
export function parseViewBox(viewBoxStr: string): ViewBox | null {
  const parts = viewBoxStr.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return null;
  }
  return {
    height: parts[3],
    width: parts[2],
    x: parts[0],
    y: parts[1],
  };
}

/**
 * Get zoom level from ViewBox
 */
export function getZoomFromViewBox(viewBox: ViewBox, mapBounds: MapBounds): number {
  return mapBounds.width / viewBox.width;
}

/**
 * Get center point from ViewBox
 */
export function getCenterFromViewBox(viewBox: ViewBox): Coordinate {
  return {
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2,
  };
}

// ============================================================================
// Pan Constraints
// ============================================================================

/**
 * Calculate pan constraints based on map bounds and current zoom
 */
export function calculatePanConstraints(
  mapBounds: MapBounds,
  viewBox: ViewBox,
  padding?: { bottom: number; left: number; right: number; top: number },
): PanConstraints {
  const { height: mapHeight, width: mapWidth } = mapBounds;
  const defaultPadding = { bottom: 0.1, left: 0.3, right: 0.1, top: 0.3 };
  const actualPadding = padding ?? defaultPadding;

  // Calculate padding in absolute units
  const paddingLeft = mapWidth * actualPadding.left;
  const paddingRight = mapWidth * actualPadding.right;
  const paddingTop = mapHeight * actualPadding.top;
  const paddingBottom = mapHeight * actualPadding.bottom;

  return {
    bottom: mapHeight + paddingBottom - viewBox.height,
    left: -paddingLeft,
    right: mapWidth + paddingRight - viewBox.width,
    top: -paddingTop,
  };
}

/**
 * Apply pan constraints to ViewBox
 */
export function constrainViewBox(viewBox: ViewBox, constraints: PanConstraints): ViewBox {
  return {
    ...viewBox,
    x: clamp(viewBox.x, constraints.left, constraints.right),
    y: clamp(viewBox.y, constraints.top, constraints.bottom),
  };
}

// ============================================================================
// SVG Content Rect Calculation
// ============================================================================

/**
 * Calculate the actual SVG content rendering area
 * Accounts for preserveAspectRatio="xMidYMid meet" behavior
 */
export function getSVGContentRect(svgRect: DOMRect, originalViewBox: ViewBox): ContentRect {
  const originalRatio = originalViewBox.width / originalViewBox.height;
  const svgRatio = svgRect.width / svgRect.height;

  let contentWidth: number;
  let contentHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (originalRatio > svgRatio) {
    // Width-constrained
    contentWidth = svgRect.width;
    contentHeight = svgRect.width / originalRatio;
    offsetX = 0;
    offsetY = (svgRect.height - contentHeight) / 2;
  } else {
    // Height-constrained
    contentWidth = svgRect.height * originalRatio;
    contentHeight = svgRect.height;
    offsetX = (svgRect.width - contentWidth) / 2;
    offsetY = 0;
  }

  return {
    height: contentHeight,
    offsetX,
    offsetY,
    width: contentWidth,
    x: svgRect.left + offsetX,
    y: svgRect.top + offsetY,
  };
}

// ============================================================================
// Coordinate Transformations
// ============================================================================

/**
 * Transform screen coordinates to SVG coordinates
 * Accounts for ViewBox and preserveAspectRatio
 */
export function screenToSVG(
  screenX: number,
  screenY: number,
  svgRect: DOMRect,
  viewBox: ViewBox,
  contentRect: ContentRect,
): Coordinate {
  // Convert to relative coordinates within SVG element
  const relativeX = screenX - svgRect.left;
  const relativeY = screenY - svgRect.top;

  // Adjust for letterboxing/pillarboxing
  const adjustedX = relativeX - contentRect.offsetX;
  const adjustedY = relativeY - contentRect.offsetY;

  // Transform to SVG coordinates
  const svgX = viewBox.x + (adjustedX / contentRect.width) * viewBox.width;
  const svgY = viewBox.y + (adjustedY / contentRect.height) * viewBox.height;

  return { x: svgX, y: svgY };
}

/**
 * Transform SVG coordinates to screen coordinates
 */
export function svgToScreen(
  svgX: number,
  svgY: number,
  svgRect: DOMRect,
  viewBox: ViewBox,
  contentRect: ContentRect,
): Coordinate {
  // Transform from SVG coordinates to relative position in viewBox
  const relativeX = (svgX - viewBox.x) / viewBox.width;
  const relativeY = (svgY - viewBox.y) / viewBox.height;

  // Convert to screen coordinates
  const screenX = svgRect.left + contentRect.offsetX + relativeX * contentRect.width;
  const screenY = svgRect.top + contentRect.offsetY + relativeY * contentRect.height;

  return { x: screenX, y: screenY };
}

/**
 * Validate and clamp coordinates to map bounds
 */
export function validateCoordinate(
  coord: Coordinate,
  mapBounds: MapBounds,
  margin = 2,
): CoordinateValidation {
  const marginX = mapBounds.width * margin;
  const marginY = mapBounds.height * margin;

  const minX = -marginX;
  const maxX = mapBounds.width + marginX;
  const minY = -marginY;
  const maxY = mapBounds.height + marginY;

  const isInBounds =
    coord.x >= 0 && coord.x <= mapBounds.width && coord.y >= 0 && coord.y <= mapBounds.height;

  const clamped = {
    x: clamp(coord.x, minX, maxX),
    y: clamp(coord.y, minY, maxY),
  };

  return {
    clamped,
    isValid:
      !Number.isNaN(coord.x) &&
      !Number.isNaN(coord.y) &&
      Number.isFinite(coord.x) &&
      Number.isFinite(coord.y),
    outOfBounds: !isInBounds,
  };
}

// ============================================================================
// Legacy Transform Functions (for backward compatibility)
// ============================================================================

/**
 * Transform world coordinates to viewport coordinates
 */
export function worldToViewport(
  worldPoint: Point,
  viewCenter: Point,
  zoom: number,
  viewportBounds: ViewportBounds,
): Point {
  return {
    x: (worldPoint.x - viewCenter.x) * zoom + viewportBounds.width / 2,
    y: (worldPoint.y - viewCenter.y) * zoom + viewportBounds.height / 2,
  };
}

/**
 * Transform viewport coordinates to world coordinates
 */
export function viewportToWorld(
  viewportPoint: Point,
  viewCenter: Point,
  zoom: number,
  viewportBounds: ViewportBounds,
): Point {
  return {
    x: (viewportPoint.x - viewportBounds.width / 2) / zoom + viewCenter.x,
    y: (viewportPoint.y - viewportBounds.height / 2) / zoom + viewCenter.y,
  };
}

/**
 * Calculate the new view center when zooming while keeping a specific point fixed
 */
export function calculateZoomCenter(
  fixedWorldPoint: Point,
  fixedViewportPoint: Point,
  newZoom: number,
  viewportBounds: ViewportBounds,
): Point {
  const newViewCenterX =
    fixedWorldPoint.x - (fixedViewportPoint.x - viewportBounds.width / 2) / newZoom;
  const newViewCenterY =
    fixedWorldPoint.y - (fixedViewportPoint.y - viewportBounds.height / 2) / newZoom;

  return {
    x: newViewCenterX,
    y: newViewCenterY,
  };
}

/**
 * Calculate the visible world bounds for a given view state
 */
export function getVisibleWorldBounds(
  viewCenter: Point,
  zoom: number,
  viewportBounds: ViewportBounds,
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const visibleWidth = viewportBounds.width / zoom;
  const visibleHeight = viewportBounds.height / zoom;

  const left = viewCenter.x - visibleWidth / 2;
  const top = viewCenter.y - visibleHeight / 2;
  const right = left + visibleWidth;
  const bottom = top + visibleHeight;

  return {
    bottom,
    height: visibleHeight,
    left,
    right,
    top,
    width: visibleWidth,
  };
}

/**
 * Calculate SVG viewBox string for a given view state (legacy)
 */
export function calculateViewBox(
  viewCenter: Point,
  zoom: number,
  viewportBounds: ViewportBounds,
): string {
  const bounds = getVisibleWorldBounds(viewCenter, zoom, viewportBounds);
  return `${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`;
}

/**
 * Constrain a point to stay within map bounds
 */
export function constrainToMapBounds(
  point: Point,
  mapBounds: { width: number; height: number },
): Point {
  return {
    x: Math.max(0, Math.min(mapBounds.width, point.x)),
    y: Math.max(0, Math.min(mapBounds.height, point.y)),
  };
}

/**
 * Constrain zoom level to stay within specified bounds
 */
export function constrainZoom(zoom: number, minZoom: number, maxZoom: number): number {
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * Calculate the transform parameters for CSS/GSAP transforms
 */
export function calculateTransformParams(
  viewCenter: Point,
  zoom: number,
  viewportBounds: ViewportBounds,
  mapBounds: { width: number; height: number },
): {
  scale: number;
  translateX: number;
  translateY: number;
} {
  const baseScaleX = viewportBounds.width / mapBounds.width;
  const baseScaleY = viewportBounds.height / mapBounds.height;
  const baseScale = Math.min(baseScaleX, baseScaleY);

  const baseCenterX = (viewportBounds.width - mapBounds.width * baseScale) / 2;
  const baseCenterY = (viewportBounds.height - mapBounds.height * baseScale) / 2;

  const targetScreenX = viewportBounds.width / 2;
  const targetScreenY = viewportBounds.height / 2;

  const currentScreenX = viewCenter.x * baseScale * zoom;
  const currentScreenY = viewCenter.y * baseScale * zoom;

  const translateX = targetScreenX - currentScreenX - baseCenterX;
  const translateY = targetScreenY - currentScreenY - baseCenterY;

  return {
    scale: zoom,
    translateX,
    translateY,
  };
}

/**
 * Calculate smooth zoom transition parameters
 */
export function calculateSmoothZoom(
  currentViewState: MapViewState,
  targetZoom: number,
  fixedPoint?: Point,
  steps = 60,
): MapViewState[] {
  const states: MapViewState[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const zoom = lerp(currentViewState.zoom, targetZoom, t);

    let viewCenter = currentViewState.viewCenter;

    if (fixedPoint) {
      const viewportCenter = {
        x: currentViewState.viewportSize.width / 2,
        y: currentViewState.viewportSize.height / 2,
      };
      viewCenter = calculateZoomCenter(
        fixedPoint,
        viewportCenter,
        zoom,
        currentViewState.viewportSize,
      );
    }

    states.push({
      viewCenter,
      viewportSize: currentViewState.viewportSize,
      zoom,
    });
  }

  return states;
}
