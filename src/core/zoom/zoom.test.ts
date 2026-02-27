import { describe, it, expect } from 'vitest'
import {
  getZoomLevel,
  getLayerVisibility,
  ZOOM_THRESHOLDS,
} from './index'
import type { ZoomLevel } from './index'

describe('getZoomLevel', () => {
  it('returns Z1 for very small scale', () => {
    expect(getZoomLevel(0.1)).toBe('Z1')
  })

  it('returns Z5 for large scale', () => {
    expect(getZoomLevel(5.0)).toBe('Z5')
  })

  it('transitions through all levels as scale increases', () => {
    const levels: ZoomLevel[] = [
      getZoomLevel(0.1),
      getZoomLevel(0.3),
      getZoomLevel(0.7),
      getZoomLevel(1.5),
      getZoomLevel(3.0),
    ]
    // Each level should be ≥ the previous
    const order: ZoomLevel[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
    for (let i = 1; i < levels.length; i++) {
      expect(order.indexOf(levels[i]!)).toBeGreaterThanOrEqual(order.indexOf(levels[i - 1]!))
    }
  })

  it('uses defined thresholds', () => {
    expect(getZoomLevel(ZOOM_THRESHOLDS.Z2 - 0.001)).toBe('Z1')
    expect(getZoomLevel(ZOOM_THRESHOLDS.Z2)).toBe('Z2')
  })
})

describe('getLayerVisibility', () => {
  it('at Z1 shows only building outlines, hides node/edge layers', () => {
    const vis = getLayerVisibility('Z1')
    expect(vis.buildingOutlines).toBe(true)
    expect(vis.nodes).toBe(false)
    expect(vis.edges).toBe(false)
  })

  it('at Z4 shows all main layers', () => {
    const vis = getLayerVisibility('Z4')
    expect(vis.buildingOutlines).toBe(true)
    expect(vis.spaces).toBe(true)
    expect(vis.nodes).toBe(true)
    expect(vis.edges).toBe(true)
  })

  it('at Z5 shows all layers including metadata', () => {
    const vis = getLayerVisibility('Z5')
    expect(vis.metadata).toBe(true)
  })

  it('returns a complete LayerVisibility object for all zoom levels', () => {
    const levels: ZoomLevel[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']
    for (const level of levels) {
      const vis = getLayerVisibility(level)
      expect(typeof vis.buildingOutlines).toBe('boolean')
      expect(typeof vis.spaces).toBe('boolean')
      expect(typeof vis.nodes).toBe('boolean')
      expect(typeof vis.edges).toBe('boolean')
      expect(typeof vis.labels).toBe('boolean')
      expect(typeof vis.metadata).toBe('boolean')
    }
  })
})
