// src/map/clustering.test.ts
import { describe, it, expect } from 'vitest'
import { clusterPoints } from './clustering'
import type { InteractivePoint } from './types'

const pt = (id: string, x: number, y: number): InteractivePoint => ({
  id, coordinates: { x, y }, title: id, type: 'room',
})

describe('clusterPoints', () => {
  it('returns all as singles when fewer than minPoints', () => {
    const result = clusterPoints([pt('a', 0, 0)], { radius: 50, minPoints: 2 })
    expect(result.clusters).toHaveLength(0)
    expect(result.singles).toHaveLength(1)
  })

  it('clusters nearby points', () => {
    const points = [pt('a', 0, 0), pt('b', 10, 10), pt('c', 200, 200)]
    const result = clusterPoints(points, { radius: 50, minPoints: 2 })
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0].count).toBe(2)
    expect(result.singles).toHaveLength(1)
  })

  it('uses adaptive radius based on zoom', () => {
    const points = [pt('a', 0, 0), pt('b', 30, 0), pt('c', 200, 0)]
    // High zoom = small radius -> no cluster
    const high = clusterPoints(points, { radius: 50 / 4, minPoints: 2 })
    expect(high.clusters).toHaveLength(0)
    // Low zoom = large radius -> cluster
    const low = clusterPoints(points, { radius: 50, minPoints: 2 })
    expect(low.clusters).toHaveLength(1)
  })

  it('handles empty input', () => {
    const result = clusterPoints([], { radius: 50, minPoints: 2 })
    expect(result.clusters).toHaveLength(0)
    expect(result.singles).toHaveLength(0)
  })

  it('all points in single cluster when all within radius', () => {
    const points = [pt('a', 0, 0), pt('b', 5, 0), pt('c', 10, 0)]
    const result = clusterPoints(points, { radius: 50, minPoints: 2 })
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0].count).toBe(3)
    expect(result.singles).toHaveLength(0)
  })

  it('cluster centroid is average of point coordinates', () => {
    const points = [pt('a', 0, 0), pt('b', 10, 10)]
    const result = clusterPoints(points, { radius: 50, minPoints: 2 })
    expect(result.clusters[0].coordinates.x).toBeCloseTo(5)
    expect(result.clusters[0].coordinates.y).toBeCloseTo(5)
  })

  it('cluster id is deterministic from sorted point ids', () => {
    const points = [pt('b', 0, 0), pt('a', 5, 0)]
    const result = clusterPoints(points, { radius: 50, minPoints: 2 })
    // sorted: a-b
    expect(result.clusters[0].id).toBe('cluster-a-b')
  })
})
