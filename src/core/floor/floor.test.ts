import { describe, it, expect } from 'vitest'
import {
  createEmptyCampusGraph,
  createNodeId, createFloorId, createEdgeId,
} from '../schema'
import type { CampusGraph } from '../schema'
import {
  addVerticalLink,
  getFloorsForBuilding,
  getFloorByLevel,
  validateStaircaseIntegrity,
} from './index'

// ── Test helpers ──────────────────────────────────────────────────────────────

const makeTwoFloorGraph = (): {
  graph: CampusGraph
  floor1Id: string
  floor2Id: string
  node1Id: string
  node2Id: string
} => {
  const g = createEmptyCampusGraph()
  const floor1Id = createFloorId()
  const floor2Id = createFloorId()
  const node1Id = createNodeId()
  const node2Id = createNodeId()

  g.floors[floor1Id] = { id: floor1Id, level: 1, name: '1F' }
  g.floors[floor2Id] = { id: floor2Id, level: 2, name: '2F' }
  g.nodes[node1Id] = { id: node1Id, floorId: floor1Id, type: 'staircase', position: { x: 10, y: 10 } }
  g.nodes[node2Id] = { id: node2Id, floorId: floor2Id, type: 'staircase', position: { x: 10, y: 10 } }

  return { graph: g, floor1Id, floor2Id, node1Id, node2Id }
}

// ── addVerticalLink ───────────────────────────────────────────────────────────

describe('addVerticalLink', () => {
  it('creates a vertical edge between nodes on different floors', () => {
    const { graph, node1Id, node2Id } = makeTwoFloorGraph()
    const result = addVerticalLink(graph, node1Id as Parameters<typeof addVerticalLink>[1], node2Id as Parameters<typeof addVerticalLink>[2])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const edges = Object.values(result.value.edges)
    const vertEdge = edges.find(e =>
      (e.sourceNodeId === node1Id && e.targetNodeId === node2Id) ||
      (e.sourceNodeId === node2Id && e.targetNodeId === node1Id)
    )
    expect(vertEdge).toBeDefined()
    expect(vertEdge?.isVertical).toBe(true)
  })

  it('updates verticalLinks on both nodes', () => {
    const { graph, node1Id, node2Id, floor1Id, floor2Id } = makeTwoFloorGraph()
    const result = addVerticalLink(graph, node1Id as Parameters<typeof addVerticalLink>[1], node2Id as Parameters<typeof addVerticalLink>[2])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // floor2 is "above" floor1
    const n1 = result.value.nodes[node1Id]
    const n2 = result.value.nodes[node2Id]
    expect(n1.verticalLinks?.above ?? n1.verticalLinks?.below).toBeDefined()
    expect(n2.verticalLinks?.above ?? n2.verticalLinks?.below).toBeDefined()
    void floor1Id; void floor2Id
  })

  it('returns error when nodes are on the same floor', () => {
    const g = createEmptyCampusGraph()
    const fid = createFloorId()
    const n1 = createNodeId()
    const n2 = createNodeId()
    g.floors[fid] = { id: fid, level: 1 }
    g.nodes[n1] = { id: n1, floorId: fid, type: 'staircase' }
    g.nodes[n2] = { id: n2, floorId: fid, type: 'staircase' }

    const result = addVerticalLink(g, n1 as Parameters<typeof addVerticalLink>[1], n2 as Parameters<typeof addVerticalLink>[2])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/same floor/)
  })

  it('returns error when a node does not exist', () => {
    const g = createEmptyCampusGraph()
    const fakeId = createNodeId()
    const result = addVerticalLink(g, fakeId as Parameters<typeof addVerticalLink>[1], createNodeId() as Parameters<typeof addVerticalLink>[2])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/not found/)
  })

  it('does not mutate the original graph', () => {
    const { graph, node1Id, node2Id } = makeTwoFloorGraph()
    const snapshot = JSON.stringify(graph)
    addVerticalLink(graph, node1Id as Parameters<typeof addVerticalLink>[1], node2Id as Parameters<typeof addVerticalLink>[2])
    expect(JSON.stringify(graph)).toBe(snapshot)
  })
})

// ── getFloorsForBuilding ──────────────────────────────────────────────────────

describe('getFloorsForBuilding', () => {
  it('returns floors sorted by level', () => {
    const g = createEmptyCampusGraph()
    const bid = 'bldg1'
    const f1 = createFloorId()
    const f2 = createFloorId()
    const f3 = createFloorId()
    g.floors[f1] = { id: f1, level: 3, name: '3F' }
    g.floors[f2] = { id: f2, level: 1, name: '1F' }
    g.floors[f3] = { id: f3, level: 2, name: '2F' }
    g.buildings[bid] = { id: bid as never, name: 'Main', floorIds: [f1, f2, f3] }

    const floors = getFloorsForBuilding(g, bid as never)
    expect(floors.map(f => f.level)).toEqual([1, 2, 3])
  })

  it('returns empty array for unknown building', () => {
    const g = createEmptyCampusGraph()
    const result = getFloorsForBuilding(g, 'nonexistent' as never)
    expect(result).toEqual([])
  })
})

// ── getFloorByLevel ───────────────────────────────────────────────────────────

describe('getFloorByLevel', () => {
  it('returns the floor at the given level', () => {
    const g = createEmptyCampusGraph()
    const bid = 'bldg1'
    const fid = createFloorId()
    g.floors[fid] = { id: fid, level: 2, name: '2F' }
    g.buildings[bid] = { id: bid as never, name: 'Main', floorIds: [fid] }

    const floor = getFloorByLevel(g, bid as never, 2)
    expect(floor?.level).toBe(2)
  })

  it('returns undefined if level does not exist', () => {
    const g = createEmptyCampusGraph()
    const bid = 'bldg1'
    g.buildings[bid] = { id: bid as never, floorIds: [] }
    expect(getFloorByLevel(g, bid as never, 99)).toBeUndefined()
  })
})

// ── validateStaircaseIntegrity ────────────────────────────────────────────────

describe('validateStaircaseIntegrity', () => {
  it('returns no issues when all staircase nodes have verticalLinks', () => {
    const { graph, node1Id, node2Id } = makeTwoFloorGraph()
    const linked = addVerticalLink(
      graph,
      node1Id as Parameters<typeof addVerticalLink>[1],
      node2Id as Parameters<typeof addVerticalLink>[2],
    )
    expect(linked.ok).toBe(true)
    if (!linked.ok) return
    const issues = validateStaircaseIntegrity(linked.value)
    expect(issues).toHaveLength(0)
  })

  it('returns NI-2 warning for staircase without verticalLinks', () => {
    const { graph, node1Id } = makeTwoFloorGraph()
    // node1 has type staircase but no verticalLinks
    const issues = validateStaircaseIntegrity(graph)
    const nodeIssues = issues.filter(i => i.targetIds.includes(node1Id))
    expect(nodeIssues.length).toBeGreaterThan(0)
    expect(nodeIssues[0].ruleId).toBe('NI-2')
    expect(nodeIssues[0].severity).toBe('warning')
  })
})
