import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CampusMap } from './CampusMap'
import {
  createEmptyCampusGraph,
  createNodeId, createEdgeId, createSpaceId,
} from '../../core/schema'
import type { CampusGraph } from '../../core/schema'

const makeGraph = (): CampusGraph => {
  const g = createEmptyCampusGraph()
  const n1 = createNodeId()
  const n2 = createNodeId()
  const eid = createEdgeId()
  const sid = createSpaceId()

  g.nodes[n1] = { id: n1, position: { x: 10, y: 10 }, label: 'Node A' }
  g.nodes[n2] = { id: n2, position: { x: 100, y: 100 }, label: 'Node B' }
  g.edges[eid] = { id: eid, sourceNodeId: n1, targetNodeId: n2 }
  g.spaces[sid] = {
    id: sid,
    polygon: { vertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] },
  }

  return g
}

describe('CampusMap', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <CampusMap graph={createEmptyCampusGraph()} />,
    )
    expect(container.firstChild).toBeTruthy()
  })

  it('renders node elements for each node', () => {
    const g = makeGraph()
    render(<CampusMap graph={g} />)
    const nodeCount = Object.keys(g.nodes).length
    const nodeEls = document.querySelectorAll('[data-node-id]')
    expect(nodeEls.length).toBe(nodeCount)
  })

  it('renders an edge element for each edge', () => {
    const g = makeGraph()
    render(<CampusMap graph={g} />)
    const edgeCount = Object.keys(g.edges).length
    const edgeEls = document.querySelectorAll('[data-edge-id]')
    expect(edgeEls.length).toBe(edgeCount)
  })

  it('renders a polygon element for each space', () => {
    const g = makeGraph()
    render(<CampusMap graph={g} />)
    const spaceCount = Object.keys(g.spaces).length
    const spaceEls = document.querySelectorAll('[data-space-id]')
    expect(spaceEls.length).toBe(spaceCount)
  })

  it('calls onNodeClick with the node id when a node is clicked', () => {
    const g = makeGraph()
    const onNodeClick = vi.fn()
    render(<CampusMap graph={g} onNodeClick={onNodeClick} />)
    const [firstNode] = document.querySelectorAll('[data-node-id]')
    fireEvent.click(firstNode!)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    const calledId = onNodeClick.mock.calls[0]![0]
    expect(Object.keys(g.nodes)).toContain(calledId)
  })

  it('marks the selected node with aria-selected', () => {
    const g = makeGraph()
    const firstNodeId = Object.keys(g.nodes)[0]
    render(<CampusMap graph={g} selectedNodeId={firstNodeId as Parameters<typeof CampusMap>[0]['selectedNodeId']} />)
    const selected = document.querySelector('[aria-selected="true"]')
    expect(selected).toBeTruthy()
    expect(selected?.getAttribute('data-node-id')).toBe(firstNodeId)
  })

  it('uses only DOM elements (no canvas)', () => {
    const { container } = render(<CampusMap graph={makeGraph()} />)
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('has a viewport container with overflow hidden', () => {
    const { container } = render(<CampusMap graph={createEmptyCampusGraph()} />)
    const viewport = container.firstChild as HTMLElement
    expect(viewport).toBeTruthy()
    expect(viewport.dataset['campusmapViewport']).toBe('true')
  })
})
