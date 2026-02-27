import { describe, it, expect } from 'vitest'
import {
  createNodeId, createEdgeId, createSpaceId,
  createEmptyCampusGraph,
} from '../schema'
import type { GraphNode, GraphEdge, Space } from '../schema'
import {
  addNode, addEdge, updateNode, updateEdge,
  deleteNode, deleteEdge, addSpace,
} from './manager'
import { validate } from './validate'
import { saveCampusGraph, loadCampusGraph } from './persistence'

// ── addNode ───────────────────────────────────────────────────────────────────

describe('addNode', () => {
  it('adds a node and returns ok', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    const result = addNode(g, { id })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.nodes[id]).toBeDefined()
  })

  it('runs autocomplete (fills type, position)', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    const result = addNode(g, { id })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nodes[id]!.type).toBe('other')
      expect(result.value.nodes[id]!.position).toEqual({ x: 0, y: 0 })
    }
  })

  it('does not mutate the original graph', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    addNode(g, { id })
    expect(g.nodes[id]).toBeUndefined()
  })

  it('returns error when node ID already exists', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    const r1 = addNode(g, { id })
    expect(r1.ok).toBe(true)
    const r2 = addNode(r1.ok ? r1.value : g, { id })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.message).toMatch(/already exists/)
  })
})

// ── addEdge ───────────────────────────────────────────────────────────────────

describe('addEdge', () => {
  it('adds an edge between two existing nodes', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: n1 })
    const g2 = addNode(g1.ok ? g1.value : g, { id: n2 })
    const result = addEdge(g2.ok ? g2.value : g, { id: eid, sourceNodeId: n1, targetNodeId: n2 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.edges[eid]).toBeDefined()
  })

  it('returns error when sourceNodeId does not exist (EI-1)', () => {
    const g = createEmptyCampusGraph()
    const fakeNode = createNodeId()
    const n2 = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: n2 })
    const result = addEdge(g1.ok ? g1.value : g, {
      id: eid, sourceNodeId: fakeNode, targetNodeId: n2,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/EI-1/)
  })

  it('returns error for self-loop (EI-2)', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: nid })
    const result = addEdge(g1.ok ? g1.value : g, {
      id: eid, sourceNodeId: nid, targetNodeId: nid,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/EI-2/)
  })

  it('computes distance via autocomplete', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: n1, position: { x: 0, y: 0 } })
    const g2 = addNode(g1.ok ? g1.value : g, { id: n2, position: { x: 3, y: 4 } })
    const result = addEdge(g2.ok ? g2.value : g, {
      id: eid, sourceNodeId: n1, targetNodeId: n2,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.edges[eid]!.distance).toBeCloseTo(5.0)
  })
})

// ── updateNode ────────────────────────────────────────────────────────────────

describe('updateNode', () => {
  it('applies patch to existing node', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    const g1 = addNode(g, { id })
    const result = updateNode(g1.ok ? g1.value : g, id, { label: 'Room 101' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.nodes[id]!.label).toBe('Room 101')
  })

  it('returns error when node does not exist', () => {
    const g = createEmptyCampusGraph()
    const result = updateNode(g, createNodeId(), { label: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/not found/)
  })

  it('does not mutate original graph', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    const g1 = addNode(g, { id })
    if (g1.ok) {
      const snapshot = JSON.stringify(g1.value)
      updateNode(g1.value, id, { label: 'mutated' })
      expect(JSON.stringify(g1.value)).toBe(snapshot)
    }
  })
})

// ── updateEdge ────────────────────────────────────────────────────────────────

describe('updateEdge', () => {
  it('applies patch to existing edge', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: n1 })
    const g2 = addNode(g1.ok ? g1.value : g, { id: n2 })
    const g3 = addEdge(g2.ok ? g2.value : g, { id: eid, sourceNodeId: n1, targetNodeId: n2 })
    const result = updateEdge(g3.ok ? g3.value : g, eid, { hasSteps: true })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.edges[eid]!.hasSteps).toBe(true)
  })

  it('returns error when edge does not exist', () => {
    const g = createEmptyCampusGraph()
    const result = updateEdge(g, createEdgeId(), { hasSteps: true })
    expect(result.ok).toBe(false)
  })
})

// ── deleteNode ────────────────────────────────────────────────────────────────

describe('deleteNode', () => {
  it('removes the node and connected edges', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: n1 })
    const g2 = addNode(g1.ok ? g1.value : g, { id: n2 })
    const g3 = addEdge(g2.ok ? g2.value : g, { id: eid, sourceNodeId: n1, targetNodeId: n2 })
    const result = deleteNode(g3.ok ? g3.value : g, n1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nodes[n1]).toBeUndefined()
      expect(result.value.edges[eid]).toBeUndefined()
    }
  })

  it('returns error when node does not exist', () => {
    const g = createEmptyCampusGraph()
    const result = deleteNode(g, createNodeId())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/not found/)
  })
})

// ── deleteEdge ────────────────────────────────────────────────────────────────

describe('deleteEdge', () => {
  it('removes the edge', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    const eid = createEdgeId()
    const g1 = addNode(g, { id: n1 })
    const g2 = addNode(g1.ok ? g1.value : g, { id: n2 })
    const g3 = addEdge(g2.ok ? g2.value : g, { id: eid, sourceNodeId: n1, targetNodeId: n2 })
    const result = deleteEdge(g3.ok ? g3.value : g, eid)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.edges[eid]).toBeUndefined()
  })

  it('returns error when edge does not exist', () => {
    const result = deleteEdge(createEmptyCampusGraph(), createEdgeId())
    expect(result.ok).toBe(false)
  })
})

// ── addSpace ──────────────────────────────────────────────────────────────────

describe('addSpace', () => {
  it('adds a space with autocomplete', () => {
    const g = createEmptyCampusGraph()
    const sid = createSpaceId()
    const result = addSpace(g, { id: sid })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spaces[sid]!.type).toBe('other')
    }
  })

  it('returns error when space polygon is self-intersecting (SI-3)', () => {
    const g = createEmptyCampusGraph()
    const sid = createSpaceId()
    // Butterfly/bowtie polygon — self-intersecting
    const result = addSpace(g, {
      id: sid,
      polygon: {
        vertices: [
          { x: 0, y: 0 }, { x: 2, y: 2 },
          { x: 2, y: 0 }, { x: 0, y: 2 },
        ],
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/SI-3/)
  })
})

// ── validate ──────────────────────────────────────────────────────────────────

describe('validate', () => {
  it('returns isValid:true for empty graph', () => {
    const result = validate(createEmptyCampusGraph())
    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('NI-1: detects isolated node (Error)', () => {
    const g = createEmptyCampusGraph()
    const id = createNodeId()
    g.nodes[id] = { id }
    const result = validate(g)
    const issue = result.issues.find(i => i.ruleId === 'NI-1')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
    expect(issue?.targetIds).toContain(id)
  })

  it('EI-1: detects broken edge reference (Error)', () => {
    const g = createEmptyCampusGraph()
    const fakeNode = createNodeId()
    const eid = createEdgeId()
    g.edges[eid] = { id: eid, sourceNodeId: fakeNode, targetNodeId: fakeNode }
    const result = validate(g)
    const issue = result.issues.find(i => i.ruleId === 'EI-1')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
  })

  it('EI-2: detects self-loop (Error)', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    const eid = createEdgeId()
    g.nodes[nid] = { id: nid }
    g.edges[eid] = { id: eid, sourceNodeId: nid, targetNodeId: nid }
    const result = validate(g)
    const issue = result.issues.find(i => i.ruleId === 'EI-2')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
  })

  it('EI-3: detects duplicate edges (Warning)', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    g.nodes[n1] = { id: n1 }
    g.nodes[n2] = { id: n2 }
    // Add two edges between the same nodes
    const eid1 = createEdgeId()
    const eid2 = createEdgeId()
    g.edges[eid1] = { id: eid1, sourceNodeId: n1, targetNodeId: n2 }
    g.edges[eid2] = { id: eid2, sourceNodeId: n1, targetNodeId: n2 }
    const result = validate(g)
    const issue = result.issues.find(i => i.ruleId === 'EI-3')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('warning')
  })

  it('NI-2: warns about staircase without verticalLinks', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    const nid2 = createNodeId()
    const eid = createEdgeId()
    g.nodes[nid] = { id: nid, type: 'staircase' }
    g.nodes[nid2] = { id: nid2 }
    g.edges[eid] = { id: eid, sourceNodeId: nid, targetNodeId: nid2 }
    const result = validate(g)
    const issue = result.issues.find(i => i.ruleId === 'NI-2')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('warning')
  })

  it('SI-3: detects self-intersecting polygon (Error)', () => {
    const g = createEmptyCampusGraph()
    const sid = createSpaceId()
    g.spaces[sid] = {
      id: sid,
      polygon: {
        vertices: [
          { x: 0, y: 0 }, { x: 2, y: 2 },
          { x: 2, y: 0 }, { x: 0, y: 2 },
        ],
      },
    }
    const result = validate(g)
    const issue = result.issues.find(i => i.ruleId === 'SI-3')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
  })

  it('summary counts match issues', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    g.nodes[nid] = { id: nid } // isolated node (NI-1 error)
    const result = validate(g)
    expect(result.summary.errors).toBeGreaterThan(0)
    expect(result.isValid).toBe(false)
  })
})

// ── JSON persistence ──────────────────────────────────────────────────────────

describe('saveCampusGraph / loadCampusGraph', () => {
  it('round-trips a graph through JSON without data loss', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    const nid2 = createNodeId()
    const eid = createEdgeId()
    g.nodes[nid] = { id: nid, position: { x: 1, y: 2 }, type: 'room' }
    g.nodes[nid2] = { id: nid2, position: { x: 5, y: 6 } }
    g.edges[eid] = { id: eid, sourceNodeId: nid, targetNodeId: nid2 }

    const json = saveCampusGraph(g)
    const loaded = loadCampusGraph(json)

    expect(loaded.nodes[nid]!.type).toBe('room')
    expect(loaded.nodes[nid]!.position).toEqual({ x: 1, y: 2 })
    expect(loaded.edges[eid]).toBeDefined()
  })

  it('loadCampusGraph applies autocomplete pipeline', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    g.nodes[nid] = { id: nid } // no type
    const json = saveCampusGraph(g)
    const loaded = loadCampusGraph(json)
    expect(loaded.nodes[nid]!.type).toBe('other')
  })

  it('saveCampusGraph produces valid JSON', () => {
    const json = saveCampusGraph(createEmptyCampusGraph())
    expect(() => JSON.parse(json)).not.toThrow()
  })
})
