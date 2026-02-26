import { describe, it, expect } from 'vitest'
import {
  createEmptyCampusGraph,
  createNodeId, createEdgeId, createFloorId,
} from '../schema'
import type { CampusGraph } from '../schema'
import { findRoute } from './astar'
import { PROFILE_DEFAULT, PROFILE_CART, DEFAULT_CONTEXT } from './cost'

// ── Graph builders ────────────────────────────────────────────────────────────

/** Linear graph: A → B → C */
const makeLinear = (): { graph: CampusGraph; ids: string[] } => {
  const g = createEmptyCampusGraph()
  const [a, b, c] = [createNodeId(), createNodeId(), createNodeId()]
  g.nodes[a] = { id: a, position: { x: 0,  y: 0 } }
  g.nodes[b] = { id: b, position: { x: 10, y: 0 } }
  g.nodes[c] = { id: c, position: { x: 20, y: 0 } }
  const ab = createEdgeId()
  const bc = createEdgeId()
  g.edges[ab] = { id: ab, sourceNodeId: a, targetNodeId: b, distance: 10 }
  g.edges[bc] = { id: bc, sourceNodeId: b, targetNodeId: c, distance: 10 }
  return { graph: g, ids: [a, b, c] }
}

/** Diamond graph: A → B → D and A → C → D (B is longer) */
const makeDiamond = (): { graph: CampusGraph; a: string; d: string } => {
  const g = createEmptyCampusGraph()
  const [a, b, c, d] = [createNodeId(), createNodeId(), createNodeId(), createNodeId()]
  g.nodes[a] = { id: a, position: { x: 0, y: 0 } }
  g.nodes[b] = { id: b, position: { x: 5, y: 5 } }
  g.nodes[c] = { id: c, position: { x: 5, y: 0 } }
  g.nodes[d] = { id: d, position: { x: 10, y: 0 } }
  const ab = createEdgeId()
  const bd = createEdgeId()
  const ac = createEdgeId()
  const cd = createEdgeId()
  g.edges[ab] = { id: ab, sourceNodeId: a, targetNodeId: b, distance: 15 } // long
  g.edges[bd] = { id: bd, sourceNodeId: b, targetNodeId: d, distance: 15 } // long
  g.edges[ac] = { id: ac, sourceNodeId: a, targetNodeId: c, distance: 5 }  // short
  g.edges[cd] = { id: cd, sourceNodeId: c, targetNodeId: d, distance: 5 }  // short
  return { graph: g, a, d }
}

// ── Basic A* ──────────────────────────────────────────────────────────────────

describe('findRoute (A*)', () => {
  it('finds a direct path in a linear graph', () => {
    const { graph, ids: [a, , c] } = makeLinear()
    const result = findRoute(graph, a as never, c as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.route.nodeIds[0]).toBe(a)
    expect(result.route.nodeIds[result.route.nodeIds.length - 1]).toBe(c)
    expect(result.route.totalCost).toBeCloseTo(20)
  })

  it('includes intermediate nodes', () => {
    const { graph, ids: [a, b, c] } = makeLinear()
    const result = findRoute(graph, a as never, c as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.route.nodeIds).toContain(b)
  })

  it('returns ok:false when no path exists (disconnected)', () => {
    const g = createEmptyCampusGraph()
    const n1 = createNodeId()
    const n2 = createNodeId()
    g.nodes[n1] = { id: n1, position: { x: 0, y: 0 } }
    g.nodes[n2] = { id: n2, position: { x: 10, y: 0 } }
    const result = findRoute(g, n1 as never, n2 as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBeDefined()
  })

  it('returns the shorter path in a diamond graph', () => {
    const { graph, a, d } = makeDiamond()
    const result = findRoute(graph, a as never, d as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.route.totalCost).toBeCloseTo(10) // short path: 5+5
  })

  it('start === goal returns a trivial route with cost 0', () => {
    const { graph, ids: [a] } = makeLinear()
    const result = findRoute(graph, a as never, a as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.route.totalCost).toBe(0)
    expect(result.route.nodeIds).toEqual([a])
  })
})

// ── Profile integration ───────────────────────────────────────────────────────

describe('profile integration', () => {
  it('avoids edges with steps in PROFILE_CART', () => {
    const g = createEmptyCampusGraph()
    const [a, b, c] = [createNodeId(), createNodeId(), createNodeId()]
    g.nodes[a] = { id: a, position: { x: 0, y: 0 } }
    g.nodes[b] = { id: b, position: { x: 5, y: 0 } }  // intermediate with steps
    g.nodes[c] = { id: c, position: { x: 10, y: 0 } }

    const ab = createEdgeId()
    const bc = createEdgeId()
    const ac = createEdgeId()
    g.edges[ab] = { id: ab, sourceNodeId: a, targetNodeId: b, distance: 5, hasSteps: true }
    g.edges[bc] = { id: bc, sourceNodeId: b, targetNodeId: c, distance: 5, hasSteps: true }
    g.edges[ac] = { id: ac, sourceNodeId: a, targetNodeId: c, distance: 20 } // long but no steps

    const result = findRoute(g, a as never, c as never, PROFILE_CART, DEFAULT_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Should take the long route ac (no steps)
    expect(result.route.nodeIds).not.toContain(b)
    expect(result.route.totalCost).toBeCloseTo(20)
  })

  it('returns not reachable when all paths have Infinity cost', () => {
    const g = createEmptyCampusGraph()
    const [a, b] = [createNodeId(), createNodeId()]
    g.nodes[a] = { id: a, position: { x: 0, y: 0 } }
    g.nodes[b] = { id: b, position: { x: 10, y: 0 } }
    const eid = createEdgeId()
    g.edges[eid] = { id: eid, sourceNodeId: a, targetNodeId: b, distance: 10, hasSteps: true }

    const result = findRoute(g, a as never, b as never, PROFILE_CART, DEFAULT_CONTEXT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/reachable|impassable|Infinity/i)
  })
})

// ── Multi-floor ───────────────────────────────────────────────────────────────

describe('multi-floor routing', () => {
  it('routes through vertical edges across floors', () => {
    const g = createEmptyCampusGraph()
    const f1 = createFloorId()
    const f2 = createFloorId()
    const [n1, stairs, n2] = [createNodeId(), createNodeId(), createNodeId()]
    const stairsUp = createNodeId()

    g.floors[f1] = { id: f1, level: 1 }
    g.floors[f2] = { id: f2, level: 2 }
    g.nodes[n1]      = { id: n1,      floorId: f1, position: { x: 0, y: 0 } }
    g.nodes[stairs]  = { id: stairs,  floorId: f1, type: 'staircase', position: { x: 10, y: 0 } }
    g.nodes[stairsUp]= { id: stairsUp,floorId: f2, type: 'staircase', position: { x: 10, y: 0 } }
    g.nodes[n2]      = { id: n2,      floorId: f2, position: { x: 20, y: 0 } }

    const e1 = createEdgeId()
    const ev = createEdgeId()
    const e2 = createEdgeId()
    g.edges[e1] = { id: e1, sourceNodeId: n1,     targetNodeId: stairs,   distance: 10 }
    g.edges[ev] = { id: ev, sourceNodeId: stairs,  targetNodeId: stairsUp, distance: 5, isVertical: true }
    g.edges[e2] = { id: e2, sourceNodeId: stairsUp,targetNodeId: n2,       distance: 10 }

    const result = findRoute(g, n1 as never, n2 as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.route.nodeIds).toContain(stairs)
    expect(result.route.nodeIds).toContain(stairsUp)
    expect(result.route.floorTransitions.length).toBeGreaterThan(0)
  })
})

// ── Alternative routes ────────────────────────────────────────────────────────

describe('alternative routes', () => {
  it('returns up to K alternative routes in a diamond graph', () => {
    const { graph, a, d } = makeDiamond()
    const result = findRoute(
      graph, a as never, d as never, PROFILE_DEFAULT, DEFAULT_CONTEXT,
      { maxAlternatives: 2 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.alternatives).toBeDefined()
    expect(result.alternatives!.length).toBeGreaterThan(0)
  })

  it('alternative routes have different node sequences', () => {
    const { graph, a, d } = makeDiamond()
    const result = findRoute(
      graph, a as never, d as never, PROFILE_DEFAULT, DEFAULT_CONTEXT,
      { maxAlternatives: 2 },
    )
    if (!result.ok || !result.alternatives?.length) return
    const mainPath = JSON.stringify(result.route.nodeIds)
    const altPath  = JSON.stringify(result.alternatives[0].nodeIds)
    expect(mainPath).not.toBe(altPath)
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe('error handling', () => {
  it('returns error when start node does not exist', () => {
    const g = createEmptyCampusGraph()
    const result = findRoute(g, createNodeId() as never, createNodeId() as never, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not found/)
  })
})
