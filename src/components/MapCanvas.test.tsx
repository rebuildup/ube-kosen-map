import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapCanvas } from './MapCanvas'
import { MapProvider } from '../context/MapContext'
import type { Node, Edge } from '../types'

describe('MapCanvas', () => {
  const nodes: Node[] = [
    { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, name: 'Room A', tags: [], data: {} },
    { id: 'n2', type: 'room', position: { x: 100, y: 0 }, floor: 1, name: 'Room B', tags: [], data: {} },
  ]
  const edges: Edge[] = [
    { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  ]

  it('should render SVG container', () => {
    render(
      <MapProvider initialState={{ nodes: new Map(), edges: new Map() }}>
        <MapCanvas width={800} height={600} />
      </MapProvider>
    )

    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.getAttribute('width')).toBe('800')
    expect(svg?.getAttribute('height')).toBe('600')
  })

  it('should render nodes for active floor', () => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const edgeMap = new Map(edges.map(e => [e.id, e]))

    render(
      <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, activeFloor: 1 }}>
        <MapCanvas width={800} height={600} />
      </MapProvider>
    )

    const rects = document.querySelectorAll('rect')
    expect(rects.length).toBe(2)
  })

  it('should not render nodes on different floor', () => {
    const floor2Nodes = nodes.map(n => ({ ...n, floor: 2 }))
    const nodeMap = new Map(floor2Nodes.map(n => [n.id, n]))
    const edgeMap = new Map(edges.map(e => [e.id, e]))

    render(
      <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, activeFloor: 1 }}>
        <MapCanvas width={800} height={600} />
      </MapProvider>
    )

    const rects = document.querySelectorAll('rect')
    expect(rects.length).toBe(0)
  })
})
