/**
 * @module schema/graph
 * CampusGraph factory and type-safe accessor functions.
 */

import type {
  CampusGraph,
  GraphNode,
  GraphEdge,
  Space,
  Floor,
  Building,
  NodeId,
  EdgeId,
  SpaceId,
  FloorId,
  BuildingId,
} from './types'

export const SCHEMA_VERSION = '1.0.0'

/** Creates a new, empty CampusGraph with all stores initialized */
export const createEmptyCampusGraph = (): CampusGraph => ({
  version: SCHEMA_VERSION,
  lastModified: new Date().toISOString(),
  buildings: {},
  floors: {},
  nodes: {},
  edges: {},
  spaces: {},
})

// ── Type-safe accessors ───────────────────────────────────────────────────────

export const getNode     = (g: CampusGraph, id: NodeId):     GraphNode  | undefined => g.nodes[id]
export const getEdge     = (g: CampusGraph, id: EdgeId):     GraphEdge  | undefined => g.edges[id]
export const getSpace    = (g: CampusGraph, id: SpaceId):    Space      | undefined => g.spaces[id]
export const getFloor    = (g: CampusGraph, id: FloorId):    Floor      | undefined => g.floors[id]
export const getBuilding = (g: CampusGraph, id: BuildingId): Building   | undefined => g.buildings[id]
