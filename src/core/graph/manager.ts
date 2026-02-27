/**
 * @module graph/manager
 * Immutable CRUD operations for CampusGraph.
 *
 * All operations:
 * - return a new CampusGraph (never mutate the input)
 * - run the autocomplete pipeline after mutation
 * - return Result<CampusGraph, Error> so callers can handle errors without try/catch
 *
 * [P-1] Topology First: edge validity is checked before committing
 * [P-2] Constraint-Driven: invalid operations return descriptive errors
 * [P-5] Autocomplete is applied on every mutation
 */

import type {
  CampusGraph, GraphNode, GraphEdge, Space,
  NodeId, EdgeId, SpaceId,
} from '../schema'
import { autoComplete } from '../autocomplete'
import { isSelfIntersecting } from '../../math'
import { type Result, ok, err } from './result'

// ── Internal helpers ──────────────────────────────────────────────────────────

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

// ── Node CRUD ─────────────────────────────────────────────────────────────────

export const addNode = (
  graph: CampusGraph,
  node: GraphNode,
): Result<CampusGraph> => {
  if (graph.nodes[node.id]) {
    return err(new Error(`Node "${node.id}" already exists (NI-4).`))
  }
  const g = clone(graph)
  g.nodes[node.id] = node
  return ok(autoComplete(g))
}

export const updateNode = (
  graph: CampusGraph,
  id: NodeId,
  patch: Partial<Omit<GraphNode, 'id'>>,
): Result<CampusGraph> => {
  if (!graph.nodes[id]) {
    return err(new Error(`Node "${id}" not found.`))
  }
  const g = clone(graph)
  g.nodes[id] = { ...g.nodes[id]!, ...patch, id }
  return ok(autoComplete(g))
}

export const deleteNode = (
  graph: CampusGraph,
  id: NodeId,
): Result<CampusGraph> => {
  if (!graph.nodes[id]) {
    return err(new Error(`Node "${id}" not found.`))
  }
  const g = clone(graph)
  delete g.nodes[id]
  // Remove all edges that reference this node
  for (const [eid, edge] of Object.entries(g.edges)) {
    if (edge.sourceNodeId === id || edge.targetNodeId === id) {
      delete g.edges[eid]
    }
  }
  return ok(autoComplete(g))
}

// ── Edge CRUD ─────────────────────────────────────────────────────────────────

export const addEdge = (
  graph: CampusGraph,
  edge: GraphEdge,
): Result<CampusGraph> => {
  // EI-1: both nodes must exist
  if (!graph.nodes[edge.sourceNodeId] || !graph.nodes[edge.targetNodeId]) {
    return err(new Error(
      `Edge "${edge.id}": source or target node not found [EI-1].`,
    ))
  }
  // EI-2: no self-loop
  if (edge.sourceNodeId === edge.targetNodeId) {
    return err(new Error(
      `Edge "${edge.id}": source and target are the same node (self-loop) [EI-2].`,
    ))
  }
  const g = clone(graph)
  g.edges[edge.id] = edge
  return ok(autoComplete(g))
}

export const updateEdge = (
  graph: CampusGraph,
  id: EdgeId,
  patch: Partial<Omit<GraphEdge, 'id'>>,
): Result<CampusGraph> => {
  if (!graph.edges[id]) {
    return err(new Error(`Edge "${id}" not found.`))
  }
  const g = clone(graph)
  g.edges[id] = { ...g.edges[id]!, ...patch, id }
  return ok(autoComplete(g))
}

export const deleteEdge = (
  graph: CampusGraph,
  id: EdgeId,
): Result<CampusGraph> => {
  if (!graph.edges[id]) {
    return err(new Error(`Edge "${id}" not found.`))
  }
  const g = clone(graph)
  delete g.edges[id]
  return ok(autoComplete(g))
}

// ── Space CRUD ────────────────────────────────────────────────────────────────

export const addSpace = (
  graph: CampusGraph,
  space: Space,
): Result<CampusGraph> => {
  // SI-3: polygon must not be self-intersecting
  if (space.polygon && isSelfIntersecting(space.polygon)) {
    return err(new Error(
      `Space "${space.id}": polygon is self-intersecting [SI-3].`,
    ))
  }
  const g = clone(graph)
  g.spaces[space.id] = space
  return ok(autoComplete(g))
}

export const updateSpace = (
  graph: CampusGraph,
  id: SpaceId,
  patch: Partial<Omit<Space, 'id'>>,
): Result<CampusGraph> => {
  if (!graph.spaces[id]) {
    return err(new Error(`Space "${id}" not found.`))
  }
  const candidate = { ...graph.spaces[id]!, ...patch, id }
  if (candidate.polygon && isSelfIntersecting(candidate.polygon)) {
    return err(new Error(`Space "${id}": updated polygon is self-intersecting [SI-3].`))
  }
  const g = clone(graph)
  g.spaces[id] = candidate
  return ok(autoComplete(g))
}

export const deleteSpace = (
  graph: CampusGraph,
  id: SpaceId,
): Result<CampusGraph> => {
  if (!graph.spaces[id]) {
    return err(new Error(`Space "${id}" not found.`))
  }
  const g = clone(graph)
  delete g.spaces[id]
  return ok(autoComplete(g))
}
