// src/map/labelLayout.test.ts
import { describe, it, expect } from 'vitest'
import { computeLabelLayout } from './labelLayout'

describe('computeLabelLayout', () => {
  it('assigns non-overlapping label directions for close pins', () => {
    const pins = [
      { x: 100, y: 100, index: 0 },
      { x: 120, y: 100, index: 1 }, // close to first
    ]
    const result = computeLabelLayout(pins, { viewportWidth: 800, viewportHeight: 600 })
    expect(result).toHaveLength(2)
    const dirs = result.map(r => r.direction)
    // Both should have a direction (not null)
    expect(dirs[0]).not.toBeNull()
    expect(dirs[1]).not.toBeNull()
    // They should not both be 'right' since labels would overlap
    expect(dirs).not.toEqual(['right', 'right'])
    expect(dirs).not.toEqual(['left', 'left'])
  })

  it('hides labels when no valid placement exists', () => {
    // 10 pins all at exactly the same position in small viewport
    const pins = Array.from({ length: 10 }, (_, i) => ({ x: 100, y: 100, index: i }))
    const result = computeLabelLayout(pins, { viewportWidth: 200, viewportHeight: 200 })
    const hidden = result.filter(r => r.direction === null)
    expect(hidden.length).toBeGreaterThan(0)
  })

  it('returns empty array for empty input', () => {
    const result = computeLabelLayout([], { viewportWidth: 800, viewportHeight: 600 })
    expect(result).toHaveLength(0)
  })

  it('single pin gets a direction assigned', () => {
    const result = computeLabelLayout([{ x: 100, y: 100, index: 0 }], { viewportWidth: 800, viewportHeight: 600 })
    expect(result).toHaveLength(1)
    expect(result[0].direction).not.toBeNull()
  })

  it('pins on the left half get right direction by default', () => {
    // Pin at x=100 in 800-wide viewport → center is 400 → pin is left of center → default right
    const result = computeLabelLayout([{ x: 100, y: 100, index: 0 }], { viewportWidth: 800, viewportHeight: 600 })
    expect(result[0].direction).toBe('right')
  })

  it('pins on the right half get left direction by default', () => {
    // Pin at x=700 in 800-wide viewport → center is 400 → pin is right of center → default left
    const result = computeLabelLayout([{ x: 700, y: 100, index: 0 }], { viewportWidth: 800, viewportHeight: 600 })
    expect(result[0].direction).toBe('left')
  })

  it('preserves original index in results', () => {
    const pins = [
      { x: 100, y: 100, index: 5 },
      { x: 400, y: 300, index: 8 },
    ]
    const result = computeLabelLayout(pins, { viewportWidth: 800, viewportHeight: 600 })
    const indices = result.map(r => r.index).sort((a, b) => a - b)
    expect(indices).toEqual([5, 8])
  })
})
