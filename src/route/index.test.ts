import { describe, it, expect } from 'vitest'
import { findRoute, filterEdgesByConstraints } from './index'
import type { Node, Edge } from '../types'

describe('filterEdgesByConstraints', () => {
  const edges: Edge[] = [
    { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    { id: 'e2', from: 'n2', to: 'n3', bidirectional: true, distance: 10, constraints: { max: { width: 1.0 } }, tags: [], data: {} },
    { id: 'e3', from: 'n3', to: 'n4', bidirectional: true, distance: 10, constraints: { requires: ['keycard'] }, tags: [], data: {} },
  ]
  const edgeMap = new Map(edges.map(e => [e.id, e]))

  it('should return all edges when no constraints (edges without requirements pass)', () => {
    // Edge e3 requires keycard, but user has no constraints - e3 should be filtered out
    const filtered = filterEdgesByConstraints(edgeMap, {})
    expect(filtered.length).toBe(2) // e1 and e2 only (e3 requires keycard)
  })

  it('should filter by max width (user wider than edge)', () => {
    // User width 1.2 > edge e2 max width 1.0, so e2 is excluded
    const filtered = filterEdgesByConstraints(edgeMap, { max: { width: 1.2 } })
    expect(filtered.length).toBe(1) // only e1 (e2 excluded by width, e3 excluded by requires)
    expect(filtered.find(e => e.id === 'e2')).toBeUndefined()
  })

  it('should pass all accessible edges when user fits', () => {
    // User width 0.8 < all edge constraints, so width check passes
    const filtered = filterEdgesByConstraints(edgeMap, { max: { width: 0.8 } })
    expect(filtered.length).toBe(2) // e1 and e2 (e3 still requires keycard)
  })

  it('should allow edge when user has required permission', () => {
    // User has keycard, can pass e3
    const filtered = filterEdgesByConstraints(edgeMap, { requires: ['keycard'] })
    expect(filtered.length).toBe(3) // all pass since user has keycard
    expect(filtered.find(e => e.id === 'e3')).toBeDefined()
  })

  it('should filter out edge when user lacks required permission', () => {
    // User has no keycard, cannot pass e3
    const filtered = filterEdgesByConstraints(edgeMap, { requires: [] })
    expect(filtered.length).toBe(2) // e1 and e2 only
    expect(filtered.find(e => e.id === 'e3')).toBeUndefined()
  })
})

describe('findRoute', () => {
  const nodes: Node[] = [
    { id: 'A', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'B', type: 'corridor', position: { x: 10, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'C', type: 'corridor', position: { x: 20, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'D', type: 'room', position: { x: 30, y: 0 }, floor: 1, tags: [], data: {} },
  ]
  const edges: Edge[] = [
    { id: 'AB', from: 'A', to: 'B', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    { id: 'BC', from: 'B', to: 'C', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    { id: 'CD', from: 'C', to: 'D', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
  ]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edgeMap = new Map(edges.map(e => [e.id, e]))

  it('should find direct path', () => {
    const route = findRoute(nodeMap, edgeMap, { from: 'A', to: 'D' })
    expect(route).not.toBeNull()
    expect(route?.nodeIds).toEqual(['A', 'B', 'C', 'D'])
    expect(route?.distance).toBe(30)
  })

  it('should return null for unreachable nodes', () => {
    const extraNode: Node = { id: 'X', type: 'room', position: { x: 100, y: 100 }, floor: 2, tags: [], data: {} }
    const extraNodeMap = new Map(nodeMap).set('X', extraNode)
    const route = findRoute(extraNodeMap, edgeMap, { from: 'A', to: 'X' })
    expect(route).toBeNull()
  })

  it('should return same node for same start/end', () => {
    const route = findRoute(nodeMap, edgeMap, { from: 'A', to: 'A' })
    expect(route?.nodeIds).toEqual(['A'])
    expect(route?.distance).toBe(0)
  })
})
