/**
 * @module core/zoom
 * Semantic zoom: maps the current view scale to a discrete zoom level
 * that controls which layers and labels are visible.
 *
 * [P-4] Semantic Zoom: display information density changes with zoom level.
 */

// ── Zoom level type ───────────────────────────────────────────────────────────

/** Discrete zoom levels from campus overview (Z1) to space detail (Z5) */
export type ZoomLevel = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

/**
 * Scale thresholds for each zoom level transition.
 * e.g. scale < Z2 → Z1, scale >= Z2 and < Z3 → Z2, ...
 */
export const ZOOM_THRESHOLDS = {
  Z2: 0.2,  // campus overview → building group
  Z3: 0.5,  // building group  → building detail
  Z4: 1.0,  // building detail → floor detail
  Z5: 2.0,  // floor detail    → space detail
} as const

// ── Scale → zoom level ────────────────────────────────────────────────────────

/**
 * Map the current view matrix scale factor to a semantic zoom level.
 * @param scale  The scaleX component of the current view transform matrix.
 */
export const getZoomLevel = (scale: number): ZoomLevel => {
  if (scale < ZOOM_THRESHOLDS.Z2) return 'Z1'
  if (scale < ZOOM_THRESHOLDS.Z3) return 'Z2'
  if (scale < ZOOM_THRESHOLDS.Z4) return 'Z3'
  if (scale < ZOOM_THRESHOLDS.Z5) return 'Z4'
  return 'Z5'
}

// ── Layer visibility ──────────────────────────────────────────────────────────

export interface LayerVisibility {
  /** Building footprint polygons */
  buildingOutlines: boolean
  /** Floor-level space polygons */
  spaces: boolean
  /** Traversal graph nodes */
  nodes: boolean
  /** Traversal graph edges */
  edges: boolean
  /** Text labels for nodes and spaces */
  labels: boolean
  /** Metadata (capacity, manager, tags, etc.) */
  metadata: boolean
  /** Validation error/warning overlays */
  validation: boolean
}

/**
 * Return which layers should be visible at a given zoom level.
 *
 * Z1 — campus overview:  building outlines + building names only
 * Z2 — building group:   building outlines + floor count
 * Z3 — building detail:  floor outlines + major space names
 * Z4 — floor detail:     all spaces + nodes + edges
 * Z5 — space detail:     everything + metadata
 */
export const getLayerVisibility = (level: ZoomLevel): LayerVisibility => {
  switch (level) {
    case 'Z1':
      return { buildingOutlines: true,  spaces: false, nodes: false, edges: false, labels: false, metadata: false, validation: false }
    case 'Z2':
      return { buildingOutlines: true,  spaces: false, nodes: false, edges: false, labels: true,  metadata: false, validation: false }
    case 'Z3':
      return { buildingOutlines: true,  spaces: true,  nodes: false, edges: false, labels: true,  metadata: false, validation: false }
    case 'Z4':
      return { buildingOutlines: true,  spaces: true,  nodes: true,  edges: true,  labels: true,  metadata: false, validation: true  }
    case 'Z5':
      return { buildingOutlines: true,  spaces: true,  nodes: true,  edges: true,  labels: true,  metadata: true,  validation: true  }
  }
}
