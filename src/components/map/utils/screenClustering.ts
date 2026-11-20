/**
 * Screen-space clustering used by VectorMap.
 *
 * Grouping is decided in screen pixels (via an injected projection) while
 * cluster coordinates stay in the caller's map coordinate space. This keeps
 * the algorithm pure and testable: the component owns projection and
 * threshold policy, this module owns grouping.
 */

export interface ClusterablePoint {
  id: string;
  coordinates: { x: number; y: number };
}

export interface ScreenCluster<T extends ClusterablePoint> {
  id: string;
  coordinates: { x: number; y: number };
  count: number;
  points: T[];
}

export function clusterPointsOnScreen<T extends ClusterablePoint>(
  points: readonly T[],
  toScreenPoint: (point: T) => { x: number; y: number },
  getDistanceThresholdPx: (point: T) => number,
  excludeIds?: ReadonlySet<string>,
): ScreenCluster<T>[] {
  const clusters: ScreenCluster<T>[] = [];
  const usedPoints = new Set<string>();
  const screenPointCache = new Map<string, { x: number; y: number }>();

  const getCachedScreenPoint = (point: T) => {
    const cached = screenPointCache.get(point.id);
    if (cached) return cached;
    const next = toScreenPoint(point);
    screenPointCache.set(point.id, next);
    return next;
  };

  for (const point of points) {
    if (usedPoints.has(point.id) || excludeIds?.has(point.id)) continue;

    const members: T[] = [point];
    usedPoints.add(point.id);
    const pointScreen = getCachedScreenPoint(point);

    for (const otherPoint of points) {
      if (usedPoints.has(otherPoint.id) || excludeIds?.has(otherPoint.id)) {
        continue;
      }
      const otherScreen = getCachedScreenPoint(otherPoint);
      const pairThreshold = Math.max(
        getDistanceThresholdPx(point),
        getDistanceThresholdPx(otherPoint),
      );
      const distance = Math.hypot(
        otherScreen.x - pointScreen.x,
        otherScreen.y - pointScreen.y,
      );
      if (distance <= pairThreshold) {
        members.push(otherPoint);
        usedPoints.add(otherPoint.id);
      }
    }

    const centerX =
      members.reduce((sum, p) => sum + p.coordinates.x, 0) / members.length;
    const centerY =
      members.reduce((sum, p) => sum + p.coordinates.y, 0) / members.length;

    clusters.push({
      coordinates: { x: centerX, y: centerY },
      count: members.length,
      id: `cluster-${members
        .map((p) => p.id)
        .sort((a, b) => a.localeCompare(b))
        .join("-")}`,
      points: members,
    });
  }

  return clusters;
}
