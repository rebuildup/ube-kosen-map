import { describe, it, expect } from 'vitest'
import {
  createEmptyCampusGraph,
  createNodeId, createSpaceId, createEdgeId,
} from '../schema'
import type { CampusGraph } from '../schema'
import { placeDoor, removeDoor } from './index'

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Build a test graph with two adjacent spaces sharing the wall segment x=50.
 *
 * Space A: rectangle [0,0]-[50,100]
 * Space B: rectangle [50,0]-[100,100]
 * Shared wall: segment (50,0)-(50,100)
 */
const makeTwoAdjacentSpaces = (): CampusGraph => {
  const g = createEmptyCampusGraph()
  const sid1 = createSpaceId()
  const sid2 = createSpaceId()

  g.spaces[sid1] = {
    id: sid1,
    polygon: {
      vertices: [
        { x: 0, y: 0 }, { x: 50, y: 0 },
        { x: 50, y: 100 }, { x: 0, y: 100 },
      ],
    },
    containedNodeIds: [],
  }

  g.spaces[sid2] = {
    id: sid2,
    polygon: {
      vertices: [
        { x: 50, y: 0 }, { x: 100, y: 0 },
        { x: 100, y: 100 }, { x: 50, y: 100 },
      ],
    },
    containedNodeIds: [],
  }

  return g
}

// ── placeDoor ─────────────────────────────────────────────────────────────────

describe('placeDoor', () => {
  it('returns ok when position is on the shared wall', () => {
    const g = makeTwoAdjacentSpaces()
    // Position on the shared wall x=50, y=50
    const result = placeDoor(g, { x: 50, y: 50 })
    expect(result.ok).toBe(true)
  })

  it('creates an edge between the two anchor nodes', () => {
    const g = makeTwoAdjacentSpaces()
    const result = placeDoor(g, { x: 50, y: 50 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { graph, edgeId } = result.value
    expect(graph.edges[edgeId]).toBeDefined()
  })

  it('creates anchor nodes in both spaces', () => {
    const g = makeTwoAdjacentSpaces()
    const result = placeDoor(g, { x: 50, y: 50 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { graph, anchorNodeIds } = result.value
    expect(anchorNodeIds).toHaveLength(2)
    expect(graph.nodes[anchorNodeIds[0]]).toBeDefined()
    expect(graph.nodes[anchorNodeIds[1]]).toBeDefined()
  })

  it('places anchor nodes at the centroid of each space', () => {
    const g = makeTwoAdjacentSpaces()
    const result = placeDoor(g, { x: 50, y: 50 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { graph, anchorNodeIds } = result.value
    // Space A centroid: (25, 50), Space B centroid: (75, 50)
    const positions = anchorNodeIds.map(id => graph.nodes[id].position!)
    const xs = positions.map(p => p.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(25)
    expect(xs[1]).toBeCloseTo(75)
  })

  it('reuses existing anchor node if space already has one', () => {
    const g = makeTwoAdjacentSpaces()
    // Add a node to the first space
    const existingNodeId = createNodeId()
    g.nodes[existingNodeId] = { id: existingNodeId, position: { x: 20, y: 30 } }
    const firstSpaceId = Object.keys(g.spaces)[0]
    g.spaces[firstSpaceId].containedNodeIds = [existingNodeId]

    const result = placeDoor(g, { x: 50, y: 50 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // The existing node should be reused as anchor
    expect(result.value.anchorNodeIds).toContain(existingNodeId)
  })

  it('returns error when position is not on any wall', () => {
    const g = makeTwoAdjacentSpaces()
    // Middle of space A — not on any wall
    const result = placeDoor(g, { x: 25, y: 50 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/wall/)
  })

  it('does not mutate the original graph', () => {
    const g = makeTwoAdjacentSpaces()
    const snapshot = JSON.stringify(g)
    placeDoor(g, { x: 50, y: 50 })
    expect(JSON.stringify(g)).toBe(snapshot)
  })

  it('updates containedNodeIds on both spaces', () => {
    const g = makeTwoAdjacentSpaces()
    const result = placeDoor(g, { x: 50, y: 50 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { graph, anchorNodeIds } = result.value
    const spaces = Object.values(graph.spaces)
    const allContained = spaces.flatMap(s => s.containedNodeIds ?? [])
    expect(allContained).toContain(anchorNodeIds[0])
    expect(allContained).toContain(anchorNodeIds[1])
  })
})

// ── removeDoor ────────────────────────────────────────────────────────────────

describe('removeDoor', () => {
  it('removes the auto-generated edge when door is removed', () => {
    const g = makeTwoAdjacentSpaces()
    const placed = placeDoor(g, { x: 50, y: 50 })
    expect(placed.ok).toBe(true)
    if (!placed.ok) return

    const { graph: g2, edgeId } = placed.value
    const removed = removeDoor(g2, edgeId)
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.value.edges[edgeId]).toBeUndefined()
  })

  it('returns error when edge does not exist', () => {
    const g = createEmptyCampusGraph()
    const result = removeDoor(g, createEdgeId())
    expect(result.ok).toBe(false)
  })
})
