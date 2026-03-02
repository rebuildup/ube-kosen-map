import { describe, expect, it } from 'vitest'
import type { CustomShape, ShapeEditConfig } from './page1InspectTypes'
import { applyShapeEdits } from './page1ShapeEdits'

describe('applyShapeEdits', () => {
  it('merges source shapes into a single shape', () => {
    const base: CustomShape[] = [
      { id: 's1', pathIndices: [1, 2], isClosed: false, hasFill: false },
      { id: 's2', pathIndices: [3], isClosed: false, hasFill: false },
    ]
    const edits: ShapeEditConfig = {
      merges: [
        {
          id: 'm1',
          sourceShapeIds: ['s1', 's2'],
          resultShapeId: 's12',
          isClosed: true,
          hasFill: true,
          fillColor: '#ff0000',
        },
      ],
    }

    const merged = applyShapeEdits(base, edits)

    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({
      id: 's12',
      pathIndices: [1, 2, 3],
      isClosed: true,
      hasFill: true,
      fillColor: '#ff0000',
    })
  })

  it('splits a source shape into parts', () => {
    const base: CustomShape[] = [
      { id: 's1', pathIndices: [10, 11, 12], isClosed: true, hasFill: true, fillColor: '#00ff00' },
    ]
    const edits: ShapeEditConfig = {
      splits: [
        {
          id: 'sp1',
          sourceShapeId: 's1',
          parts: [
            { id: 's1-a', pathIndices: [10, 11] },
            { id: 's1-b', pathIndices: [12], hasFill: false },
          ],
        },
      ],
    }

    const split = applyShapeEdits(base, edits)

    expect(split).toHaveLength(2)
    expect(split).toEqual([
      { id: 's1-a', pathIndices: [10, 11], isClosed: true, hasFill: true, fillColor: '#00ff00' },
      { id: 's1-b', pathIndices: [12], isClosed: true, hasFill: false, fillColor: '#00ff00' },
    ])
  })
})
