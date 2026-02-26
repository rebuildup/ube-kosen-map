/**
 * @module schema/types
 * Graph data model type definitions for the campus spatial information system.
 *
 * Design principles:
 * - P-1 (Topology First): Node/Edge graph structure
 * - P-5 (Data Normalization): All fields optional, ID-reference joins, no embedding
 * - P-6 (Mathematical Abstraction): Positions as Vec2, shapes as Polygon
 */

import type { Vec2, Polygon } from '../../math/types'

// ── Branded ID types ──────────────────────────────────────────────────────────

/** Prevents mixing different ID kinds at the type level */
export type Brand<T, B extends string> = T & { readonly __brand: B }

export type NodeId     = Brand<string, 'NodeId'>
export type EdgeId     = Brand<string, 'EdgeId'>
export type SpaceId    = Brand<string, 'SpaceId'>
export type FloorId    = Brand<string, 'FloorId'>
export type BuildingId = Brand<string, 'BuildingId'>
export type ProfileId  = Brand<string, 'ProfileId'>

// ── Union types ───────────────────────────────────────────────────────────────

export type NodeType =
  | 'room'
  | 'corridor_junction'
  | 'staircase'
  | 'elevator'
  | 'entrance'
  | 'outdoor_point'
  | 'other'

export type SpaceType =
  | 'classroom'
  | 'lab'
  | 'office'
  | 'corridor'
  | 'stairwell'
  | 'restroom'
  | 'storage'
  | 'common'
  | 'outdoor'
  | 'other'

export type EdgeDirection = 'bidirectional' | 'forward' | 'backward'

export type Severity = 'error' | 'warning'

// ── Entity types ──────────────────────────────────────────────────────────────

/** Graph vertex: an abstract representation of a traversable location */
export interface GraphNode {
  id: NodeId
  type?: NodeType
  position?: Vec2
  floorId?: FloorId
  buildingId?: BuildingId
  label?: string
  /** Vertical connections to nodes on adjacent floors */
  verticalLinks?: {
    above?: NodeId
    below?: NodeId
  }
  properties?: Record<string, unknown>
}

/** Graph edge: a traversable connection between two nodes */
export interface GraphEdge {
  id: EdgeId
  sourceNodeId: NodeId
  targetNodeId: NodeId
  direction?: EdgeDirection
  distance?: number
  hasSteps?: boolean
  isOutdoor?: boolean
  width?: number
  isVertical?: boolean
  label?: string
  tags?: string[]
  properties?: Record<string, unknown>
}

/** Physical space represented as a polygon; contains one or more nodes */
export interface Space {
  id: SpaceId
  type?: SpaceType
  name?: string
  buildingId?: BuildingId
  floorId?: FloorId
  polygon?: Polygon
  containedNodeIds?: NodeId[]
  manager?: string
  capacity?: number
  tags?: string[]
  notes?: string
  properties?: Record<string, unknown>
}

/** A single floor level within a building */
export interface Floor {
  id: FloorId
  buildingId?: BuildingId
  level?: number
  name?: string
  baseImageUrl?: string
  imageOffset?: Vec2
  imageScale?: number
  properties?: Record<string, unknown>
}

/** A building within the campus */
export interface Building {
  id: BuildingId
  name?: string
  shortName?: string
  outline?: Polygon
  floorIds?: FloorId[]
  position?: Vec2
  properties?: Record<string, unknown>
}

// ── Validation types ──────────────────────────────────────────────────────────

export interface ValidationIssue {
  ruleId: string
  severity: Severity
  message: string
  targetIds: string[]
  policy: 'P-1' | 'P-2' | 'P-5'
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  summary: {
    errors: number
    warnings: number
  }
}

// ── Root graph type ───────────────────────────────────────────────────────────

/** Normalized root object containing all campus spatial data */
export interface CampusGraph {
  /** Schema version for backwards compatibility */
  version: string
  /** Last modification timestamp (ISO 8601) */
  lastModified: string
  buildings: Record<string, Building>
  floors:    Record<string, Floor>
  nodes:     Record<string, GraphNode>
  edges:     Record<string, GraphEdge>
  spaces:    Record<string, Space>
}
