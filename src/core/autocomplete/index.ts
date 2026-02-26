/**
 * @module core/autocomplete
 * Auto-completion pipeline for CampusGraph data.
 *
 * [P-5] Data Normalization: all fields are optional; omitted values are
 *   automatically filled with defaults, inferred from relations, or
 *   computed from geometry.
 *
 * Pipeline stages:
 *   1. ID completion     — assign UUIDs to entities missing an id
 *   2. Default values    — fill missing fields with schema-defined defaults
 *   3. Relation inference — derive buildingId from floorId, isVertical from floors, etc.
 *   4. Geometric computation — calculate edge.distance from node positions
 */

import type { CampusGraph, GraphNode, GraphEdge, Space, Floor, FloorId } from '../schema'
import { distance } from '../../math'

// ── Deep clone helper ─────────────────────────────────────────────────────────

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ── Step 2: Default value fill ────────────────────────────────────────────────

const fillNode = (node: GraphNode): GraphNode => ({
  ...node,
  type:     node.type     ?? 'other',
  position: node.position ?? { x: 0, y: 0 },
})

const fillEdge = (edge: GraphEdge): GraphEdge => ({
  ...edge,
  direction: edge.direction ?? 'bidirectional',
  hasSteps:  edge.hasSteps  ?? false,
  isOutdoor: edge.isOutdoor ?? false,
  width:     edge.width     ?? 1.5,
})

const fillSpace = (space: Space): Space => ({
  ...space,
  type:             space.type             ?? 'other',
  containedNodeIds: space.containedNodeIds ?? [],
})

/** Converts a floor level number to a display name: 1 → "1F", -1 → "B1" */
const levelToName = (level: number): string =>
  level > 0 ? `${level}F` : level === 0 ? '1F' : `B${Math.abs(level)}`

const fillFloor = (floor: Floor): Floor => ({
  ...floor,
  imageOffset: floor.imageOffset ?? { x: 0, y: 0 },
  imageScale:  floor.imageScale  ?? 1.0,
  ...(floor.name === undefined && floor.level !== undefined
    ? { name: levelToName(floor.level) }
    : {}),
})

// ── Step 3: Relation inference ────────────────────────────────────────────────

/**
 * Build a floorId → buildingId lookup map from the buildings store.
 * Uses building.floorIds as the source of truth.
 */
const buildFloorToBuildingMap = (g: CampusGraph): Map<FloorId, string> => {
  const map = new Map<FloorId, string>()
  for (const building of Object.values(g.buildings)) {
    for (const fid of building.floorIds ?? []) {
      map.set(fid, building.id)
    }
  }
  return map
}

const inferRelations = (g: CampusGraph, floorToBuilding: Map<FloorId, string>): void => {
  // Node: floorId → buildingId
  for (const node of Object.values(g.nodes)) {
    if (!node.buildingId && node.floorId) {
      const bid = floorToBuilding.get(node.floorId)
      if (bid) node.buildingId = bid as typeof node.buildingId
    }
  }

  // Space: floorId → buildingId
  for (const space of Object.values(g.spaces)) {
    if (!space.buildingId && space.floorId) {
      const bid = floorToBuilding.get(space.floorId)
      if (bid) space.buildingId = bid as typeof space.buildingId
    }
  }

  // Edge: isVertical — true when source and target are on different floors
  for (const edge of Object.values(g.edges)) {
    if (edge.isVertical !== undefined) continue
    const src = g.nodes[edge.sourceNodeId]
    const dst = g.nodes[edge.targetNodeId]
    if (src?.floorId && dst?.floorId) {
      edge.isVertical = src.floorId !== dst.floorId
    } else {
      edge.isVertical = false
    }
  }
}

// ── Step 4: Geometric computation ─────────────────────────────────────────────

const computeGeometry = (g: CampusGraph): void => {
  for (const edge of Object.values(g.edges)) {
    if (edge.distance !== undefined) continue
    const src = g.nodes[edge.sourceNodeId]
    const dst = g.nodes[edge.targetNodeId]
    if (src?.position && dst?.position) {
      edge.distance = distance(src.position, dst.position)
    }
  }
}

// ── Public pipeline ───────────────────────────────────────────────────────────

/**
 * Runs the full auto-completion pipeline on a CampusGraph.
 *
 * Returns a new CampusGraph with all missing fields filled in.
 * Existing field values are never overwritten.
 * The pipeline is idempotent: running it twice yields the same entity data.
 */
export const autoComplete = (graph: CampusGraph): CampusGraph => {
  const g = clone(graph)

  // Step 2: fill defaults
  for (const [k, node] of Object.entries(g.nodes))  g.nodes[k]  = fillNode(node)
  for (const [k, edge] of Object.entries(g.edges))  g.edges[k]  = fillEdge(edge)
  for (const [k, s]    of Object.entries(g.spaces)) g.spaces[k] = fillSpace(s)
  for (const [k, f]    of Object.entries(g.floors)) g.floors[k] = fillFloor(f)

  // Step 3: relation inference
  const floorToBuilding = buildFloorToBuildingMap(g)
  inferRelations(g, floorToBuilding)

  // Step 4: geometric computation
  computeGeometry(g)

  g.lastModified = new Date().toISOString()
  return g
}
