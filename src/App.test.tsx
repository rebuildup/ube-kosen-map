import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../data/derived/page_1.graph.json', () => ({
  default: {
    version: '1.0.0',
    lastModified: '2026-02-27T00:00:00.000Z',
    buildings: {},
    floors: {},
    nodes: {},
    edges: {},
    spaces: {},
  },
}))

vi.mock('./viewer', () => ({
  CampusViewer: () => <div data-testid="campus-viewer" />,
}))

import App from './App'

describe('App', () => {
  it('renders CampusViewer as root component by default', () => {
    const { container } = render(<App />)
    expect(container.querySelector('[data-testid="campus-viewer"]')).not.toBeNull()
  })

  it('switches to editor mode on button click', () => {
    const { container, getByRole } = render(<App />)
    fireEvent.click(getByRole('button', { name: 'エディター' }))
    expect(container.querySelector('[data-editor-root]')).not.toBeNull()
  })

  it('switches back to viewer mode', () => {
    const { container, getByRole } = render(<App />)
    fireEvent.click(getByRole('button', { name: 'エディター' }))
    fireEvent.click(getByRole('button', { name: 'ビューアー' }))
    expect(container.querySelector('[data-testid="campus-viewer"]')).not.toBeNull()
  })
})
