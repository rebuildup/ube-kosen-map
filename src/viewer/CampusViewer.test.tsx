/**
 * CampusViewer tests
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CampusViewer } from './CampusViewer'
import { createEmptyCampusGraph } from '../core/schema/graph'

const structuralSpy = vi.fn(({ mode }: { mode: 'flat' | '3d' }) => (
  <div data-structural-3d="true" data-render-mode={mode}>
    <button type="button" data-select-path="0">select-path</button>
  </div>
))

vi.mock('../components/CampusMap', () => ({
  StructuralSvgPseudo3D: (props: {
    mode: 'flat' | '3d'
    hideNonBuildingSymbols?: boolean
    shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
    onPathSelect?: (pathIndex: number) => void
    selectedPathIndices?: number[]
  }) => (
    <div onClick={() => props.onPathSelect?.(0)}>
      {structuralSpy(props)}
    </div>
  ),
  ShapeLayerEditor: (props: { onConfigChange?: (cfg: unknown) => void }) => (
    <button
      type="button"
      data-shape-layer-editor="true"
      onClick={() => props.onConfigChange?.({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: { '0': 'deleted' },
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [{ id: 'layer-low', name: 'Low', baseZ: 2, color: '#0ea5e9' }],
        shapePlacements: { s1: { shapeId: 's1', layerId: 'layer-low', height: 6 } },
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      })}
    >
      inspector
    </button>
  ),
}))

describe('CampusViewer', () => {
  beforeEach(() => {
    structuralSpy.mockClear()
    vi.restoreAllMocks()
  })

  it('renders without crashing', () => {
    render(<CampusViewer graph={createEmptyCampusGraph()} />)
    expect(screen.getByTestId('campus-viewer')).toBeDefined()
  })

  it('shows search panel textbox', () => {
    render(<CampusViewer graph={createEmptyCampusGraph()} />)
    expect(screen.getByRole('textbox')).toBeDefined()
  })

  it('shows view mode toggle', () => {
    render(<CampusViewer graph={createEmptyCampusGraph()} />)
    expect(screen.getByLabelText('view mode toggle')).toBeDefined()
  })

  it('shows route panel with initial prompt', () => {
    const { container } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    expect(container.querySelector('[data-no-route]')).not.toBeNull()
  })

  it('shows layer control', () => {
    render(<CampusViewer graph={createEmptyCampusGraph()} />)
    expect(screen.getByLabelText('layer control')).toBeDefined()
  })

  it('shows structural pseudo-3d scene', () => {
    render(<CampusViewer graph={createEmptyCampusGraph()} />)
    const scene = document.querySelector('[data-structural-3d="true"]')
    expect(scene).not.toBeNull()
  })

  it('renders flat structure in floor mode and 3d structure in pseudo-3d mode', () => {
    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    const first = structuralSpy.mock.calls.at(-1)?.[0] as { mode: 'flat' | '3d' }
    expect(first.mode).toBe('flat')

    const mode3dButton = getByRole('button', { name: '立体' })
    fireEvent.click(mode3dButton)

    return waitFor(() => {
      const calledModes = structuralSpy.mock.calls.map((c) => (c[0] as { mode: 'flat' | '3d' }).mode)
      expect(calledModes).toContain('3d')
    })
  })

  it('hides non-building symbols by default and can toggle', () => {
    const { getByLabelText } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    const first = structuralSpy.mock.calls.at(-1)?.[0] as { hideNonBuildingSymbols?: boolean }
    expect(first.hideNonBuildingSymbols).toBe(true)

    fireEvent.click(getByLabelText('non-building symbol toggle'))
    return waitFor(() => {
      const called = structuralSpy.mock.calls.map((c) => (c[0] as { hideNonBuildingSymbols?: boolean }).hideNonBuildingSymbols)
      expect(called).toContain(false)
    })
  })

  it('derives 3d face height from layer baseZ when placement height is zero', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [
          { id: 'layer-low', name: 'Low', baseZ: 2, color: '#0ea5e9' },
          { id: 'layer-high', name: 'High', baseZ: 6, color: '#22c55e' },
        ],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-low', height: 0 },
        },
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces).toBeDefined()
      expect(call.shapeFaces).toHaveLength(1)
      expect(call.shapeFaces?.[0]?.id).toBe('layer-low')
      expect(call.shapeFaces?.[0]?.baseZ).toBe(2)
      expect(call.shapeFaces?.[0]?.height).toBe(4)
    })
  })

  it('does not render deleted shapes in pseudo-3d', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: { s1: 'deleted' },
        shapeHeights: {},
        shapeLayers: [{ id: 'layer-low', name: 'Low', baseZ: 2, color: '#0ea5e9' }],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-low', height: 6 },
        },
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const mode3dCalls = structuralSpy.mock.calls
        .map((c) => c[0] as { mode: 'flat' | '3d' })
        .filter((p) => p.mode === '3d')
      expect(mode3dCalls.length).toBeGreaterThan(1)
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(0)
    })
  })

  it('does not render partially hidden shapes in pseudo-3d', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [{ id: 'layer-low', name: 'Low', baseZ: 2, color: '#0ea5e9' }],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-low', height: 6 },
          s2: { shapeId: 's2', layerId: 'layer-low', height: 6 },
        },
        shapeTransitions: [],
        customShapes: [
          { id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true },
          { id: 's2', pathIndices: [2, 3], isClosed: true, hasFill: true },
        ],
        hiddenShapeIds: ['s1'],
        shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(1)
      expect(call.shapeFaces?.[0]?.id).toBe('layer-low')
    })
  })

  it('ignores legacy all-hidden data so pseudo-3d does not become blank', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [{ id: 'layer-low', name: 'Low', baseZ: 2, color: '#0ea5e9' }],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-low', height: 6 },
        },
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: ['s1'],
        shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(1)
      expect(call.shapeFaces?.[0]?.id).toBe('layer-low')
    })
  })

  it('uses latest inspect edits in pseudo-3d without requiring save', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [{ id: 'layer-low', name: 'Low', baseZ: 2, color: '#0ea5e9' }],
        shapePlacements: { s1: { shapeId: 's1', layerId: 'layer-low', height: 6 } },
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole, container } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '検査' }))
    fireEvent.click(container.querySelector('[data-shape-layer-editor="true"]') as HTMLButtonElement)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(1)
      expect(call.shapeFaces?.[0]?.pathIndices).toEqual([1])
    })
  })

  it('renders shapes from all assigned layers in pseudo-3d', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [
          { id: 'layer-base', name: 'Base', baseZ: 0, color: '#0ea5e9' },
          { id: 'layer-other', name: 'Building', baseZ: 4, color: '#22c55e' },
        ],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-base', height: 6 },
          s2: { shapeId: 's2', layerId: 'layer-other', height: 6 },
        },
        shapeTransitions: [],
        customShapes: [
          { id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true },
          { id: 's2', pathIndices: [2, 3], isClosed: true, hasFill: true },
        ],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(2)
      expect((call.shapeFaces ?? []).map((s) => s.id).sort()).toEqual(['layer-base', 'layer-other'])
    })
  })

  it('renders non-base layer shapes as well in pseudo-3d', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [
          { id: 'layer-main', name: 'Building', baseZ: 4, color: '#22c55e' },
          { id: 'layer-base', name: 'Building Base', baseZ: 2, color: '#0ea5e9' },
        ],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-main', height: 6 },
          s2: { shapeId: 's2', layerId: 'layer-base', height: 6 },
        },
        shapeTransitions: [],
        customShapes: [
          { id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true },
          { id: 's2', pathIndices: [2, 3], isClosed: true, hasFill: true },
        ],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(2)
      expect((call.shapeFaces ?? []).map((s) => s.id).sort()).toEqual(['layer-base', 'layer-main'])
    })
  })

  it('renders unplaced shapes on default layer (first layer)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [
          { id: 'layer-ground', name: 'Base', baseZ: 0, color: '#16ca7c' },
          { id: 'layer-top', name: 'Top', baseZ: 4, color: '#22c55e' },
        ],
        shapePlacements: {},
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(1)
      expect(call.shapeFaces?.[0]?.id).toBe('layer-ground')
      expect(call.shapeFaces?.[0]?.baseZ).toBe(0)
    })
  })

  it('renders unplaced shapes on default layer even when explicit placements exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [
          { id: 'layer-ground', name: 'Base', baseZ: 0, color: '#16ca7c' },
          { id: 'layer-top', name: 'Top', baseZ: 4, color: '#22c55e' },
        ],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-top', height: 0 },
        },
        shapeTransitions: [],
        customShapes: [
          { id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true },
          { id: 's2', pathIndices: [2, 3], isClosed: true, hasFill: true },
        ],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(2)
      expect((call.shapeFaces ?? []).map((s) => s.id).sort()).toEqual(['layer-ground', 'layer-top'])
    })
  })

  it('allows selecting and editing a shape from pseudo-3d view', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        keepGroups: [],
        hiddenPathRanges: [],
        pathStatus: {},
        shapeStatus: {},
        shapeHeights: {},
        shapeLayers: [
          { id: 'layer-a', name: 'A', baseZ: 0, color: '#16ca7c' },
          { id: 'layer-b', name: 'B', baseZ: 6, color: '#22c55e' },
          { id: 'layer-c', name: 'C', baseZ: 12, color: '#0ea5e9' },
        ],
        shapePlacements: {
          s1: { shapeId: 's1', layerId: 'layer-a', height: 2 },
        },
        shapeTransitions: [],
        customShapes: [{ id: 's1', pathIndices: [0, 1], isClosed: true, hasFill: true }],
        hiddenShapeIds: [],
        shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
      }),
    } as Response)

    const { getByRole, getByLabelText } = render(<CampusViewer graph={createEmptyCampusGraph()} />)
    fireEvent.click(getByRole('button', { name: '立体' }))

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(1)
    })
    fireEvent.click(document.querySelector('[data-select-path="0"]') as HTMLButtonElement)

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        selectedPathIndices?: number[]
      }
      expect(call.mode).toBe('3d')
      expect(call.selectedPathIndices ?? []).toContain(0)
    })

    fireEvent.change(getByLabelText('3d shape layer'), { target: { value: 'layer-b' } })
    fireEvent.change(getByLabelText('3d shape height'), { target: { value: '5' } })

    await waitFor(() => {
      const call = structuralSpy.mock.calls.at(-1)?.[0] as {
        mode: 'flat' | '3d'
        shapeFaces?: Array<{ id: string; pathIndices: number[]; baseZ: number; height: number; color: string }>
      }
      expect(call.mode).toBe('3d')
      expect(call.shapeFaces ?? []).toHaveLength(1)
      expect(call.shapeFaces?.[0]?.id).toBe('layer-b')
      expect(call.shapeFaces?.[0]?.baseZ).toBe(6)
      expect(call.shapeFaces?.[0]?.height).toBe(5)
    })
  })
})
