/**
 * @module core/autolink
 * Topological autolink: door placement triggers automatic edge generation.
 *
 * When a door is placed on a wall shared by two spaces, an edge is
 * automatically created between anchor nodes in those spaces.
 *
 * [P-1] Topology First: door placement maintains graph connectivity.
 * [P-2] Constraint-Driven: doors can only be placed on valid wall segments.
 */

import type { Vec2 } from '../../math'
import { distance, nearestPointOnSegment, centroid } from '../../math'
import type { CampusGraph, NodeId, EdgeId, Space } from '../schema'
import { createNodeId, createEdgeId } from '../schema'
import { type Result, ok, err } from '../graph/result'

export type { Result } from '../graph/result'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlaceDoorResult {
  graph: CampusGraph
  anchorNodeIds: [NodeId, NodeId]
  edgeId: EdgeId
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const WALL_THRESHOLD = 2 // world units — how close must cursor be to a wall

/**
 * Find all polygon edge segments of a space as [start, end] pairs.
 */
const spaceSegments = (space: Space): [Vec2, Vec2][] => {
  const verts = space.polygon?.vertices ?? []
  if (verts.length < 2) return []
  return verts.map((v, i) => [v, verts[(i + 1) % verts.length]] as [Vec2, Vec2])
}

/**
 * Check if two segments are the same wall (same or reversed direction).
 * We normalize by comparing rounded endpoint coordinates.
 */
const segmentKey = (a: Vec2, b: Vec2): string => {
  const [p, q] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a]
  return `${p.x},${p.y}|${q.x},${q.y}`
}

interface WallHit {
  spaceId: string
  segA: Vec2
  segB: Vec2
  nearest: Vec2
  dist: number
}

/**
 * For all spaces, find segments within threshold distance of position.
 * Returns hits sorted by distance (closest first).
 */
const findWallHits = (position: Vec2, graph: CampusGraph, threshold: number): WallHit[] => {
  const hits: WallHit[] = []
  for (const space of Object.values(graph.spaces)) {
    for (const [a, b] of spaceSegments(space)) {
      const nearest = nearestPointOnSegment(position, a, b)
      const dist = distance(position, nearest)
      if (dist <= threshold) {
        hits.push({ spaceId: space.id, segA: a, segB: b, nearest, dist })
      }
    }
  }
  hits.sort((a, b) => a.dist - b.dist)
  return hits
}

/**
 * Find two spaces that share the wall containing the given position.
 * Returns [spaceA, spaceB] if found, null otherwise.
 */
const findAdjacentSpaces = (
  position: Vec2,
  graph: CampusGraph,
  threshold: number,
): [Space, Space] | null => {
  const hits = findWallHits(position, graph, threshold)
  if (hits.length === 0) return null

  // Group hits by normalized segment key
  const byKey = new Map<string, WallHit[]>()
  for (const hit of hits) {
    const key = segmentKey(hit.segA, hit.segB)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(hit)
  }

  // Find a segment key shared by exactly 2 different spaces
  for (const [, wallHits] of byKey) {
    const spaceIds = [...new Set(wallHits.map(h => h.spaceId))]
    if (spaceIds.length >= 2) {
      const s1 = graph.spaces[spaceIds[0]]
      const s2 = graph.spaces[spaceIds[1]]
      return [s1, s2]
    }
  }

  return null
}

/**
 * Get the first anchor node of a space, or create one at the polygon centroid.
 * Returns the updated graph and the node id.
 */
const getOrCreateAnchorNode = (
  graph: CampusGraph,
  space: Space,
): { graph: CampusGraph; nodeId: NodeId } => {
  const existingId = space.containedNodeIds?.[0]
  if (existingId && graph.nodes[existingId]) {
    return { graph, nodeId: existingId as NodeId }
  }

  const verts = space.polygon?.vertices ?? []
  const pos = verts.length >= 3 ? centroid({ vertices: verts }) : { x: 0, y: 0 }
  const nodeId = createNodeId()

  const g = clone(graph)
  g.nodes[nodeId] = { id: nodeId, position: pos }
  // Register in space.containedNodeIds
  if (!g.spaces[space.id].containedNodeIds) g.spaces[space.id].containedNodeIds = []
  g.spaces[space.id].containedNodeIds!.push(nodeId)

  return { graph: g, nodeId }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Place a door at `position`, which must lie on a wall shared by two spaces.
 *
 * Creates anchor nodes in both spaces (or reuses existing ones) and
 * auto-generates an edge connecting them.
 */
export const placeDoor = (
  graph: CampusGraph,
  position: Vec2,
  threshold = WALL_THRESHOLD,
): Result<PlaceDoorResult> => {
  const adjacent = findAdjacentSpaces(position, graph, threshold)
  if (!adjacent) {
    return err(new Error(
      `Position (${position.x}, ${position.y}) is not on a shared wall between two spaces.`,
    ))
  }

  const [spaceA, spaceB] = adjacent

  // Create or reuse anchor nodes
  const r1 = getOrCreateAnchorNode(graph, spaceA)
  const r2 = getOrCreateAnchorNode(r1.graph, r1.graph.spaces[spaceB.id])

  // Create edge between anchor nodes
  const edgeId = createEdgeId()
  const g = clone(r2.graph)
  g.edges[edgeId] = {
    id: edgeId,
    sourceNodeId: r1.nodeId,
    targetNodeId: r2.nodeId,
  }

  return ok({
    graph: g,
    anchorNodeIds: [r1.nodeId, r2.nodeId],
    edgeId,
  })
}

/**
 * Remove a door by deleting its associated edge.
 * Anchor nodes are preserved (they may be referenced by other doors/edges).
 */
export const removeDoor = (
  graph: CampusGraph,
  edgeId: EdgeId,
): Result<CampusGraph> => {
  if (!graph.edges[edgeId]) {
    return err(new Error(`Door edge "${edgeId}" not found.`))
  }
  const g = clone(graph)
  delete g.edges[edgeId]
  return ok(g)
}
