import { describe, expect, it } from 'vitest'
import { extractStrokeOnlySvg } from './extractStrokeOnlySvg'

describe('extractStrokeOnlySvg', () => {
  it('keeps stroke paths and removes fill-only shapes', () => {
    const raw = [
      '<svg viewBox="0 0 10 10">',
      '<path d="M0 0 L10 0" style="fill:none;stroke:#000;stroke-width:1;" />',
      '<path d="M0 1 L10 1" style="stroke:none;fill:#000;" />',
      '</svg>',
    ].join('')

    const out = extractStrokeOnlySvg(raw)
    expect(out).toContain('viewBox="0 0 10 10"')
    expect(out).toContain('d="M0 0 L10 0"')
    expect(out).not.toContain('d="M0 1 L10 1"')
    expect(out).not.toContain('fill:#000')
  })

  it('preserves group transforms while stripping fill', () => {
    const raw = [
      '<svg viewBox="0 0 10 10">',
      '<g transform="translate(3,4)">',
      '<path d="M0 0 L1 0" style="fill:none;stroke:#111;stroke-width:1;" />',
      '</g>',
      '</svg>',
    ].join('')

    const out = extractStrokeOnlySvg(raw)
    expect(out).toContain('transform="translate(3,4)"')
    expect(out).toContain('stroke:#111')
    expect(out).toContain('fill="none"')
  })
})
