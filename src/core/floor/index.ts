/**
 * @module core/floor
 * Multi-floor management: vertical link creation and floor integrity validation.
 *
 * [P-1] Topology First: vertical edges connect floors in the traversal graph.
 * [P-2] Constraint-Driven: staircase/elevator nodes require vertical link integrity.
 */

import type {
  CampusGraph, NodeId, BuildingId, Floor, ValidationIssue,
} from '../schema'
import { type Result, ok, err } from '../graph/result'

export type { Result } from '../graph/result'

// ── Clone helper ──────────────────────────────────────────────────────────────

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ── addVerticalLink ───────────────────────────────────────────────────────────

/**
 * Create a vertical edge between two nodes on different floors and update
 * each node's `verticalLinks` (above/below) to reference the other node.
 *
 * The node on the higher level floor is treated as "above".
 */
export const addVerticalLink = (
  graph: CampusGraph,
  nodeAId: NodeId,
  nodeBId: NodeId,
): Result<CampusGraph> => {
  const nodeA = graph.nodes[nodeAId]
  const nodeB = graph.nodes[nodeBId]

  if (!nodeA) return err(new Error(`Node "${nodeAId}" not found.`))
  if (!nodeB) return err(new Error(`Node "${nodeBId}" not found.`))

  if (!nodeA.floorId || !nodeB.floorId) {
    return err(new Error('Both nodes must have a floorId to create a vertical link.'))
  }

  if (nodeA.floorId === nodeB.floorId) {
    return err(new Error('Cannot create vertical link between nodes on the same floor.'))
  }

  // Determine which node is "above" based on floor level
  const floorA = graph.floors[nodeA.floorId]
  const floorB = graph.floors[nodeB.floorId]
  const levelA = floorA?.level ?? 0
  const levelB = floorB?.level ?? 0

  const [lowerNode, upperNode, lowerId, upperId] =
    levelA < levelB
      ? [nodeA, nodeB, nodeAId, nodeBId]
      : [nodeB, nodeA, nodeBId, nodeAId]

  const g = clone(graph)

  // Create the vertical edge
  const edgeId = `vert-${lowerId}-${upperId}` as Parameters<typeof g.edges>[0]
  g.edges[edgeId] = {
    id: edgeId as never,
    sourceNodeId: lowerId,
    targetNodeId: upperId,
    isVertical: true,
    direction: 'bidirectional',
  }

  // Update verticalLinks on both nodes
  g.nodes[lowerId] = {
    ...g.nodes[lowerId],
    verticalLinks: { ...(lowerNode.verticalLinks ?? {}), above: upperId },
  }
  g.nodes[upperId] = {
    ...g.nodes[upperId],
    verticalLinks: { ...(upperNode.verticalLinks ?? {}), below: lowerId },
  }

  return ok(g)
}

// ── Floor query utilities ─────────────────────────────────────────────────────

/**
 * Returns all floors belonging to a building, sorted by level (ascending).
 */
export const getFloorsForBuilding = (
  graph: CampusGraph,
  buildingId: BuildingId,
): Floor[] => {
  const building = graph.buildings[buildingId]
  if (!building) return []

  return (building.floorIds ?? [])
    .map(fid => graph.floors[fid])
    .filter(Boolean)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
}

/**
 * Find the floor at a specific level within a building.
 */
export const getFloorByLevel = (
  graph: CampusGraph,
  buildingId: BuildingId,
  level: number,
): Floor | undefined =>
  getFloorsForBuilding(graph, buildingId).find(f => f.level === level)

// ── Staircase integrity validation ────────────────────────────────────────────

/**
 * Check that all staircase and elevator nodes have vertical links.
 * Returns NI-2 warnings for any that are missing.
 */
export const validateStaircaseIntegrity = (graph: CampusGraph): ValidationIssue[] => {
  const issues: ValidationIssue[] = []

  for (const node of Object.values(graph.nodes)) {
    if (node.type !== 'staircase' && node.type !== 'elevator') continue
    if (!node.verticalLinks?.above && !node.verticalLinks?.below) {
      issues.push({
        ruleId: 'NI-2',
        severity: 'warning',
        message: `Node "${node.id}" (${node.type}) has no vertical links (above or below).`,
        targetIds: [node.id],
        policy: 'P-1',
      })
    }
  }

  return issues
}
