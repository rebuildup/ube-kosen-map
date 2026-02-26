/**
 * @module schema/ids
 * Branded ID creation utilities and type guards.
 *
 * Each ID kind embeds a `__brand` marker so the TypeScript compiler
 * prevents accidental mixing of different ID types at compile time.
 */

import type {
  NodeId, EdgeId, SpaceId, FloorId, BuildingId, ProfileId,
} from './types'

// ── Sentinel brand values stored in a WeakSet-like registry ──────────────────
// We track which string values were produced by each factory so that type guards
// can verify at runtime that a value was actually created with the right factory.

const nodeIds     = new Set<string>()
const edgeIds     = new Set<string>()
const spaceIds    = new Set<string>()
const floorIds    = new Set<string>()
const buildingIds = new Set<string>()
const profileIds  = new Set<string>()

const uuid = (): string => crypto.randomUUID()

// ── ID factories ──────────────────────────────────────────────────────────────

export const createNodeId = (): NodeId => {
  const id = uuid() as NodeId
  nodeIds.add(id)
  return id
}

export const createEdgeId = (): EdgeId => {
  const id = uuid() as EdgeId
  edgeIds.add(id)
  return id
}

export const createSpaceId = (): SpaceId => {
  const id = uuid() as SpaceId
  spaceIds.add(id)
  return id
}

export const createFloorId = (): FloorId => {
  const id = uuid() as FloorId
  floorIds.add(id)
  return id
}

export const createBuildingId = (): BuildingId => {
  const id = uuid() as BuildingId
  buildingIds.add(id)
  return id
}

export const createProfileId = (): ProfileId => {
  const id = uuid() as ProfileId
  profileIds.add(id)
  return id
}

// ── Type guards ───────────────────────────────────────────────────────────────

export const isNodeId     = (id: NodeId):     boolean => nodeIds.has(id)
export const isEdgeId     = (id: EdgeId):     boolean => edgeIds.has(id)
export const isSpaceId    = (id: SpaceId):    boolean => spaceIds.has(id)
export const isFloorId    = (id: FloorId):    boolean => floorIds.has(id)
export const isBuildingId = (id: BuildingId): boolean => buildingIds.has(id)
export const isProfileId  = (id: ProfileId):  boolean => profileIds.has(id)
