import { describe, it, expectTypeOf } from 'vitest'
import type { Node, Edge, Building, Point, MapState } from './index'

describe('Types', () => {
  it('Node should accept minimal fields', () => {
    const node: Node = {
      id: 'n1',
      type: 'room',
      position: { x: 0, y: 0 },
      floor: 1,
      tags: [],
      data: {},
    }
    expectTypeOf(node).toMatchTypeOf<Node>()
  })

  it('Node should accept optional fields', () => {
    const node: Node = {
      id: 'n2',
      type: 'corridor',
      position: { x: 100, y: 200, z: 0 },
      floor: 2,
      name: 'Main Hallway',
      tags: ['covered'],
      data: { width: 3.5 },
    }
    expectTypeOf(node).toMatchTypeOf<Node>()
  })

  it('Edge should have constraints', () => {
    const edge: Edge = {
      id: 'e1',
      from: 'n1',
      to: 'n2',
      bidirectional: true,
      distance: 10,
      constraints: {
        max: { width: 1.5, height: 2.2, weight: 100 },
        requires: ['keycard'],
      },
      tags: [],
      data: {},
    }
    expectTypeOf(edge).toMatchTypeOf<Edge>()
  })

  it('MapState should have all required fields', () => {
    const state: MapState = {
      nodes: new Map(),
      edges: new Map(),
      buildings: new Map(),
      center: { x: 0, y: 0 },
      zoom: 1,
      activeFloor: 1,
      viewMode: 'top_down',
      userLocation: null,
      destination: null,
      route: null,
      searchQuery: null,
      searchResults: [],
      userConstraints: {},
    }
    expectTypeOf(state).toMatchTypeOf<MapState>()
  })
})
