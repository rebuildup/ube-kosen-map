// src/map/CampusMap.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CampusMap from './CampusMap'
import type { ParsedMap } from './parseLayers'
import type { InteractivePoint } from './types'

// Minimal parsedMap fixture
const minimalMap: ParsedMap = {
  viewBox: { x: 0, y: 0, width: 470.53, height: 710.52 },
  styles: '',
  layers: [
    { id: '_00', index: 0, label: '00', svgContent: '<rect width="10" height="10"/>' },
    { id: '_01', index: 1, label: '01', svgContent: '<rect width="20" height="20"/>' },
  ],
}

const emptyMap: ParsedMap = {
  viewBox: { x: 0, y: 0, width: 470.53, height: 710.52 },
  styles: '',
  layers: [],
}

const samplePoints: InteractivePoint[] = [
  {
    id: 'point-1',
    coordinates: { x: 100, y: 200 },
    title: 'Test Point',
    type: 'room',
  },
]

describe('CampusMap', () => {
  it('renders without crashing with minimal props (empty parsedMap)', () => {
    const { container } = render(<CampusMap parsedMap={emptyMap} />)
    // Should render an SVG element
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders SVG layers based on parsedMap.layers', () => {
    const { container } = render(<CampusMap parsedMap={minimalMap} />)
    // Each layer gets a <g> element with its id
    const g00 = container.querySelector('g#_00')
    const g01 = container.querySelector('g#_01')
    expect(g00).not.toBeNull()
    expect(g01).not.toBeNull()
  })

  it('visibleLayers prop filters which layers are rendered', () => {
    const { container } = render(
      <CampusMap parsedMap={minimalMap} visibleLayers={['_00']} />
    )
    const g00 = container.querySelector('g#_00')
    const g01 = container.querySelector('g#_01')
    expect(g00).not.toBeNull()
    expect(g01).toBeNull()
  })

  it('renders MapPin for a provided point', () => {
    render(
      <CampusMap parsedMap={minimalMap} points={samplePoints} />
    )
    // MapPin renders a button with pointer events; we look for the button element
    // Since pins render as <button> elements inside the overlay
    const buttons = screen.getAllByRole('button')
    // At least one button should exist (the pin)
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('calls onPointClick when a MapPin is clicked', () => {
    const handleClick = vi.fn()
    const { container } = render(
      <CampusMap
        parsedMap={minimalMap}
        points={samplePoints}
        onPointClick={handleClick}
        showControls={false}
      />
    )
    // MapPin renders as a <button> in the pin overlay div
    // Use querySelectorAll to find buttons directly, bypassing a11y role filtering
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    const firstButton = buttons.item(0)
    expect(firstButton).toBeDefined()
    fireEvent.click(firstButton)
    expect(handleClick).toHaveBeenCalledWith('point-1')
  })

  it('applies styles from parsedMap.styles inside a defs element', () => {
    const mapWithStyles: ParsedMap = {
      ...minimalMap,
      styles: '.test-class { fill: red; }',
    }
    const { container } = render(<CampusMap parsedMap={mapWithStyles} />)
    const style = container.querySelector('defs style')
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('.test-class')
  })

  it('renders HighlightPin when highlightPoint is provided', () => {
    const { container } = render(
      <CampusMap
        parsedMap={minimalMap}
        highlightPoint={{ x: 100, y: 200 }}
      />
    )
    // HighlightPin renders a div with pulse animation
    // It has animation: "ping ..." style
    const allDivs = container.querySelectorAll('div')
    const hasPing = Array.from(allDivs).some(
      (d) => (d as HTMLElement).style.animation?.includes('ping')
    )
    expect(hasPing).toBe(true)
  })

  it('does not render layers excluded by visibleLayers', () => {
    const { container } = render(
      <CampusMap parsedMap={minimalMap} visibleLayers={['_01']} />
    )
    expect(container.querySelector('g#_00')).toBeNull()
    expect(container.querySelector('g#_01')).not.toBeNull()
  })
})
