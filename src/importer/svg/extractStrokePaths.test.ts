import { describe, expect, it } from 'vitest'
import { extractStrokePaths } from './extractStrokePaths'

describe('extractStrokePaths', () => {
  it('filters drawable stroke paths from page SVG', () => {
    const raw = [
      '<svg>',
      '<path d="M0,0L1,1" style="fill:none;stroke-width:0.27;stroke:#000;"/>',
      '<path d="M0,0L1,1" style="stroke:none;"/>',
      '</svg>',
    ].join('')

    const paths = extractStrokePaths(raw)
    expect(paths).toHaveLength(1)
    expect(paths[0]?.strokeWidth).toBeCloseTo(0.27)
  })
})
