/**
 * @module core/schema
 * Graph data model: Branded IDs, entity types, and CampusGraph utilities.
 *
 * [P-1] Topology First: Node/Edge graph structure
 * [P-5] Data Normalization: ID-reference joins, all fields optional
 */

export type {
  Brand,
  NodeId, EdgeId, SpaceId, FloorId, BuildingId, ProfileId,
  NodeType, SpaceType, EdgeDirection, Severity,
  GraphNode, GraphEdge, Space, Floor, Building,
  ValidationIssue, ValidationResult,
  CampusGraph,
} from './types'

export {
  createNodeId, createEdgeId, createSpaceId,
  createFloorId, createBuildingId, createProfileId,
  isNodeId, isEdgeId, isSpaceId,
  isFloorId, isBuildingId, isProfileId,
} from './ids'

export {
  SCHEMA_VERSION,
  createEmptyCampusGraph,
  getNode, getEdge, getSpace, getFloor, getBuilding,
} from './graph'
