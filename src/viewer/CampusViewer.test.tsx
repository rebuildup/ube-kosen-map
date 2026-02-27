/**
 * CampusViewer tests
 */

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CampusViewer } from './CampusViewer'
import { createEmptyCampusGraph } from '../core/schema/graph'

const structuralSpy = vi.fn(({ mode }: { mode: 'flat' | '3d' }) => (
  <div data-structural-3d="true" data-render-mode={mode} />
))

vi.mock('../components/CampusMap', () => ({
  StructuralSvgPseudo3D: (props: { mode: 'flat' | '3d'; hideNonBuildingSymbols?: boolean }) => structuralSpy(props),
}))

describe('CampusViewer', () => {
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
})
