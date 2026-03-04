/**
 * Point Clustering Utilities for Map Display
 *
 * Provides spatial clustering algorithms to group nearby points
 * on the map for better visual clarity and performance.
 */

import type { Coordinate, InteractivePoint, PointCluster } from "../../../types/map";
import { calculateDistance } from "../../../utils/mapCoordinates";

// ============================================================================
// Configuration
// ============================================================================

export interface ClusterOptions {
  /**
   * Maximum distance between points to be considered in the same cluster
   * (in SVG coordinate units)
   */
  radius: number;

  /**
   * Minimum number of points required to form a cluster
   */
  minPoints: number;

  /**
   * Whether clustering is enabled
   */
  enabled: boolean;
}

export const DEFAULT_CLUSTER_OPTIONS: ClusterOptions = {
  enabled: true,
  minPoints: 2,
  radius: 50,
};

// ============================================================================
// Clustering Algorithm
// ============================================================================

/**
 * Calculate cluster center (centroid) from multiple points
 */
function calculateClusterCenter(points: InteractivePoint[]): Coordinate {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.coordinates.x,
      y: acc.y + point.coordinates.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length,
  };
}

/**
 * Generate unique cluster ID from point IDs
 */
function generateClusterId(points: InteractivePoint[]): string {
  return `cluster-${points
    .map((p) => p.id)
    .sort()
    .join("-")}`;
}

/**
 * Simple distance-based clustering algorithm
 * Groups points that are within the specified radius of each other
 */
export function clusterPoints(
  points: InteractivePoint[],
  options: Partial<ClusterOptions> = {},
): { clusters: PointCluster[]; singles: InteractivePoint[] } {
  const opts = { ...DEFAULT_CLUSTER_OPTIONS, ...options };

  // If clustering is disabled or not enough points, return all as singles
  if (!opts.enabled || points.length < opts.minPoints) {
    return { clusters: [], singles: points };
  }

  const visited = new Set<string>();
  const clusters: PointCluster[] = [];
  const singles: InteractivePoint[] = [];

  // Process each point
  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    // Skip if already processed
    if (visited.has(point.id)) {
      continue;
    }

    // Find all nearby points within radius
    const nearbyPoints: InteractivePoint[] = [point];
    visited.add(point.id);

    for (let j = i + 1; j < points.length; j++) {
      const otherPoint = points[j];

      if (visited.has(otherPoint.id)) {
        continue;
      }

      const distance = calculateDistance(point.coordinates, otherPoint.coordinates);

      if (distance <= opts.radius) {
        nearbyPoints.push(otherPoint);
        visited.add(otherPoint.id);
      }
    }

    // Create cluster if enough points, otherwise treat as single
    if (nearbyPoints.length >= opts.minPoints) {
      clusters.push({
        coordinates: calculateClusterCenter(nearbyPoints),
        count: nearbyPoints.length,
        id: generateClusterId(nearbyPoints),
        points: nearbyPoints,
      });
    } else {
      singles.push(...nearbyPoints);
    }
  }

  return { clusters, singles };
}

/**
 * DBSCAN-like clustering algorithm (more sophisticated)
 * Groups points into clusters based on density
 */
export function dbscanCluster(
  points: InteractivePoint[],
  options: Partial<ClusterOptions> = {},
): { clusters: PointCluster[]; singles: InteractivePoint[] } {
  const opts = { ...DEFAULT_CLUSTER_OPTIONS, ...options };

  if (!opts.enabled || points.length < opts.minPoints) {
    return { clusters: [], singles: points };
  }

  const visited = new Set<string>();
  const clustered = new Set<string>();
  const clusters: PointCluster[] = [];

  // Find neighbors within radius
  const getNeighbors = (point: InteractivePoint): InteractivePoint[] => {
    return points.filter((p) => {
      if (p.id === point.id) return false;
      const distance = calculateDistance(point.coordinates, p.coordinates);
      return distance <= opts.radius;
    });
  };

  // Expand cluster from seed point
  const expandCluster = (seedPoint: InteractivePoint): InteractivePoint[] | null => {
    const neighbors = getNeighbors(seedPoint);

    if (neighbors.length < opts.minPoints - 1) {
      return null; // Not a core point
    }

    const clusterPoints: InteractivePoint[] = [seedPoint];
    const queue: InteractivePoint[] = [...neighbors];
    clustered.add(seedPoint.id);

    while (queue.length > 0) {
      const point = queue.shift();
      if (!point) continue;

      if (clustered.has(point.id)) {
        continue;
      }

      clustered.add(point.id);
      clusterPoints.push(point);

      const pointNeighbors = getNeighbors(point);

      if (pointNeighbors.length >= opts.minPoints - 1) {
        // This is also a core point, add its neighbors
        for (const neighbor of pointNeighbors) {
          if (!clustered.has(neighbor.id)) {
            queue.push(neighbor);
          }
        }
      }
    }

    return clusterPoints;
  };

  // Process each point
  for (const point of points) {
    if (visited.has(point.id)) {
      continue;
    }

    visited.add(point.id);
    const clusterPoints = expandCluster(point);

    if (clusterPoints) {
      clusters.push({
        coordinates: calculateClusterCenter(clusterPoints),
        count: clusterPoints.length,
        id: generateClusterId(clusterPoints),
        points: clusterPoints,
      });
    }
  }

  // Remaining points are singles
  const singles = points.filter((p) => !clustered.has(p.id));

  return { clusters, singles };
}

/**
 * Adaptive clustering based on zoom level
 * Adjusts cluster radius based on current zoom to maintain visual clarity
 */
export function adaptiveCluster(
  points: InteractivePoint[],
  zoomLevel: number,
  baseOptions: Partial<ClusterOptions> = {},
): { clusters: PointCluster[]; singles: InteractivePoint[] } {
  // Scale radius inversely with zoom
  // At high zoom (zoomed in), use smaller radius
  // At low zoom (zoomed out), use larger radius
  const scaledRadius = (baseOptions.radius || DEFAULT_CLUSTER_OPTIONS.radius) / zoomLevel;

  const options: ClusterOptions = {
    ...DEFAULT_CLUSTER_OPTIONS,
    ...baseOptions,
    radius: Math.max(20, Math.min(200, scaledRadius)), // Clamp between 20-200
  };

  return clusterPoints(points, options);
}

// ============================================================================
// Cluster Utilities
// ============================================================================

/**
 * Check if a point is within a cluster
 */
export function isPointInCluster(point: InteractivePoint, cluster: PointCluster): boolean {
  return cluster.points.some((p) => p.id === point.id);
}

/**
 * Find cluster containing a specific point
 */
export function findClusterForPoint(
  point: InteractivePoint,
  clusters: PointCluster[],
): PointCluster | null {
  return clusters.find((cluster) => isPointInCluster(point, cluster)) || null;
}

/**
 * Get all unique point types in a cluster
 */
export function getClusterTypes(cluster: PointCluster): string[] {
  const types = new Set(cluster.points.map((p) => p.type));
  return [...types];
}

/**
 * Calculate cluster bounding box
 */
export function getClusterBounds(cluster: PointCluster): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  const xs = cluster.points.map((p) => p.coordinates.x);
  const ys = cluster.points.map((p) => p.coordinates.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
}
