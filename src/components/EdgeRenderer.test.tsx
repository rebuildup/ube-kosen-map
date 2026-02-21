import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EdgeRenderer } from './EdgeRenderer'
import type { Node, Edge } from '../types'

describe('EdgeRenderer', () => {
  const nodes: Node[] = [
    { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'n2', type: 'room', position: { x: 100, y: 100 }, floor: 1, tags: [], data: {} },
  ]
  const edge: Edge = {
    id: 'e1',
    from: 'n1',
    to: 'n2',
    bidirectional: true,
    distance: 141,
    constraints: {},
    tags: [],
    data: {},
  }
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  it('should render a line between nodes', () => {
    const { container } = render(
      <svg>
        <EdgeRenderer edge={edge} nodes={nodeMap} scale={1} />
      </svg>
    )

    const line = container.querySelector('line')
    expect(line).toBeInTheDocument()
    expect(line?.getAttribute('x1')).toBe('0')
    expect(line?.getAttribute('y1')).toBe('0')
    expect(line?.getAttribute('x2')).toBe('100')
    expect(line?.getAttribute('y2')).toBe('100')
  })

  it('should render nothing if nodes not found', () => {
    const emptyMap = new Map<string, Node>()
    const { container } = render(
      <svg>
        <EdgeRenderer edge={edge} nodes={emptyMap} scale={1} />
      </svg>
    )

    const line = container.querySelector('line')
    expect(line).not.toBeInTheDocument()
  })

  it('should highlight route edge', () => {
    const { container } = render(
      <svg>
        <EdgeRenderer edge={edge} nodes={nodeMap} scale={1} isOnRoute={true} />
      </svg>
    )

    const line = container.querySelector('line')
    expect(line?.getAttribute('stroke')).toBe('#ff6600')
    expect(line?.getAttribute('stroke-width')).toBe('4')
  })
})
