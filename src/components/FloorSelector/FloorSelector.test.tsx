import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { FloorSelector, computeFloorVisibility } from './FloorSelector'
import { createFloorId } from '../../core/schema'
import type { Floor } from '../../core/schema'

const makeFloors = (): Floor[] => {
  const f1 = createFloorId()
  const f2 = createFloorId()
  const f3 = createFloorId()
  return [
    { id: f1, level: 1, name: '1F' },
    { id: f2, level: 2, name: '2F' },
    { id: f3, level: 3, name: '3F' },
  ]
}

describe('computeFloorVisibility', () => {
  it('active floor has opacity 1', () => {
    const floors = makeFloors()
    const vis = computeFloorVisibility(floors, floors[1]!.id)
    expect(vis.find(v => v.floorId === floors[1]!.id)?.opacity).toBe(1)
  })

  it('adjacent floors have opacity 0.3', () => {
    const floors = makeFloors()
    const vis = computeFloorVisibility(floors, floors[1]!.id)
    expect(vis.find(v => v.floorId === floors[0]!.id)?.opacity).toBe(0.3)
    expect(vis.find(v => v.floorId === floors[2]!.id)?.opacity).toBe(0.3)
  })

  it('non-adjacent floors have opacity 0', () => {
    const floors = [
      { id: 'f1', level: 1, name: '1F' } as Floor,
      { id: 'f2', level: 2, name: '2F' } as Floor,
      { id: 'f3', level: 3, name: '3F' } as Floor,
      { id: 'f4', level: 4, name: '4F' } as Floor,
    ]
    const vis = computeFloorVisibility(floors, 'f1')
    expect(vis.find(v => v.floorId === 'f3')?.opacity).toBe(0)
    expect(vis.find(v => v.floorId === 'f4')?.opacity).toBe(0)
  })

  it('marks the active floor correctly', () => {
    const floors = makeFloors()
    const vis = computeFloorVisibility(floors, floors[0]!.id)
    expect(vis.find(v => v.isActive)?.floorId).toBe(floors[0]!.id)
  })
})

describe('FloorSelector', () => {
  it('renders a button for each floor', () => {
    const floors = makeFloors()
    const { container } = render(<FloorSelector floors={floors} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(floors.length)
  })

  it('sorts floors from highest to lowest (top to bottom)', () => {
    const floors = makeFloors()
    const { container } = render(<FloorSelector floors={floors} activeFloorId={floors[0]!.id} />)
    const buttons = [...container.querySelectorAll('button')]
    const names = buttons.map(b => b.textContent)
    expect(names).toEqual(['3F', '2F', '1F'])
  })

  it('marks active floor as aria-selected', () => {
    const floors = makeFloors()
    const { container } = render(
      <FloorSelector floors={floors} activeFloorId={floors[1]!.id} />,
    )
    const selected = container.querySelector('[aria-selected="true"]')
    expect(selected).toBeTruthy()
    expect(selected?.getAttribute('data-floor-id')).toBe(floors[1]!.id)
  })

  it('calls onFloorChange when a floor button is clicked', () => {
    const floors = makeFloors()
    const onChange = vi.fn()
    const { container } = render(
      <FloorSelector floors={floors} activeFloorId={floors[0]!.id} onFloorChange={onChange} />,
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[0]!) // click first button (3F)
    expect(onChange).toHaveBeenCalledWith(floors[2]!.id)
  })
})
