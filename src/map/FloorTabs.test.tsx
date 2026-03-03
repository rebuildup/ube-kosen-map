// src/map/FloorTabs.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FloorTabs from './FloorTabs'
import type { MapLayer } from './types'

const layers: MapLayer[] = [
  { id: '_00', index: 0, label: '00', svgContent: '' },
  { id: '_01', index: 1, label: '01', svgContent: '' },
  { id: '_02', index: 2, label: '02', svgContent: '' },
]

describe('FloorTabs', () => {
  it('renders a button for each layer', () => {
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={['_00', '_01', '_02']}
        onVisibleLayersChange={vi.fn()}
      />,
    )
    // Each layer shows its label as button text
    expect(screen.getByRole('button', { name: '00' })).toBeDefined()
    expect(screen.getByRole('button', { name: '01' })).toBeDefined()
    expect(screen.getByRole('button', { name: '02' })).toBeDefined()
  })

  it('active layer button has different style than inactive', () => {
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={['_00']}
        onVisibleLayersChange={vi.fn()}
      />,
    )
    const activeBtn = screen.getByRole('button', { name: '00' })
    const inactiveBtn = screen.getByRole('button', { name: '01' })
    // Active uses accent background; inactive uses transparent
    expect((activeBtn as HTMLButtonElement).style.background).toBe('var(--map-accent, #3b82f6)')
    expect((inactiveBtn as HTMLButtonElement).style.background).toBe('transparent')
  })

  it('clicking an active layer button removes it from visibleLayers', () => {
    const onChange = vi.fn()
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={['_00', '_01']}
        onVisibleLayersChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '00' }))
    expect(onChange).toHaveBeenCalledWith(['_01'])
  })

  it('clicking an inactive layer button adds it to visibleLayers', () => {
    const onChange = vi.fn()
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={['_00']}
        onVisibleLayersChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '01' }))
    expect(onChange).toHaveBeenCalledWith(['_00', '_01'])
  })

  it('"全表示" button calls onVisibleLayersChange with all layer IDs', () => {
    const onChange = vi.fn()
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={[]}
        onVisibleLayersChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '全表示' }))
    expect(onChange).toHaveBeenCalledWith(['_00', '_01', '_02'])
  })

  it('"全非表示" button calls onVisibleLayersChange with []', () => {
    const onChange = vi.fn()
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={['_00', '_01', '_02']}
        onVisibleLayersChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '全非表示' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('renders header text "フロア / レイヤー"', () => {
    render(
      <FloorTabs
        layers={layers}
        visibleLayers={[]}
        onVisibleLayersChange={vi.fn()}
      />,
    )
    expect(screen.getByText('フロア / レイヤー')).toBeDefined()
  })
})
