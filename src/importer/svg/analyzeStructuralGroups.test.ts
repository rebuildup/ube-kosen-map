import { describe, expect, it } from 'vitest'
import { analyzeStructuralGroups } from './analyzeStructuralGroups'
import page1SvgRaw from '../../../docs/reference/page_1.svg?raw'

describe('analyzeStructuralGroups', () => {
  it('creates layered output from nested groups', () => {
    const svg = [
      '<svg viewBox="0 0 20 20">',
      '<g id="a">',
      '<path d="M0 0 L10 0" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 1 L10 1" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 2 L10 2" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 3 L10 3" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 4 L10 4" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 5 L10 5" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 6 L10 6" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 7 L10 7" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 8 L10 8" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 9 L10 9" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 10 L10 10" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 11 L10 11" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 12 L10 12" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 13 L10 13" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 14 L10 14" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 15 L10 15" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 16 L10 16" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 17 L10 17" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 18 L10 18" style="fill:none;stroke:#111;stroke-width:1;" />',
      '<path d="M0 19 L10 19" style="fill:none;stroke:#111;stroke-width:1;" />',
      '</g>',
      '</svg>',
    ].join('')

    const result = analyzeStructuralGroups(svg)
    expect(result.viewBox).toBe('0 0 20 20')
    expect(result.baseStrokeSvg).toContain('<svg')
    expect(result.layers.length).toBeGreaterThan(0)
    expect(result.layers[0]?.svgMarkup).toContain('fill-opacity')
  })

  it('falls back to style-based layering when only one structural group exists', () => {
    const svg = [
      '<svg viewBox="0 0 20 20">',
      '<g id="surface1">',
      '<path d="M0 0 L10 0" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 1 L10 1" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 2 L10 2" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 3 L10 3" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 4 L10 4" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 5 L10 5" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 6 L10 6" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 7 L10 7" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 8 L10 8" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 9 L10 9" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 10 L10 10" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 11 L10 11" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 12 L10 12" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 13 L10 13" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 14 L10 14" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 15 L10 15" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 16 L10 16" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 17 L10 17" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 18 L10 18" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 19 L10 19" style="fill:none;stroke:#111;stroke-width:0.2;" />',
      '<path d="M0 0 L0 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M1 0 L1 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M2 0 L2 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M3 0 L3 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M4 0 L4 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M5 0 L5 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M6 0 L6 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M7 0 L7 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M8 0 L8 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M9 0 L9 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M10 0 L10 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M11 0 L11 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M12 0 L12 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M13 0 L13 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M14 0 L14 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M15 0 L15 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M16 0 L16 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M17 0 L17 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M18 0 L18 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '<path d="M19 0 L19 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
      '</g>',
      '</svg>',
    ].join('')

    const result = analyzeStructuralGroups(svg)
    expect(result.layers.length).toBeGreaterThan(1)
    expect(result.layers[0]?.id.startsWith('layer-style-')).toBe(true)
    expect(result.connectors.length).toBeGreaterThan(0)
  })

  it('creates z-connectors for real page_1.svg', () => {
    const result = analyzeStructuralGroups(page1SvgRaw, { hideNonBuildingSymbols: true })
    expect(result.layers.length).toBeGreaterThan(1)
    expect(result.connectors.length).toBeGreaterThan(0)
  }, 30000)

  it('keeps most real connectors inside page_1 viewBox bounds', () => {
    const result = analyzeStructuralGroups(page1SvgRaw, { hideNonBuildingSymbols: true })
    const [minX, minY, w, h] = result.viewBox.split(/\s+/).map(Number)
    const maxX = minX + w
    const maxY = minY + h
    const inside = result.connectors.filter((c) => c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY)
    const ratio = result.connectors.length > 0 ? inside.length / result.connectors.length : 0
    expect(ratio).toBeGreaterThan(0.9)
  }, 30000)

  it('keeps connector anchors in global coordinates when parent group has transform', () => {
    const svg = [
      '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">',
      '<g transform="translate(120 80)">',
      '<g id="layer-a">',
      ...Array.from({ length: 20 }, (_, i) => (
        `<line x1="${i}" y1="0" x2="${i}" y2="40" style="stroke:#111;stroke-width:1;fill:none;" />`
      )),
      '</g>',
      '<g id="layer-b">',
      ...Array.from({ length: 20 }, (_, i) => (
        `<line x1="${i}" y1="0" x2="${i}" y2="40" style="stroke:#333;stroke-width:1;fill:none;" />`
      )),
      '</g>',
      '</g>',
      '</svg>',
    ].join('')

    const result = analyzeStructuralGroups(svg)
    expect(result.layers.length).toBeGreaterThan(1)
    expect(result.connectors.length).toBeGreaterThan(0)
    const first = result.connectors[0]
    expect(first).toBeDefined()
    expect((first?.x ?? 0) > 110).toBe(true)
    expect((first?.y ?? 0) > 70).toBe(true)
  })

  it('does not create bogus anchors from path arc flags', () => {
    const buildArcLayer = (stroke: string): string => (
      Array.from({ length: 20 }, (_, i) => (
        `<path d="M ${100 + i} ${120 + i} A 30 50 0 0 1 ${200 + i} ${240 + i}" style="fill:none;stroke:${stroke};stroke-width:1;" />`
      )).join('')
    )

    const svg = [
      '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">',
      '<g>',
      buildArcLayer('#111'),
      buildArcLayer('#333'),
      '</g>',
      '</svg>',
    ].join('')

    const result = analyzeStructuralGroups(svg)
    expect(result.layers.length).toBeGreaterThan(1)
    expect(result.connectors.length).toBeGreaterThan(0)
    const nearOrigin = result.connectors.filter((c) => c.x < 10 && c.y < 10)
    expect(nearOrigin.length).toBe(0)
  })

  it('connects nearby vertices even when adjacent layers are slightly shifted', () => {
    const mkLines = (stroke: string, dx: number): string =>
      Array.from({ length: 24 }, (_, i) => (
        `<line x1="${50 + i + dx}" y1="80" x2="${50 + i + dx}" y2="140" style="stroke:${stroke};stroke-width:1;fill:none;" />`
      )).join('')

    const svg = [
      '<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">',
      '<g>',
      mkLines('#111', 0),
      mkLines('#333', 1.2),
      '</g>',
      '</svg>',
    ].join('')

    const result = analyzeStructuralGroups(svg)
    expect(result.layers.length).toBeGreaterThan(1)
    expect(result.connectors.length).toBeGreaterThan(12)
  })

  it('stores connector endpoints as from/to vertices (not midpoint only)', () => {
    const svg = [
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">',
      '<g>',
      ...Array.from({ length: 20 }, (_, i) => (
        `<line x1="${20 + i}" y1="20" x2="${20 + i}" y2="80" style="stroke:#111;stroke-width:1;fill:none;" />`
      )),
      ...Array.from({ length: 20 }, (_, i) => (
        `<line x1="${22 + i}" y1="22" x2="${22 + i}" y2="82" style="stroke:#333;stroke-width:1;fill:none;" />`
      )),
      '</g>',
      '</svg>',
    ].join('')

    const result = analyzeStructuralGroups(svg)
    expect(result.connectors.length).toBeGreaterThan(0)
    const c = result.connectors[0] as unknown as {
      xFrom?: number
      yFrom?: number
      xTo?: number
      yTo?: number
    }
    expect(typeof c.xFrom).toBe('number')
    expect(typeof c.yFrom).toBe('number')
    expect(typeof c.xTo).toBe('number')
    expect(typeof c.yTo).toBe('number')
  })
})
