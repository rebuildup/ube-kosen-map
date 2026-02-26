/**
 * @module core/snap
 * Snap engine for the trace editor.
 *
 * Priority: vertex > edge > orthogonal/parallel > grid > free
 *
 * [P-2] Constraint-Driven: snapping constrains free-form input to geometrically consistent positions.
 * [P-6] Mathematical Abstraction: uses Vec2 distance/nearest-point calculations from math library.
 */

import type { Vec2 } from '../../math'
import { distance, nearestPointOnSegment } from '../../math'
import type { SnapConfig, SnapContext, SnapResult } from './types'

export type { SnapConfig, SnapContext, SnapResult, SnapType } from './types'

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: Required<SnapConfig> = {
  vertexThreshold: 8,
  edgeThreshold: 6,
  orthogonalThreshold: 5,
  gridSize: null,
  enableGrid: false,
  enableOrthogonal: true,
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

const snapToGrid = (v: number, gridSize: number): number =>
  Math.round(v / gridSize) * gridSize

// ── Orthogonal snap helpers ───────────────────────────────────────────────────

/**
 * If the cursor is within `threshold` of a horizontal or vertical axis
 * from `previousPoint`, snap the cursor to that axis.
 */
const tryOrthogonalSnap = (
  cursor: Vec2,
  previousPoint: Vec2,
  threshold: number,
): SnapResult | null => {
  const dx = Math.abs(cursor.x - previousPoint.x)
  const dy = Math.abs(cursor.y - previousPoint.y)

  // Horizontal axis: cursor.y ≈ previousPoint.y
  if (dy <= threshold && dx > dy) {
    const snapped: Vec2 = { x: cursor.x, y: previousPoint.y }
    return {
      type: 'orthogonal',
      position: snapped,
      snapTarget: { x: previousPoint.x, y: previousPoint.y },
      guideLine: [{ x: previousPoint.x, y: previousPoint.y }, snapped],
    }
  }

  // Vertical axis: cursor.x ≈ previousPoint.x
  if (dx <= threshold && dy > dx) {
    const snapped: Vec2 = { x: previousPoint.x, y: cursor.y }
    return {
      type: 'orthogonal',
      position: snapped,
      snapTarget: { x: previousPoint.x, y: previousPoint.y },
      guideLine: [{ x: previousPoint.x, y: previousPoint.y }, snapped],
    }
  }

  return null
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Find the best snap position for a cursor in world coordinates.
 *
 * @param cursor  Current cursor position in world coordinates
 * @param context Existing vertices and edge segments
 * @param config  Snap configuration (thresholds, grid, flags)
 * @returns       SnapResult with resolved position and snap type
 */
export const findSnap = (
  cursor: Vec2,
  context: SnapContext,
  config: SnapConfig = {},
): SnapResult => {
  const cfg: Required<SnapConfig> = { ...DEFAULTS, ...config }

  // ── 1. Vertex snap ──────────────────────────────────────────────────────────
  if (context.vertices.length > 0 && cfg.vertexThreshold > 0) {
    let closestDist = Infinity
    let closestVertex: Vec2 | null = null

    for (const v of context.vertices) {
      const d = distance(cursor, v)
      if (d < closestDist) {
        closestDist = d
        closestVertex = v
      }
    }

    if (closestVertex !== null && closestDist <= cfg.vertexThreshold) {
      return { type: 'vertex', position: closestVertex, snapTarget: closestVertex }
    }
  }

  // ── 2. Edge snap ────────────────────────────────────────────────────────────
  if (context.segments.length > 0 && cfg.edgeThreshold > 0) {
    let closestDist = Infinity
    let closestPoint: Vec2 | null = null

    for (const [a, b] of context.segments) {
      const nearest = nearestPointOnSegment(cursor, a, b)
      const d = distance(cursor, nearest)
      if (d < closestDist) {
        closestDist = d
        closestPoint = nearest
      }
    }

    if (closestPoint !== null && closestDist <= cfg.edgeThreshold) {
      return { type: 'edge', position: closestPoint, snapTarget: closestPoint }
    }
  }

  // ── 3. Orthogonal/parallel snap ─────────────────────────────────────────────
  if (cfg.enableOrthogonal && context.previousPoint) {
    const ortho = tryOrthogonalSnap(cursor, context.previousPoint, cfg.orthogonalThreshold)
    if (ortho) return ortho
  }

  // ── 4. Grid snap ────────────────────────────────────────────────────────────
  if (cfg.enableGrid && cfg.gridSize && cfg.gridSize > 0) {
    const snapped: Vec2 = {
      x: snapToGrid(cursor.x, cfg.gridSize),
      y: snapToGrid(cursor.y, cfg.gridSize),
    }
    return { type: 'grid', position: snapped }
  }

  // ── 5. Free (no snap) ───────────────────────────────────────────────────────
  return { type: 'free', position: cursor }
}
