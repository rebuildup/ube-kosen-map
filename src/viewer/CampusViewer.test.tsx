/**
 * CampusViewer tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CampusViewer } from './CampusViewer'
import { createEmptyCampusGraph } from '../core/schema/graph'

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
})
