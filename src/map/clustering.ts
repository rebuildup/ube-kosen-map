// src/map/clustering.ts
import type { Coordinate, InteractivePoint, PointCluster } from './types'

export interface ClusterOptions {
  radius: number
  minPoints: number
}

function dist(a: Coordinate, b: Coordinate): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function centroid(points: InteractivePoint[]): Coordinate {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.coordinates.x, y: acc.y + p.coordinates.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

export function clusterPoints(
  points: InteractivePoint[],
  options: ClusterOptions = { radius: 50, minPoints: 2 },
): { clusters: PointCluster[]; singles: InteractivePoint[] } {
  if (points.length === 0) return { clusters: [], singles: [] }
  if (points.length < options.minPoints) return { clusters: [], singles: [...points] }

  const visited = new Set<string>()
  const clusters: PointCluster[] = []
  const singles: InteractivePoint[] = []

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    if (visited.has(point.id)) continue

    const nearby: InteractivePoint[] = [point]
    visited.add(point.id)

    for (let j = i + 1; j < points.length; j++) {
      const other = points[j]
      if (visited.has(other.id)) continue
      if (dist(point.coordinates, other.coordinates) <= options.radius) {
        nearby.push(other)
        visited.add(other.id)
      }
    }

    if (nearby.length >= options.minPoints) {
      clusters.push({
        id: `cluster-${nearby.map(p => p.id).sort().join('-')}`,
        coordinates: centroid(nearby),
        points: nearby,
        count: nearby.length,
      })
    } else {
      singles.push(...nearby)
    }
  }

  return { clusters, singles }
}
