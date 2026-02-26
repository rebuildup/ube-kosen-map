import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { BuildingFloorManager } from './BuildingFloorManager'
import { createEmptyCampusGraph } from '../core/schema/graph'
import { createBuildingId } from '../core/schema/ids'
import type { CampusGraph, Building } from '../core/schema/types'

describe('BuildingFloorManager', () => {
  it('renders "建物を追加" button', () => {
    const { container } = render(
      <BuildingFloorManager graph={createEmptyCampusGraph()} activeFloorId={null}
        onGraphUpdate={vi.fn()} onFloorSelect={vi.fn()} />,
    )
    expect(container.querySelector('[data-action="add-building"]')).not.toBeNull()
  })

  it('calls onGraphUpdate with new building when form is submitted', () => {
    const onGraphUpdate = vi.fn()
    const { container } = render(
      <BuildingFloorManager graph={createEmptyCampusGraph()} activeFloorId={null}
        onGraphUpdate={onGraphUpdate} onFloorSelect={vi.fn()} />,
    )
    fireEvent.click(container.querySelector('[data-action="add-building"]')!)
    const nameInput = container.querySelector('[data-field="building-name"]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: '本館' } })
    fireEvent.click(container.querySelector('[data-action="confirm-add-building"]')!)
    expect(onGraphUpdate).toHaveBeenCalled()
    const updated = onGraphUpdate.mock.calls[0][0] as CampusGraph
    const buildings = Object.values(updated.buildings) as Building[]
    expect(buildings.some(b => b.name === '本館')).toBe(true)
  })

  it('calls onGraphUpdate with new floor when floor form is submitted', () => {
    const bid = createBuildingId()
    const graph: CampusGraph = {
      ...createEmptyCampusGraph(),
      buildings: { [bid]: { id: bid, name: 'Main' } },
    }
    const onGraphUpdate = vi.fn()
    const { container } = render(
      <BuildingFloorManager graph={graph} activeFloorId={null}
        onGraphUpdate={onGraphUpdate} onFloorSelect={vi.fn()} />,
    )
    fireEvent.click(container.querySelector('[data-action="add-floor"]')!)
    const levelInput = container.querySelector('[data-field="floor-level"]') as HTMLInputElement
    fireEvent.change(levelInput, { target: { value: '1' } })
    fireEvent.click(container.querySelector('[data-action="confirm-add-floor"]')!)
    expect(onGraphUpdate).toHaveBeenCalled()
    const updated = onGraphUpdate.mock.calls[0][0] as CampusGraph
    expect(Object.keys(updated.floors).length).toBe(1)
  })
})
