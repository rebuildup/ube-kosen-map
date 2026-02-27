import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { CrossSectionView } from './CrossSectionView'
import { createEmptyCampusGraph } from '../../core/schema/graph'
import { createFloorId, createBuildingId, createNodeId, createEdgeId } from '../../core/schema/ids'
import type { CampusGraph } from '../../core/schema/types'

// Build a minimal 2-floor graph with a vertical link
function makeGraph(): CampusGraph {
  const g = createEmptyCampusGraph()
  const b = createBuildingId()
  const f1 = createFloorId()
  const f2 = createFloorId()
  const n1 = createNodeId()
  const n2 = createNodeId()
  const e1 = createEdgeId()

  return {
    ...g,
    buildings: { [b]: { id: b, name: 'Main' } },
    floors: {
      [f1]: { id: f1, buildingId: b, level: 1, name: '1F' },
      [f2]: { id: f2, buildingId: b, level: 2, name: '2F' },
    },
    nodes: {
      [n1]: { id: n1, floorId: f1, position: { x: 0, y: 0 }, type: 'staircase', verticalLinks: { above: n2 } },
      [n2]: { id: n2, floorId: f2, position: { x: 0, y: 0 }, type: 'staircase', verticalLinks: { below: n1 } },
    },
    edges: {
      [e1]: { id: e1, sourceNodeId: n1, targetNodeId: n2, isVertical: true },
    },
    spaces: {},
  }
}

describe('CrossSectionView', () => {
  it('renders four direction buttons', () => {
    const { container } = render(
      <CrossSectionView graph={makeGraph()} buildingId={Object.keys(makeGraph().buildings)[0] as any} />,
    )
    const btns = container.querySelectorAll('[data-direction]')
    expect(btns.length).toBe(4)
  })

  it('marks default direction (north) as active', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <CrossSectionView graph={graph} buildingId={buildingId} />,
    )
    const active = container.querySelector('[data-direction][aria-pressed="true"]')
    expect((active as HTMLElement).dataset.direction).toBe('north')
  })

  it('renders one row per floor', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <CrossSectionView graph={graph} buildingId={buildingId} />,
    )
    const rows = container.querySelectorAll('[data-floor-level]')
    expect(rows.length).toBe(2)
  })

  it('calls onDirectionChange when a direction button is clicked', () => {
    const onChange = vi.fn()
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <CrossSectionView graph={graph} buildingId={buildingId} onDirectionChange={onChange} />,
    )
    fireEvent.click(container.querySelector('[data-direction="east"]') as HTMLElement)
    expect(onChange).toHaveBeenCalledWith('east')
  })

  it('renders vertical connection indicators for staircase nodes', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <CrossSectionView graph={graph} buildingId={buildingId} />,
    )
    const connectors = container.querySelectorAll('[data-vertical-link]')
    expect(connectors.length).toBeGreaterThan(0)
  })
})
