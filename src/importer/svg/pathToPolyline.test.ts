import { describe, expect, it } from 'vitest'
import { pathToPolyline } from './pathToPolyline'

describe('pathToPolyline', () => {
  it('converts M/L commands to ordered points', () => {
    const points = pathToPolyline('M 0 0 L 10 0 L 10 10')
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])
  })

  it('supports relative commands', () => {
    const points = pathToPolyline('M 1 1 l 2 0 l 0 3')
    expect(points).toEqual([{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 4 }])
  })
})
