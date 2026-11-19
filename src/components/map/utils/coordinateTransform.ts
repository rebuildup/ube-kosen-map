import type { Coordinate, ViewBox } from "../../../types/map";

/**
 * Pure screen <-> SVG viewBox coordinate transforms.
 *
 * The SVG uses preserveAspectRatio="xMidYMid meet", so the rendered content
 * may be letterboxed/pillarboxed inside the SVG element. All conversions go
 * through the content rect so pins and hit tests agree with what is drawn.
 */

export interface MeasuredRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface SvgContentRect {
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
}

export interface MapBoundsSize {
  height: number;
  width: number;
}

/** DOMRect-like -> the measured-rect shape used by pure layout helpers. */
export const toMeasuredRect = (
  rect: Pick<MeasuredRect, "height" | "left" | "top" | "width">,
): MeasuredRect => ({
  height: rect.height,
  left: rect.left,
  top: rect.top,
  width: rect.width,
});

/**
 * The actual painted area of the map inside the SVG element, accounting for
 * aspect-ratio letterboxing. `bounds` is the un-zoomed map extent used only as
 * a fallback ratio when the viewBox has zero height.
 */
export const getSVGContentRect = (
  svgRect: { height: number; width: number },
  viewBox: ViewBox,
  bounds: MapBoundsSize,
): SvgContentRect => {
  const inferredRatio =
    viewBox.height === 0
      ? bounds.width / bounds.height
      : viewBox.width / viewBox.height;
  const svgRatio = svgRect.width / svgRect.height;

  if (inferredRatio > svgRatio) {
    const contentHeight = svgRect.width / inferredRatio;
    return {
      height: contentHeight,
      offsetX: 0,
      offsetY: (svgRect.height - contentHeight) / 2,
      width: svgRect.width,
    };
  }
  const contentWidth = svgRect.height * inferredRatio;
  return {
    height: svgRect.height,
    offsetX: (svgRect.width - contentWidth) / 2,
    offsetY: 0,
    width: contentWidth,
  };
};

/** Client (viewport) coordinates -> viewBox coordinates. */
export const clientToViewBoxCoordinate = (
  clientX: number,
  clientY: number,
  viewBox: ViewBox,
  svgRect: MeasuredRect,
  bounds: MapBoundsSize,
): Coordinate => {
  const relativeX = clientX - svgRect.left;
  const relativeY = clientY - svgRect.top;
  const contentRect = getSVGContentRect(svgRect, viewBox, bounds);
  const adjustedX = relativeX - contentRect.offsetX;
  const adjustedY = relativeY - contentRect.offsetY;
  return {
    x: viewBox.x + (adjustedX / contentRect.width) * viewBox.width,
    y: viewBox.y + (adjustedY / contentRect.height) * viewBox.height,
  };
};

/**
 * viewBox coordinates -> container-relative pixel coordinates for pin
 * placement. Returns null when no measurement is available yet.
 */
export const viewBoxToScreenCoordinate = (
  svgX: number,
  svgY: number,
  viewBox: ViewBox,
  svgRect: MeasuredRect,
  containerRect: MeasuredRect,
  bounds: MapBoundsSize,
): { x: number; y: number } | null => {
  if (svgRect.width <= 0 || svgRect.height <= 0) return null;
  const contentRect = getSVGContentRect(svgRect, viewBox, bounds);
  const relativeX = (svgX - viewBox.x) / viewBox.width;
  const relativeY = (svgY - viewBox.y) / viewBox.height;
  const svgAbsoluteX =
    svgRect.left + contentRect.offsetX + relativeX * contentRect.width;
  const svgAbsoluteY =
    svgRect.top + contentRect.offsetY + relativeY * contentRect.height;
  return {
    x: svgAbsoluteX - containerRect.left,
    y: svgAbsoluteY - containerRect.top,
  };
};

const MAP_CLICK_MARGIN_FACTOR = 2;
const MAP_CLICK_SVG_MARGIN_FACTOR = 10;

/**
 * Client coordinates -> clamped, rounded map coordinate for onMapClick.
 * Returns null when the point is implausibly far outside the SVG (the old
 * 10x-size guard that suppresses stray clicks after drags).
 */
export const clientToMapCoordinate = (
  clientX: number,
  clientY: number,
  viewBox: ViewBox,
  svgRect: MeasuredRect,
  bounds: MapBoundsSize,
): Coordinate | null => {
  const svgMargin =
    Math.max(svgRect.width, svgRect.height) * MAP_CLICK_SVG_MARGIN_FACTOR;
  if (
    clientX < svgRect.left - svgMargin ||
    clientX > svgRect.left + svgRect.width + svgMargin ||
    clientY < svgRect.top - svgMargin ||
    clientY > svgRect.top + svgRect.height + svgMargin
  ) {
    return null;
  }

  const viewBoxPoint = clientToViewBoxCoordinate(
    clientX,
    clientY,
    viewBox,
    svgRect,
    bounds,
  );

  const mapMargin =
    Math.max(bounds.width, bounds.height) * MAP_CLICK_MARGIN_FACTOR;
  const clampedX = Math.max(
    -mapMargin,
    Math.min(bounds.width + mapMargin, viewBoxPoint.x),
  );
  const clampedY = Math.max(
    -mapMargin,
    Math.min(bounds.height + mapMargin, viewBoxPoint.y),
  );

  return {
    x: Math.round(clampedX * 100) / 100,
    y: Math.round(clampedY * 100) / 100,
  };
};
