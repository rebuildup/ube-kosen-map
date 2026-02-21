import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RoutePanel } from './RoutePanel'
import { MapProvider } from '../context/MapContext'
import type { Node, Edge, Route } from '../types'

const testNodes: Node[] = [
  { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, name: 'Start', tags: [], data: {} },
  { id: 'n2', type: 'corridor', position: { x: 50, y: 0 }, floor: 1, name: 'Hallway', tags: [], data: {} },
  { id: 'n3', type: 'room', position: { x: 100, y: 0 }, floor: 1, name: 'Destination', tags: [], data: {} },
]

const testEdges: Edge[] = [
  { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 50, constraints: {}, tags: [], data: {} },
  { id: 'e2', from: 'n2', to: 'n3', bidirectional: true, distance: 50, constraints: {}, tags: [], data: {} },
]

const testRoute: Route = {
  nodeIds: ['n1', 'n2', 'n3'],
  edges: ['e1', 'e2'],
  distance: 100,
}

describe('RoutePanel', () => {
  it('should not render when no destination', () => {
    render(
      <MapProvider>
        <RoutePanel />
      </MapProvider>
    )

    expect(screen.queryByTestId('route-panel')).not.toBeInTheDocument()
  })

  it('should render when destination is set', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, destination: 'n3' }}>
        <RoutePanel />
      </MapProvider>
    )

    expect(screen.getByTestId('route-panel')).toBeInTheDocument()
    expect(screen.getByText('Route to: Destination')).toBeInTheDocument()
  })

  it('should show route summary when route exists', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    const edgeMap = new Map(testEdges.map(e => [e.id, e]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, destination: 'n3', route: testRoute }}>
        <RoutePanel />
      </MapProvider>
    )

    expect(screen.getByTestId('route-summary')).toBeInTheDocument()
    expect(screen.getByText(/100m/)).toBeInTheDocument()
  })

  it('should show turn-by-turn instructions', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    const edgeMap = new Map(testEdges.map(e => [e.id, e]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, destination: 'n3', route: testRoute }}>
        <RoutePanel />
      </MapProvider>
    )

    expect(screen.getByTestId('route-instructions')).toBeInTheDocument()
    expect(screen.getByTestId('route-step-1')).toBeInTheDocument()
    expect(screen.getByTestId('route-step-2')).toBeInTheDocument()
  })

  it('should clear route when clear button clicked', () => {
    const onClear = vi.fn()
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, destination: 'n3', route: testRoute }}>
        <RoutePanel onClear={onClear} />
      </MapProvider>
    )

    fireEvent.click(screen.getByTestId('route-clear'))
    expect(onClear).toHaveBeenCalled()
  })

  it('should show no path message when route is null', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, destination: 'n3', route: null }}>
        <RoutePanel />
      </MapProvider>
    )

    expect(screen.getByTestId('route-no-path')).toBeInTheDocument()
  })
})
