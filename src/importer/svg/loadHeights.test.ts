import { describe, expect, it } from 'vitest'
import { resolveHeight } from './loadHeights'

describe('resolveHeight', () => {
  const heights = { B001: 40, B002: 25, R001: 5 }

  it('returns height for known featureId', () => {
    expect(resolveHeight('B001', heights, 20)).toBe(40)
  })

  it('returns defaultHeight for unknown featureId', () => {
    expect(resolveHeight('UNKNOWN', heights, 20)).toBe(20)
  })

  it('returns defaultHeight when featureId is undefined', () => {
    expect(resolveHeight(undefined, heights, 15)).toBe(15)
  })
})
