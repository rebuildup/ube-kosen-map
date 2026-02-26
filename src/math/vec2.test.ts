/**
 * @file vec2.test.ts
 * @description Vec2 演算ライブラリのユニットテスト
 *
 * [P-6] 全関数が純粋関数として実装されていることを確認する。
 * エッジケース（ゼロベクトル、負値、浮動小数点精度）を含む。
 */

import { describe, expect, it } from 'vitest'
import {
  add,
  cross,
  distance,
  distanceSq,
  dot,
  equals,
  length,
  lengthSq,
  lerp,
  nearestPointOnSegment,
  negate,
  normalize,
  scale,
  sub,
  vec2,
} from './vec2'

describe('vec2', () => {
  it('should create a Vec2 with given x and y', () => {
    const v = vec2(3, 4)
    expect(v.x).toBe(3)
    expect(v.y).toBe(4)
  })

  it('should create a Vec2 with negative values', () => {
    const v = vec2(-1, -2)
    expect(v.x).toBe(-1)
    expect(v.y).toBe(-2)
  })

  it('should create a zero vector', () => {
    const v = vec2(0, 0)
    expect(v.x).toBe(0)
    expect(v.y).toBe(0)
  })
})

describe('add', () => {
  it('should add two vectors', () => {
    expect(add(vec2(1, 2), vec2(3, 4))).toEqual({ x: 4, y: 6 })
  })

  it('should handle zero vector', () => {
    const v = vec2(5, -3)
    expect(add(v, vec2(0, 0))).toEqual(v)
  })

  it('should handle negative values', () => {
    expect(add(vec2(-1, -2), vec2(-3, -4))).toEqual({ x: -4, y: -6 })
  })
})

describe('sub', () => {
  it('should subtract two vectors', () => {
    expect(sub(vec2(5, 7), vec2(2, 3))).toEqual({ x: 3, y: 4 })
  })

  it('should return zero vector when subtracting self', () => {
    const v = vec2(3, 4)
    expect(sub(v, v)).toEqual({ x: 0, y: 0 })
  })

  it('should handle negative results', () => {
    expect(sub(vec2(1, 1), vec2(3, 4))).toEqual({ x: -2, y: -3 })
  })
})

describe('scale', () => {
  it('should scale a vector by a scalar', () => {
    expect(scale(vec2(2, 3), 4)).toEqual({ x: 8, y: 12 })
  })

  it('should scale by zero to produce zero vector', () => {
    expect(scale(vec2(5, 7), 0)).toEqual({ x: 0, y: 0 })
  })

  it('should scale by negative scalar', () => {
    expect(scale(vec2(2, -3), -1)).toEqual({ x: -2, y: 3 })
  })

  it('should scale by fractional scalar', () => {
    const result = scale(vec2(4, 6), 0.5)
    expect(result.x).toBeCloseTo(2)
    expect(result.y).toBeCloseTo(3)
  })
})

describe('negate', () => {
  it('should negate a vector', () => {
    expect(negate(vec2(3, -4))).toEqual({ x: -3, y: 4 })
  })

  it('should return zero vector when negating zero vector', () => {
    const result = negate(vec2(0, 0))
    // -0 と +0 は数学的に等価なため toBeCloseTo で比較
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
  })

  it('double negation should return original', () => {
    const v = vec2(5, -7)
    const result = negate(negate(v))
    expect(result.x).toBeCloseTo(v.x)
    expect(result.y).toBeCloseTo(v.y)
  })
})

describe('dot', () => {
  it('should compute dot product of two vectors', () => {
    // (1,2)·(3,4) = 3+8 = 11
    expect(dot(vec2(1, 2), vec2(3, 4))).toBe(11)
  })

  it('should return 0 for perpendicular vectors', () => {
    // (1,0)·(0,1) = 0
    expect(dot(vec2(1, 0), vec2(0, 1))).toBe(0)
  })

  it('should return squared length when dotting with itself', () => {
    const v = vec2(3, 4)
    expect(dot(v, v)).toBe(25) // 3²+4² = 25
  })
})

describe('cross', () => {
  it('should compute 2D cross product', () => {
    // (1,0)×(0,1) = 1*1 - 0*0 = 1
    expect(cross(vec2(1, 0), vec2(0, 1))).toBe(1)
  })

  it('should return 0 for parallel vectors', () => {
    expect(cross(vec2(2, 0), vec2(4, 0))).toBe(0)
  })

  it('should be anti-commutative: cross(a,b) = -cross(b,a)', () => {
    const a = vec2(3, 2)
    const b = vec2(1, 4)
    expect(cross(a, b)).toBe(-cross(b, a))
  })
})

describe('length', () => {
  it('should compute the length of a vector', () => {
    // 3-4-5 triangle
    expect(length(vec2(3, 4))).toBe(5)
  })

  it('should return 0 for the zero vector', () => {
    expect(length(vec2(0, 0))).toBe(0)
  })

  it('should return 1 for unit vectors', () => {
    expect(length(vec2(1, 0))).toBe(1)
    expect(length(vec2(0, 1))).toBe(1)
  })
})

describe('lengthSq', () => {
  it('should compute the squared length', () => {
    expect(lengthSq(vec2(3, 4))).toBe(25)
  })

  it('should return 0 for zero vector', () => {
    expect(lengthSq(vec2(0, 0))).toBe(0)
  })
})

describe('normalize', () => {
  it('should normalize a vector to unit length', () => {
    const result = normalize(vec2(3, 4))
    expect(result.x).toBeCloseTo(0.6)
    expect(result.y).toBeCloseTo(0.8)
    expect(length(result)).toBeCloseTo(1)
  })

  it('should return zero vector when normalizing zero vector', () => {
    expect(normalize(vec2(0, 0))).toEqual({ x: 0, y: 0 })
  })

  it('should return the same unit vector when already normalized', () => {
    const result = normalize(vec2(1, 0))
    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(0)
  })
})

describe('distance', () => {
  it('should compute Euclidean distance between two points', () => {
    expect(distance(vec2(0, 0), vec2(3, 4))).toBe(5)
  })

  it('should return 0 for the same point', () => {
    const p = vec2(5, 7)
    expect(distance(p, p)).toBe(0)
  })

  it('should be symmetric: dist(a,b) === dist(b,a)', () => {
    const a = vec2(1, 2)
    const b = vec2(4, 6)
    expect(distance(a, b)).toBeCloseTo(distance(b, a))
  })
})

describe('distanceSq', () => {
  it('should compute squared distance', () => {
    expect(distanceSq(vec2(0, 0), vec2(3, 4))).toBe(25)
  })
})

describe('equals', () => {
  it('should return true for equal vectors', () => {
    expect(equals(vec2(1, 2), vec2(1, 2))).toBe(true)
  })

  it('should return false for different vectors', () => {
    expect(equals(vec2(1, 2), vec2(1, 3))).toBe(false)
  })

  it('should handle floating point precision with default epsilon', () => {
    const a = vec2(0.1 + 0.2, 0)
    const b = vec2(0.3, 0)
    expect(equals(a, b)).toBe(true)
  })

  it('should use custom epsilon', () => {
    expect(equals(vec2(0, 0), vec2(0.5, 0), 0.6)).toBe(true)
    expect(equals(vec2(0, 0), vec2(0.5, 0), 0.4)).toBe(false)
  })
})

describe('lerp', () => {
  it('should return start point when t=0', () => {
    const a = vec2(0, 0)
    const b = vec2(10, 20)
    expect(lerp(a, b, 0)).toEqual({ x: 0, y: 0 })
  })

  it('should return end point when t=1', () => {
    const a = vec2(0, 0)
    const b = vec2(10, 20)
    expect(lerp(a, b, 1)).toEqual({ x: 10, y: 20 })
  })

  it('should return midpoint when t=0.5', () => {
    const result = lerp(vec2(0, 0), vec2(10, 20), 0.5)
    expect(result.x).toBeCloseTo(5)
    expect(result.y).toBeCloseTo(10)
  })

  it('should extrapolate when t > 1', () => {
    const result = lerp(vec2(0, 0), vec2(10, 0), 2)
    expect(result.x).toBeCloseTo(20)
  })
})

describe('nearestPointOnSegment', () => {
  it('should return foot of perpendicular for interior projection', () => {
    // 点 (0, 1) から線分 (-2,0)-(2,0) への最近点は (0,0)
    const p = nearestPointOnSegment(vec2(0, 1), vec2(-2, 0), vec2(2, 0))
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('should clamp to start point when foot is before segment', () => {
    // 点 (-5, 0) から線分 (0,0)-(4,0) への最近点は (0,0)
    const p = nearestPointOnSegment(vec2(-5, 0), vec2(0, 0), vec2(4, 0))
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('should clamp to end point when foot is beyond segment', () => {
    // 点 (10, 0) から線分 (0,0)-(4,0) への最近点は (4,0)
    const p = nearestPointOnSegment(vec2(10, 0), vec2(0, 0), vec2(4, 0))
    expect(p.x).toBeCloseTo(4)
    expect(p.y).toBeCloseTo(0)
  })

  it('should return the degenerate segment point when segment has zero length', () => {
    const p = nearestPointOnSegment(vec2(5, 5), vec2(1, 1), vec2(1, 1))
    expect(p.x).toBeCloseTo(1)
    expect(p.y).toBeCloseTo(1)
  })

  it('should return the point itself when the point is on the segment', () => {
    const p = nearestPointOnSegment(vec2(2, 0), vec2(0, 0), vec2(4, 0))
    expect(p.x).toBeCloseTo(2)
    expect(p.y).toBeCloseTo(0)
  })
})
