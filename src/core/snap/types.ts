/**
 * @module core/snap/types
 * Type definitions for the snap engine.
 */

import type { Vec2 } from '../../math'

export type SnapType = 'vertex' | 'edge' | 'orthogonal' | 'parallel' | 'grid' | 'free'

export interface SnapConfig {
  /** Pixel-equivalent threshold for vertex snap (default: 8) */
  vertexThreshold?: number
  /** Pixel-equivalent threshold for edge snap (default: 6) */
  edgeThreshold?: number
  /** Threshold for orthogonal/parallel guide snap (default: 5) */
  orthogonalThreshold?: number
  /** Grid cell size in world units. null/undefined = disabled */
  gridSize?: number | null
  /** Whether grid snap is active (default: false) */
  enableGrid?: boolean
  /** Whether orthogonal/parallel snap is active (default: true) */
  enableOrthogonal?: boolean
}

export interface SnapContext {
  /** All existing vertices in world coordinates */
  vertices: Vec2[]
  /** All existing edge segments as [start, end] pairs in world coordinates */
  segments: [Vec2, Vec2][]
  /** The last placed point (for orthogonal/parallel snap reference) */
  previousPoint?: Vec2
}

export interface SnapResult {
  /** The resolved (possibly snapped) position in world coordinates */
  position: Vec2
  /** What kind of snap was applied */
  type: SnapType
  /** The exact point we snapped to (vertex/edge snap), if applicable */
  snapTarget?: Vec2
  /** Guide line endpoints for rendering orthogonal/parallel guides */
  guideLine?: [Vec2, Vec2]
}
