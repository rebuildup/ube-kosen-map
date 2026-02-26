/**
 * @file polygon.test.ts
 * @description ポリゴン幾何学演算ライブラリのユニットテスト
 *
 * [P-1] Topology First: SI-1/SI-3 バリデーションの基盤となる関数の正確さを確認する。
 * [P-6] Mathematical Abstraction: 幾何学演算の数学的正しさを確認する。
 * エッジケース（縮退ポリゴン、境界上の点、etc.）を含む。
 */

import { describe, expect, it } from 'vitest'
import {
  area,
  centroid,
  containsPoint,
  isSelfIntersecting,
  segmentIntersection,
  signedArea,
} from './polygon'
import type { Polygon, Vec2 } from './types'

// テスト用のポリゴン定義
const square: Polygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ],
}

const triangle: Polygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 3, y: 4 },
  ],
}

// 自己交差ポリゴン（蝶形、"8"の字）
const selfIntersecting: Polygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4, y: 4 },
    { x: 4, y: 0 },
    { x: 0, y: 4 },
  ],
}

describe('signedArea', () => {
  it('should compute signed area of a square (CW in screen coords)', () => {
    // 頂点が CW (スクリーン座標Y下向き) ならば正
    // square は ((0,0),(4,0),(4,4),(0,4)) → 面積 = 16
    expect(Math.abs(signedArea(square))).toBeCloseTo(16)
  })

  it('should return 0 for degenerate polygon (< 3 vertices)', () => {
    expect(
      signedArea({
        vertices: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      })
    ).toBe(0)
  })

  it('should return 0 for empty polygon', () => {
    expect(signedArea({ vertices: [] })).toBe(0)
  })

  it('signed area should change sign when vertex order is reversed', () => {
    const ccw: Polygon = { vertices: [...square.vertices].reverse() }
    expect(Math.sign(signedArea(square))).toBe(-Math.sign(signedArea(ccw)))
  })
})

describe('area', () => {
  it('should compute area of a 4x4 square', () => {
    expect(area(square)).toBeCloseTo(16)
  })

  it('should compute area of a triangle', () => {
    // 底辺 6, 高さ 4 → 面積 = (6*4)/2 = 12
    expect(area(triangle)).toBeCloseTo(12)
  })

  it('should return 0 for degenerate polygon', () => {
    expect(area({ vertices: [{ x: 0, y: 0 }] })).toBe(0)
  })

  it('area should be the same regardless of vertex winding order', () => {
    const reversed: Polygon = { vertices: [...square.vertices].reverse() }
    expect(area(square)).toBeCloseTo(area(reversed))
  })
})

describe('centroid', () => {
  it('should compute centroid of a square (center)', () => {
    const c = centroid(square)
    expect(c.x).toBeCloseTo(2)
    expect(c.y).toBeCloseTo(2)
  })

  it('should compute centroid of a triangle', () => {
    // 三角形の重心 = 頂点の算術平均
    // (0+6+3)/3 = 3, (0+0+4)/3 ≈ 1.333
    const c = centroid(triangle)
    expect(c.x).toBeCloseTo(3)
    expect(c.y).toBeCloseTo(4 / 3)
  })

  it('should return arithmetic mean for degenerate polygon (< 3 vertices)', () => {
    const twoVerts: Polygon = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 6 },
      ],
    }
    const c = centroid(twoVerts)
    expect(c.x).toBeCloseTo(2)
    expect(c.y).toBeCloseTo(3)
  })

  it('should return (0,0) for empty polygon', () => {
    const c = centroid({ vertices: [] })
    expect(c.x).toBe(0)
    expect(c.y).toBe(0)
  })
})

describe('containsPoint', () => {
  describe('square (0,0)-(4,4)', () => {
    it('should contain interior point', () => {
      expect(containsPoint(square, { x: 2, y: 2 })).toBe(true)
    })

    it('should contain corner point (boundary)', () => {
      expect(containsPoint(square, { x: 0, y: 0 })).toBe(true)
    })

    it('should contain edge midpoint (boundary)', () => {
      expect(containsPoint(square, { x: 2, y: 0 })).toBe(true)
    })

    it('should NOT contain exterior point', () => {
      expect(containsPoint(square, { x: 5, y: 2 })).toBe(false)
    })

    it('should NOT contain point outside by small margin', () => {
      expect(containsPoint(square, { x: 4.001, y: 2 })).toBe(false)
    })

    it('should contain point near border but inside', () => {
      expect(containsPoint(square, { x: 3.999, y: 2 })).toBe(true)
    })
  })

  describe('triangle (0,0)-(6,0)-(3,4)', () => {
    it('should contain interior centroid', () => {
      expect(containsPoint(triangle, { x: 3, y: 1 })).toBe(true)
    })

    it('should NOT contain vertex of another triangle outside', () => {
      expect(containsPoint(triangle, { x: 0, y: 4 })).toBe(false)
    })

    it('should NOT contain points outside', () => {
      expect(containsPoint(triangle, { x: 6, y: 4 })).toBe(false)
    })
  })

  it('should return false for degenerate polygon (< 3 vertices)', () => {
    const line: Polygon = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    }
    expect(containsPoint(line, { x: 2, y: 0 })).toBe(false)
  })
})

describe('segmentIntersection', () => {
  it('should detect crossing segments', () => {
    // (+) 字型の交差
    expect(
      segmentIntersection({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 })
    ).toBe(true)
  })

  it('should return false for parallel non-overlapping segments', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 })
    ).toBe(false)
  })

  it('should return false for collinear non-overlapping segments', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 })
    ).toBe(false)
  })

  it('should return true for collinear overlapping segments', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 })
    ).toBe(true)
  })

  it('should detect T-intersection (endpoint touching)', () => {
    // 一方の端点が他方の辺上にある
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 4 })
    ).toBe(true)
  })

  it('should return false when segments almost intersect but do not', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 })
    ).toBe(false)
  })

  it('should detect diagonal cross', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 0, y: 4 })
    ).toBe(true)
  })
})

describe('isSelfIntersecting', () => {
  it('should return false for a convex square', () => {
    expect(isSelfIntersecting(square)).toBe(false)
  })

  it('should return false for a triangle', () => {
    expect(isSelfIntersecting(triangle)).toBe(false)
  })

  it('should return true for a butterfly (figure-8) polygon', () => {
    // （0,0）→（4,4）→（4,0）→（0,4）の蝶形
    expect(isSelfIntersecting(selfIntersecting)).toBe(true)
  })

  it('should return false for a concave (L-shaped) polygon without self-intersection', () => {
    const lShape: Polygon = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 0, y: 4 },
      ],
    }
    expect(isSelfIntersecting(lShape)).toBe(false)
  })

  it('should return false for polygon with < 4 vertices (triangle cannot self-intersect)', () => {
    expect(isSelfIntersecting(triangle)).toBe(false)
  })

  it('should return false for empty polygon', () => {
    expect(isSelfIntersecting({ vertices: [] })).toBe(false)
  })
})
