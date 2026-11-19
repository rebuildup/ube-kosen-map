import { CAMPUS_MAP_BOUNDS } from "../../../data/buildings";
import type { Coordinate } from "../../../types/map";

/**
 * Fixed map rotation applied to the inline campus SVG.
 *
 * The map content is rotated 90 degrees inside the SVG viewport, so every
 * map-space coordinate passes through this transform. Rotation is a build-time
 * constant (the interactive rotate mode was removed in #39); keeping it as a
 * pure module makes the transform testable and keeps VectorMap free of
 * per-render trigonometry.
 */
export const MAP_ROTATION_DEGREES = 90;

const W = CAMPUS_MAP_BOUNDS.width;
const H = CAMPUS_MAP_BOUNDS.height;

const rotationRad = (MAP_ROTATION_DEGREES * Math.PI) / 180;
const cosA = Math.cos(rotationRad);
const sinA = Math.sin(rotationRad);

// Translation that keeps the rotated content inside positive coordinate space.
const tx = H * Math.max(0, sinA) + W * Math.max(0, -cosA);
const ty = W * Math.max(0, -sinA) + H * Math.max(0, -cosA);

/** SVG <g> transform for the rotated map layer. */
export const MAP_LAYER_TRANSFORM = `translate(${tx}, ${ty}) rotate(${MAP_ROTATION_DEGREES})`;

/** Axis-aligned bounds of the rotated map content in viewBox space. */
export const ROTATED_MAP_BOUNDS = {
  height: W * Math.abs(sinA) + H * Math.abs(cosA),
  width: W * Math.abs(cosA) + H * Math.abs(sinA),
};

export interface PinTransformOptions {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

/** Original (unrotated) map coordinate -> rotated viewBox coordinate. */
export const transformPinCoordinate = (
  x: number,
  y: number,
  options: PinTransformOptions = {},
): Coordinate => {
  const scale = options.scale ?? 1;
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  const scaledX = x * scale + offsetX;
  const scaledY = y * scale + offsetY;
  return {
    x: scaledX * cosA - scaledY * sinA + tx,
    y: scaledX * sinA + scaledY * cosA + ty,
  };
};

/** Rotated viewBox coordinate -> original (unrotated) map coordinate.
 *  Does not invert pin scale/offset; callers that need that must apply it. */
export const inverseTransformPinCoordinate = (
  rotatedX: number,
  rotatedY: number,
): Coordinate => {
  const dx = rotatedX - tx;
  const dy = rotatedY - ty;
  return {
    x: dx * cosA + dy * sinA,
    y: -dx * sinA + dy * cosA,
  };
};
