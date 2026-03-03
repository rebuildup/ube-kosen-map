// src/map/parseLayers.test.ts
import { describe, it, expect } from 'vitest'
import { parseLayers } from './parseLayers'

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><style>.cls-1{fill:#ccc}</style></defs>
  <g id="_00"><rect class="cls-1" x="0" y="0" width="50" height="50"/></g>
  <g id="_01"><circle cx="25" cy="25" r="10"/></g>
  <g id="frame"><rect x="0" y="0" width="100" height="100" fill="none" stroke="#000"/></g>
</svg>`

describe('parseLayers', () => {
  it('extracts layers with id, index, label, and svgContent', () => {
    const result = parseLayers(MINIMAL_SVG)
    expect(result.viewBox).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(result.styles).toContain('.cls-1')
    expect(result.layers).toHaveLength(3)
    expect(result.layers[0]).toMatchObject({ id: '_00', index: 0, label: '00' })
    expect(result.layers[0].svgContent).toContain('rect')
    expect(result.layers[2]).toMatchObject({ id: 'frame', index: 2, label: 'frame' })
  })

  it('parses viewBox from reference SVG dimensions', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470.53 710.52">
      <g id="_00"></g></svg>`
    const result = parseLayers(svg)
    expect(result.viewBox.width).toBeCloseTo(470.53)
    expect(result.viewBox.height).toBeCloseTo(710.52)
  })
})
