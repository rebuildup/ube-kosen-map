import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NodeRenderer } from './NodeRenderer'
import type { Node } from '../types'

describe('NodeRenderer', () => {
  const node: Node = {
    id: 'n1',
    type: 'room',
    position: { x: 100, y: 200 },
    floor: 1,
    name: 'Room 101',
    tags: ['lecture'],
    data: { width: 50, height: 30 },
  }

  it('should render a rect for room type', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={1} />
      </svg>
    )

    const rect = container.querySelector('rect')
    expect(rect).toBeInTheDocument()
  })

  it('should render a circle for stairs type', () => {
    const stairsNode: Node = { ...node, id: 'n2', type: 'stairs' }
    const { container } = render(
      <svg>
        <NodeRenderer node={stairsNode} scale={1} />
      </svg>
    )

    const circle = container.querySelector('circle')
    expect(circle).toBeInTheDocument()
  })

  it('should render a circle for elevator type', () => {
    const elevatorNode: Node = { ...node, id: 'n3', type: 'elevator' }
    const { container } = render(
      <svg>
        <NodeRenderer node={elevatorNode} scale={1} />
      </svg>
    )

    const circle = container.querySelector('circle')
    expect(circle).toBeInTheDocument()
  })

  it('should position element at correct coordinates with scale', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={2} />
      </svg>
    )

    const element = container.querySelector('rect')
    // x = 100 * 2 - (50 * 2) / 2 = 200 - 50 = 150
    // y = 200 * 2 - (30 * 2) / 2 = 400 - 30 = 370
    expect(element?.getAttribute('x')).toBe('150')
    expect(element?.getAttribute('y')).toBe('370')
    expect(element?.getAttribute('width')).toBe('100')
    expect(element?.getAttribute('height')).toBe('60')
  })

  it('should highlight selected node with orange stroke', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={1} isSelected={true} />
      </svg>
    )

    const element = container.querySelector('rect')
    expect(element?.getAttribute('stroke')).toBe('#ff6600')
    expect(element?.getAttribute('stroke-width')).toBe('3')
  })

  it('should use default stroke for non-selected node', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={1} isSelected={false} />
      </svg>
    )

    const element = container.querySelector('rect')
    expect(element?.getAttribute('stroke')).toBe('#333')
    expect(element?.getAttribute('stroke-width')).toBe('1')
  })

  it('should call onClick when node is clicked', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={1} onClick={handleClick} />
      </svg>
    )

    const element = container.querySelector('rect')
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handleClick).toHaveBeenCalledWith(node)
  })

  it('should have correct test id', () => {
    const { getByTestId } = render(
      <svg>
        <NodeRenderer node={node} scale={1} />
      </svg>
    )

    expect(getByTestId('node-n1')).toBeInTheDocument()
  })

  it('should use default dimensions when not specified', () => {
    const nodeWithoutSize: Node = {
      ...node,
      id: 'n4',
      data: {},
    }
    const { container } = render(
      <svg>
        <NodeRenderer node={nodeWithoutSize} scale={1} />
      </svg>
    )

    const element = container.querySelector('rect')
    // Default width=20, height=20
    // x = 100 - 20/2 = 90
    // y = 200 - 20/2 = 190
    expect(element?.getAttribute('x')).toBe('90')
    expect(element?.getAttribute('y')).toBe('190')
    expect(element?.getAttribute('width')).toBe('20')
    expect(element?.getAttribute('height')).toBe('20')
  })

  it('should render correct fill colors for different node types', () => {
    const types: Array<{ type: string; expectedColor: string }> = [
      { type: 'room', expectedColor: '#4a90d9' },
      { type: 'corridor', expectedColor: '#8bc34a' },
      { type: 'stairs', expectedColor: '#ff9800' },
      { type: 'elevator', expectedColor: '#9c27b0' },
      { type: 'entrance', expectedColor: '#f44336' },
      { type: 'office', expectedColor: '#2196f3' },
    ]

    types.forEach(({ type, expectedColor }) => {
      const typedNode: Node = { ...node, id: `test-${type}`, type }
      const { container } = render(
        <svg>
          <NodeRenderer node={typedNode} scale={1} />
        </svg>
      )

      const element = container.querySelector(type === 'stairs' || type === 'elevator' ? 'circle' : 'rect')
      expect(element?.getAttribute('fill')).toBe(expectedColor)
    })
  })

  it('should use default color for unknown type', () => {
    const unknownNode: Node = { ...node, id: 'n5', type: 'unknown_type' }
    const { container } = render(
      <svg>
        <NodeRenderer node={unknownNode} scale={1} />
      </svg>
    )

    const element = container.querySelector('rect')
    expect(element?.getAttribute('fill')).toBe('#888')
  })
})
