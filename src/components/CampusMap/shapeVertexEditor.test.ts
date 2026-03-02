import { describe, expect, it } from 'vitest'
import type { CustomShape, ShapeBridgeEdit } from './page1InspectTypes'
import { collectShapeVertexStats } from './shapeVertexEditor'

describe('collectShapeVertexStats', () => {
  it('detects dangling vertices for an open chain', () => {
    const shape: CustomShape = {
      id: 's1',
      pathIndices: [0, 1],
      isClosed: false,
      hasFill: false,
    }
    const pathMap = new Map([
      [0, { start: [0, 0] as [number, number], end: [10, 0] as [number, number] }],
      [1, { start: [10, 0] as [number, number], end: [20, 0] as [number, number] }],
    ])

    const stats = collectShapeVertexStats(shape, pathMap, [])

    expect(stats.isClosed).toBe(false)
    expect(stats.dangling).toHaveLength(2)
  })

  it('becomes closed when a bridge connects two dangling vertices', () => {
    const shape: CustomShape = {
      id: 's1',
      pathIndices: [0, 1],
      isClosed: false,
      hasFill: false,
    }
    const pathMap = new Map([
      [0, { start: [0, 0] as [number, number], end: [10, 0] as [number, number] }],
      [1, { start: [10, 0] as [number, number], end: [20, 0] as [number, number] }],
    ])
    const bridges: ShapeBridgeEdit[] = [
      {
        id: 'b1',
        from: { pathIndex: 0, endpoint: 'start' },
        to: { pathIndex: 1, endpoint: 'end' },
      },
    ]

    const stats = collectShapeVertexStats(shape, pathMap, bridges)

    expect(stats.isClosed).toBe(true)
    expect(stats.dangling).toHaveLength(0)
  })

  it('excludes removed vertices from dangling candidates', () => {
    const shape: CustomShape = {
      id: 's1',
      pathIndices: [0],
      isClosed: false,
      hasFill: false,
    }
    const pathMap = new Map([
      [0, { start: [0, 0] as [number, number], end: [10, 0] as [number, number] }],
    ])

    const stats = collectShapeVertexStats(shape, pathMap, [], [{ pathIndex: 0, endpoint: 'start' }])

    expect(stats.isClosed).toBe(false)
    expect(stats.dangling).toHaveLength(1)
    expect(stats.dangling[0]?.refs[0]?.endpoint).toBe('end')
  })
})
