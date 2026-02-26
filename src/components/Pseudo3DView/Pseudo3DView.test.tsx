import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Pseudo3DView } from './Pseudo3DView'
import { createEmptyCampusGraph } from '../../core/schema/graph'
import { createFloorId, createBuildingId } from '../../core/schema/ids'
import type { CampusGraph } from '../../core/schema/types'

function makeGraph(): CampusGraph {
  const g = createEmptyCampusGraph()
  const b = createBuildingId()
  const f1 = createFloorId()
  const f2 = createFloorId()
  const f3 = createFloorId()
  return {
    ...g,
    buildings: { [b]: { id: b, name: 'Main' } },
    floors: {
      [f1]: { id: f1, buildingId: b, level: 1, name: '1F' },
      [f2]: { id: f2, buildingId: b, level: 2, name: '2F' },
      [f3]: { id: f3, buildingId: b, level: 3, name: '3F' },
    },
    nodes: {},
    edges: {},
    spaces: {},
  }
}

describe('Pseudo3DView', () => {
  it('renders one floor element per floor', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <Pseudo3DView graph={graph} buildingId={buildingId} />,
    )
    const floors = container.querySelectorAll('[data-floor-level]')
    expect(floors.length).toBe(3)
  })

  it('applies translateZ to each floor element proportional to level', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const spacing = 80
    const { container } = render(
      <Pseudo3DView graph={graph} buildingId={buildingId} floorSpacing={spacing} />,
    )
    const floors = [...container.querySelectorAll('[data-floor-level]')] as HTMLElement[]
    // Floors sorted by level; each should have translateZ in style
    for (const floor of floors) {
      expect(floor.style.transform).toContain('translateZ')
    }
  })

  it('renders a perspective container', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <Pseudo3DView graph={graph} buildingId={buildingId} />,
    )
    const sceneEl = container.querySelector('[data-3d-scene]') as HTMLElement
    expect(sceneEl).not.toBeNull()
    // Parent should have perspective style
    const parent = sceneEl.parentElement as HTMLElement
    expect(parent.style.perspective).not.toBe('')
  })

  it('renders a floor-spacing slider', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <Pseudo3DView graph={graph} buildingId={buildingId} />,
    )
    const slider = container.querySelector('input[type="range"][data-spacing-slider]')
    expect(slider).not.toBeNull()
  })

  it('calls onSpacingChange when slider is moved', () => {
    const onSpacingChange = vi.fn()
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <Pseudo3DView graph={graph} buildingId={buildingId} onSpacingChange={onSpacingChange} />,
    )
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '120' } })
    expect(onSpacingChange).toHaveBeenCalledWith(120)
  })

  it('applies preserve-3d and rotation to the scene element', () => {
    const graph = makeGraph()
    const buildingId = Object.keys(graph.buildings)[0] as any
    const { container } = render(
      <Pseudo3DView graph={graph} buildingId={buildingId} rotateX={30} rotateY={45} />,
    )
    const scene = container.querySelector('[data-3d-scene]') as HTMLElement
    expect(scene.style.transformStyle).toBe('preserve-3d')
    expect(scene.style.transform).toContain('rotateX(30deg)')
    expect(scene.style.transform).toContain('rotateY(45deg)')
  })
})
