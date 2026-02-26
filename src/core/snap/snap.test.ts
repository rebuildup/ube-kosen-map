import { describe, it, expect } from 'vitest'
import { findSnap } from './index'
import type { SnapContext } from './types'

// ── Vertex snap ───────────────────────────────────────────────────────────────

describe('vertex snap', () => {
  it('snaps to a nearby vertex within threshold', () => {
    const ctx: SnapContext = {
      vertices: [{ x: 10, y: 10 }],
      segments: [],
    }
    const result = findSnap({ x: 14, y: 10 }, ctx, { vertexThreshold: 8 })
    expect(result.type).toBe('vertex')
    expect(result.position).toEqual({ x: 10, y: 10 })
  })

  it('does not snap when outside vertex threshold', () => {
    const ctx: SnapContext = {
      vertices: [{ x: 10, y: 10 }],
      segments: [],
    }
    const result = findSnap({ x: 20, y: 10 }, ctx, { vertexThreshold: 8 })
    expect(result.type).not.toBe('vertex')
  })

  it('snaps to the closest vertex when multiple are in range', () => {
    const ctx: SnapContext = {
      vertices: [{ x: 10, y: 10 }, { x: 13, y: 10 }, { x: 5, y: 10 }],
      segments: [],
    }
    const result = findSnap({ x: 12, y: 10 }, ctx, { vertexThreshold: 8 })
    expect(result.type).toBe('vertex')
    expect(result.position).toEqual({ x: 13, y: 10 }) // closest
  })

  it('vertex snap takes priority over edge snap', () => {
    const ctx: SnapContext = {
      vertices: [{ x: 0, y: 0 }],
      segments: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]],
    }
    // Cursor at (5, 0) — within edge threshold AND vertex threshold (if vertex is at 0,0)
    // Actually distance to vertex (0,0) = 5, distance to edge = 0
    // But with vertex threshold=8 and edge threshold=6, vertex wins if dist<8
    const result = findSnap({ x: 5, y: 0 }, ctx, { vertexThreshold: 8, edgeThreshold: 6 })
    expect(result.type).toBe('vertex')
    expect(result.position).toEqual({ x: 0, y: 0 })
  })
})

// ── Edge snap ─────────────────────────────────────────────────────────────────

describe('edge snap', () => {
  it('snaps to nearest point on segment within threshold', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]],
    }
    // Cursor at (50, 5) — closest point on segment is (50, 0), distance = 5 < 6
    const result = findSnap({ x: 50, y: 5 }, ctx, { edgeThreshold: 6 })
    expect(result.type).toBe('edge')
    expect(result.position.x).toBeCloseTo(50)
    expect(result.position.y).toBeCloseTo(0)
  })

  it('does not snap when outside edge threshold', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]],
    }
    const result = findSnap({ x: 50, y: 10 }, ctx, { edgeThreshold: 6 })
    expect(result.type).not.toBe('edge')
  })

  it('snaps to endpoint when cursor is beyond segment end', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [[{ x: 0, y: 0 }, { x: 10, y: 0 }]],
    }
    // Cursor beyond the end at (15, 0) — nearest point is endpoint (10, 0)
    const result = findSnap({ x: 15, y: 2 }, ctx, { edgeThreshold: 6 })
    expect(result.type).toBe('edge')
    expect(result.position.x).toBeCloseTo(10)
    expect(result.position.y).toBeCloseTo(0)
  })

  it('snaps to closest edge when multiple are in range', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [
        [{ x: 0, y: 3 }, { x: 100, y: 3 }],  // 3 units away
        [{ x: 0, y: 1 }, { x: 100, y: 1 }],  // 1 unit away
      ],
    }
    const result = findSnap({ x: 50, y: 0 }, ctx, { edgeThreshold: 6 })
    expect(result.type).toBe('edge')
    expect(result.position.y).toBeCloseTo(1) // closer edge
  })
})

// ── Grid snap ─────────────────────────────────────────────────────────────────

describe('grid snap', () => {
  it('snaps to nearest grid intersection', () => {
    const ctx: SnapContext = { vertices: [], segments: [] }
    const result = findSnap({ x: 13, y: 7 }, ctx, { gridSize: 10, enableGrid: true })
    expect(result.type).toBe('grid')
    expect(result.position).toEqual({ x: 10, y: 10 })
  })

  it('snaps to (0,0) grid when cursor is near origin', () => {
    const ctx: SnapContext = { vertices: [], segments: [] }
    const result = findSnap({ x: 2, y: 3 }, ctx, { gridSize: 10, enableGrid: true })
    expect(result.type).toBe('grid')
    expect(result.position).toEqual({ x: 0, y: 0 })
  })

  it('does not snap to grid when disabled', () => {
    const ctx: SnapContext = { vertices: [], segments: [] }
    const result = findSnap({ x: 13, y: 7 }, ctx, { gridSize: 10, enableGrid: false })
    expect(result.type).toBe('free')
  })

  it('vertex snap has priority over grid snap', () => {
    const ctx: SnapContext = {
      vertices: [{ x: 12, y: 5 }],
      segments: [],
    }
    const result = findSnap({ x: 13, y: 7 }, ctx, {
      vertexThreshold: 8, gridSize: 10, enableGrid: true,
    })
    expect(result.type).toBe('vertex')
    expect(result.position).toEqual({ x: 12, y: 5 })
  })
})

// ── Orthogonal snap ───────────────────────────────────────────────────────────

describe('orthogonal snap', () => {
  it('snaps cursor to horizontal axis of previous point', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [],
      previousPoint: { x: 0, y: 0 },
    }
    // Cursor is almost horizontal from (0,0) — should snap to y=0
    const result = findSnap({ x: 50, y: 3 }, ctx, {
      orthogonalThreshold: 5, enableOrthogonal: true,
    })
    expect(result.type).toBe('orthogonal')
    expect(result.position.y).toBeCloseTo(0)
    expect(result.position.x).toBeCloseTo(50)
  })

  it('snaps cursor to vertical axis of previous point', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [],
      previousPoint: { x: 0, y: 0 },
    }
    const result = findSnap({ x: 3, y: 50 }, ctx, {
      orthogonalThreshold: 5, enableOrthogonal: true,
    })
    expect(result.type).toBe('orthogonal')
    expect(result.position.x).toBeCloseTo(0)
    expect(result.position.y).toBeCloseTo(50)
  })

  it('does not snap when not near orthogonal axis', () => {
    const ctx: SnapContext = {
      vertices: [],
      segments: [],
      previousPoint: { x: 0, y: 0 },
    }
    const result = findSnap({ x: 30, y: 30 }, ctx, {
      orthogonalThreshold: 5, enableOrthogonal: true,
    })
    expect(result.type).not.toBe('orthogonal')
  })
})

// ── Free fall ─────────────────────────────────────────────────────────────────

describe('free (no snap)', () => {
  it('returns free type with original position when nothing snaps', () => {
    const ctx: SnapContext = { vertices: [], segments: [] }
    const pos = { x: 42, y: 99 }
    const result = findSnap(pos, ctx, {})
    expect(result.type).toBe('free')
    expect(result.position).toEqual(pos)
  })
})
