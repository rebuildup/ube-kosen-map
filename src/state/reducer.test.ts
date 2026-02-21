import { describe, it, expect } from 'vitest'
import { mapReducer, createInitialState } from './reducer'
import type { Node, Edge } from '../types'

describe('mapReducer', () => {
  it('should create initial state', () => {
    const state = createInitialState()
    expect(state.nodes.size).toBe(0)
    expect(state.edges.size).toBe(0)
    expect(state.zoom).toBe(1)
    expect(state.activeFloor).toBe(1)
  })

  it('should set nodes', () => {
    const state = createInitialState()
    const nodes: Node[] = [
      { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    ]
    const newState = mapReducer(state, { type: 'SET_NODES', payload: nodes })
    expect(newState.nodes.size).toBe(1)
    expect(newState.nodes.get('n1')?.type).toBe('room')
  })

  it('should set edges', () => {
    const state = createInitialState()
    const edges: Edge[] = [
      { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    ]
    const newState = mapReducer(state, { type: 'SET_EDGES', payload: edges })
    expect(newState.edges.size).toBe(1)
  })

  it('should set active floor', () => {
    const state = createInitialState()
    const newState = mapReducer(state, { type: 'SET_ACTIVE_FLOOR', payload: 2 })
    expect(newState.activeFloor).toBe(2)
  })

  it('should set destination', () => {
    const state = createInitialState()
    const newState = mapReducer(state, { type: 'SET_DESTINATION', payload: 'room-101' })
    expect(newState.destination).toBe('room-101')
  })

  it('should set route', () => {
    const state = createInitialState()
    const route = { nodeIds: ['n1', 'n2'], edges: ['e1'], distance: 10 }
    const newState = mapReducer(state, { type: 'SET_ROUTE', payload: route })
    expect(newState.route?.nodeIds).toEqual(['n1', 'n2'])
  })

  it('should set user constraints', () => {
    const state = createInitialState()
    const constraints = { max: { width: 1.0 } }
    const newState = mapReducer(state, { type: 'SET_USER_CONSTRAINTS', payload: constraints })
    expect(newState.userConstraints.max?.width).toBe(1.0)
  })
})
