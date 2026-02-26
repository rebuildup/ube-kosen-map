import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RoutePanel } from './RoutePanel'
import type { Route } from '../../core/routing'

const makeRoute = (): Route => ({
  nodeIds: ['n1', 'n2', 'n3'],
  totalCost: 25.5,
  floorTransitions: [
    { nodeId: 'n2', fromFloorId: 'f1', toFloorId: 'f2', description: '1F→2F' },
  ],
})

describe('RoutePanel', () => {
  it('renders total cost', () => {
    const { getByText } = render(<RoutePanel route={makeRoute()} />)
    expect(getByText(/25\.5|25,5/)).toBeTruthy()
  })

  it('shows floor transition info', () => {
    const { getByText } = render(<RoutePanel route={makeRoute()} />)
    expect(getByText(/1F→2F/)).toBeTruthy()
  })

  it('shows node count in route', () => {
    const route = makeRoute()
    const { container } = render(<RoutePanel route={route} />)
    const nodeEls = container.querySelectorAll('[data-route-node]')
    expect(nodeEls.length).toBe(route.nodeIds.length)
  })

  it('calls onAlternativeSelect when alternative is clicked', () => {
    const alt: Route = { nodeIds: ['n1', 'n3'], totalCost: 30, floorTransitions: [] }
    const onSelect = vi.fn()
    const { container } = render(
      <RoutePanel route={makeRoute()} alternatives={[alt]} onAlternativeSelect={onSelect} />,
    )
    const altBtn = container.querySelector('[data-alternative-route]')
    expect(altBtn).toBeTruthy()
    fireEvent.click(altBtn!)
    expect(onSelect).toHaveBeenCalledWith(0)
  })

  it('renders null gracefully when no route provided', () => {
    const { container } = render(<RoutePanel route={null} />)
    expect(container.querySelector('[data-no-route]')).toBeTruthy()
  })
})
