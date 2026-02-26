import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { LayerControl } from './LayerControl'
import type { LayerVisibility } from '../../core/zoom'

const defaultVis: LayerVisibility = {
  buildingOutlines: true,
  spaces: true,
  nodes: true,
  edges: true,
  labels: true,
  metadata: false,
  validation: true,
}

describe('LayerControl', () => {
  it('renders a checkbox for each layer', () => {
    const { container } = render(
      <LayerControl visibility={defaultVis} onChange={vi.fn()} />,
    )
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(Object.keys(defaultVis).length)
  })

  it('checks checkboxes matching visibility state', () => {
    const { container } = render(
      <LayerControl visibility={defaultVis} onChange={vi.fn()} />,
    )
    const checkboxes = [...container.querySelectorAll('input[type="checkbox"]')]
    const metadataBox = checkboxes.find(
      cb => (cb as HTMLInputElement).dataset.layer === 'metadata',
    ) as HTMLInputElement
    expect(metadataBox.checked).toBe(false)
    const nodesBox = checkboxes.find(
      cb => (cb as HTMLInputElement).dataset.layer === 'nodes',
    ) as HTMLInputElement
    expect(nodesBox.checked).toBe(true)
  })

  it('calls onChange when a checkbox is toggled', () => {
    const onChange = vi.fn()
    const { container } = render(
      <LayerControl visibility={defaultVis} onChange={onChange} />,
    )
    const nodesBox = container.querySelector('[data-layer="nodes"]') as HTMLInputElement
    fireEvent.click(nodesBox)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: false }),
    )
  })

  it('disables validation checkbox when isEditorMode=true', () => {
    const { container } = render(
      <LayerControl visibility={defaultVis} onChange={vi.fn()} isEditorMode />,
    )
    const valBox = container.querySelector('[data-layer="validation"]') as HTMLInputElement
    expect(valBox.disabled).toBe(true)
  })
})
