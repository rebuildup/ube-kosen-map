import { describe, it, expect } from 'vitest'
import {
  createNodeId,
  createEdgeId,
  createSpaceId,
  createFloorId,
  createBuildingId,
  createProfileId,
  isNodeId,
  isEdgeId,
  isSpaceId,
  isFloorId,
  isBuildingId,
  isProfileId,
  createEmptyCampusGraph,
  getNode,
  getEdge,
  getSpace,
  getFloor,
  getBuilding,
} from './index'
import type { CampusGraph, GraphNode, GraphEdge } from './index'

// ── Branded ID tests ──────────────────────────────────────────────────────────

describe('Branded ID creation', () => {
  it('createNodeId returns a NodeId with UUID format', () => {
    const id = createNodeId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('createEdgeId returns a EdgeId with UUID format', () => {
    expect(createEdgeId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('each call returns a unique ID', () => {
    const ids = Array.from({ length: 10 }, () => createNodeId())
    const unique = new Set(ids)
    expect(unique.size).toBe(10)
  })

  it('all ID creators produce distinct IDs', () => {
    const nodeId = createNodeId()
    const edgeId = createEdgeId()
    const spaceId = createSpaceId()
    const floorId = createFloorId()
    const buildingId = createBuildingId()
    const profileId = createProfileId()
    const allIds = [nodeId, edgeId, spaceId, floorId, buildingId, profileId]
    expect(new Set(allIds).size).toBe(6)
  })
})

// ── Type guard tests ──────────────────────────────────────────────────────────

describe('Type guards', () => {
  it('isNodeId returns true for NodeId', () => {
    const id = createNodeId()
    expect(isNodeId(id)).toBe(true)
  })

  it('isEdgeId returns false for NodeId', () => {
    const id = createNodeId()
    expect(isEdgeId(id as never)).toBe(false)
  })

  it('isSpaceId returns true for SpaceId', () => {
    expect(isSpaceId(createSpaceId())).toBe(true)
  })

  it('isFloorId returns true for FloorId', () => {
    expect(isFloorId(createFloorId())).toBe(true)
  })

  it('isBuildingId returns true for BuildingId', () => {
    expect(isBuildingId(createBuildingId())).toBe(true)
  })

  it('isProfileId returns true for ProfileId', () => {
    expect(isProfileId(createProfileId())).toBe(true)
  })

  it('type guard returns false for plain string', () => {
    expect(isNodeId('plain-string' as never)).toBe(false)
  })
})

// ── createEmptyCampusGraph tests ──────────────────────────────────────────────

describe('createEmptyCampusGraph', () => {
  it('returns a CampusGraph with empty stores', () => {
    const graph = createEmptyCampusGraph()
    expect(graph.nodes).toEqual({})
    expect(graph.edges).toEqual({})
    expect(graph.spaces).toEqual({})
    expect(graph.floors).toEqual({})
    expect(graph.buildings).toEqual({})
  })

  it('has a version string', () => {
    const graph = createEmptyCampusGraph()
    expect(typeof graph.version).toBe('string')
    expect(graph.version.length).toBeGreaterThan(0)
  })

  it('has a lastModified ISO 8601 string', () => {
    const graph = createEmptyCampusGraph()
    expect(() => new Date(graph.lastModified)).not.toThrow()
    expect(new Date(graph.lastModified).toISOString()).toBe(graph.lastModified)
  })

  it('is JSON-serializable', () => {
    const graph = createEmptyCampusGraph()
    const json = JSON.stringify(graph)
    const parsed: CampusGraph = JSON.parse(json)
    expect(parsed.version).toBe(graph.version)
    expect(parsed.nodes).toEqual({})
  })
})

// ── Type-safe accessor tests ──────────────────────────────────────────────────

describe('Type-safe accessors', () => {
  const buildTestGraph = (): CampusGraph => {
    const nodeId = createNodeId()
    const edgeId = createEdgeId()
    const node: GraphNode = { id: nodeId }
    const edge: GraphEdge = {
      id: edgeId,
      sourceNodeId: nodeId,
      targetNodeId: nodeId,
    }
    const graph = createEmptyCampusGraph()
    graph.nodes[nodeId] = node
    graph.edges[edgeId] = edge
    return graph
  }

  it('getNode returns the node by NodeId', () => {
    const graph = buildTestGraph()
    const nodeId = Object.keys(graph.nodes)[0] as ReturnType<typeof createNodeId>
    const node = getNode(graph, nodeId)
    expect(node).toBeDefined()
    expect(node?.id).toBe(nodeId)
  })

  it('getNode returns undefined for missing id', () => {
    const graph = createEmptyCampusGraph()
    const fakeId = createNodeId()
    expect(getNode(graph, fakeId)).toBeUndefined()
  })

  it('getEdge returns the edge by EdgeId', () => {
    const graph = buildTestGraph()
    const edgeId = Object.keys(graph.edges)[0] as ReturnType<typeof createEdgeId>
    const edge = getEdge(graph, edgeId)
    expect(edge).toBeDefined()
    expect(edge?.id).toBe(edgeId)
  })

  it('getSpace, getFloor, getBuilding return undefined on empty graph', () => {
    const graph = createEmptyCampusGraph()
    expect(getSpace(graph, createSpaceId())).toBeUndefined()
    expect(getFloor(graph, createFloorId())).toBeUndefined()
    expect(getBuilding(graph, createBuildingId())).toBeUndefined()
  })
})

// ── Structural / type tests ───────────────────────────────────────────────────

describe('GraphNode optional fields', () => {
  it('a node with only id is valid (all fields optional)', () => {
    const node: GraphNode = { id: createNodeId() }
    expect(node.type).toBeUndefined()
    expect(node.position).toBeUndefined()
    expect(node.floorId).toBeUndefined()
  })

  it('a node can have all optional fields', () => {
    const floorId = createFloorId()
    const buildingId = createBuildingId()
    const node: GraphNode = {
      id: createNodeId(),
      type: 'room',
      position: { x: 10, y: 20 },
      floorId,
      buildingId,
      label: 'Room 101',
      verticalLinks: { above: createNodeId(), below: createNodeId() },
      properties: { custom: true },
    }
    expect(node.type).toBe('room')
    expect(node.properties?.['custom']).toBe(true)
  })
})

describe('GraphEdge optional fields', () => {
  it('an edge with id + source + target is valid', () => {
    const edge: GraphEdge = {
      id: createEdgeId(),
      sourceNodeId: createNodeId(),
      targetNodeId: createNodeId(),
    }
    expect(edge.distance).toBeUndefined()
    expect(edge.hasSteps).toBeUndefined()
  })
})
