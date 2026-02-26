/**
 * @file matrix.test.ts
 * @description 3×3 アフィン変換行列ライブラリのユニットテスト
 *
 * [P-6] 変換行列演算が数学的に正しいことを確認する。
 * エッジケース（特異行列、ゼロ回転、etc.）を含む。
 */

import { describe, expect, it } from 'vitest'
import {
  identity,
  invert,
  multiply,
  rotation,
  scaling,
  transformDirection,
  transformPoint,
  translate,
} from './matrix'
import type { Mat3 } from './types'

/** 行列の各要素を近似比較するヘルパー */
function matCloseTo(a: Mat3, b: Mat3, precision = 10): void {
  expect(a.m00).toBeCloseTo(b.m00, precision)
  expect(a.m10).toBeCloseTo(b.m10, precision)
  expect(a.m20).toBeCloseTo(b.m20, precision)
  expect(a.m01).toBeCloseTo(b.m01, precision)
  expect(a.m11).toBeCloseTo(b.m11, precision)
  expect(a.m21).toBeCloseTo(b.m21, precision)
}

/** null チェック付きで逆行列を取得するヘルパー */
function invertOrFail(m: Mat3): Mat3 {
  const result = invert(m)
  if (result === null) throw new Error('Expected non-null inverse matrix')
  return result
}

describe('identity', () => {
  it('should return the identity matrix', () => {
    const m = identity()
    expect(m.m00).toBe(1)
    expect(m.m10).toBe(0)
    expect(m.m20).toBe(0)
    expect(m.m01).toBe(0)
    expect(m.m11).toBe(1)
    expect(m.m21).toBe(0)
  })

  it('identity matrix should not change a point when transforming', () => {
    const m = identity()
    const p = transformPoint(m, { x: 5, y: 7 })
    expect(p.x).toBeCloseTo(5)
    expect(p.y).toBeCloseTo(7)
  })
})

describe('translate', () => {
  it('should create a translation matrix', () => {
    const m = translate(10, 20)
    expect(m.m20).toBe(10)
    expect(m.m21).toBe(20)
    expect(m.m00).toBe(1)
    expect(m.m11).toBe(1)
  })

  it('should translate a point correctly', () => {
    const m = translate(5, -3)
    const p = transformPoint(m, { x: 1, y: 2 })
    expect(p.x).toBeCloseTo(6)
    expect(p.y).toBeCloseTo(-1)
  })

  it('translate(0, 0) should be the identity', () => {
    matCloseTo(translate(0, 0), identity())
  })
})

describe('scaling', () => {
  it('should create a uniform scale matrix', () => {
    const m = scaling(2)
    expect(m.m00).toBe(2)
    expect(m.m11).toBe(2)
    expect(m.m10).toBe(0)
    expect(m.m01).toBe(0)
  })

  it('should create a non-uniform scale matrix', () => {
    const m = scaling(3, 4)
    expect(m.m00).toBe(3)
    expect(m.m11).toBe(4)
  })

  it('should scale a point correctly', () => {
    const m = scaling(2, 3)
    const p = transformPoint(m, { x: 4, y: 5 })
    expect(p.x).toBeCloseTo(8)
    expect(p.y).toBeCloseTo(15)
  })

  it('scaling(1) should be the identity', () => {
    matCloseTo(scaling(1), identity())
  })
})

describe('rotation', () => {
  it('should rotate a point 90 degrees counter-clockwise', () => {
    // スクリーン座標系（Y下向き）では rotation(π/2) は CW方向だが内部計算は正しい
    const m = rotation(Math.PI / 2)
    const p = transformPoint(m, { x: 1, y: 0 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(1)
  })

  it('should rotate a point 180 degrees', () => {
    const m = rotation(Math.PI)
    const p = transformPoint(m, { x: 1, y: 0 })
    expect(p.x).toBeCloseTo(-1)
    expect(p.y).toBeCloseTo(0)
  })

  it('rotation(0) should be the identity', () => {
    matCloseTo(rotation(0), identity())
  })

  it('rotation(2π) should be the identity', () => {
    matCloseTo(rotation(2 * Math.PI), identity())
  })

  it('rotation(θ) followed by rotation(-θ) should cancel out', () => {
    const angle = Math.PI / 6
    const combined = multiply(rotation(-angle), rotation(angle))
    matCloseTo(combined, identity())
  })
})

describe('multiply', () => {
  it('multiplying with identity should return the same matrix', () => {
    const m = translate(5, 10)
    matCloseTo(multiply(m, identity()), m)
    matCloseTo(multiply(identity(), m), m)
  })

  it('should compose translate and scale correctly', () => {
    // scale(2) then translate(10, 0) → 点 (1,0) は (1*2+10, 0) = (12, 0)
    // translate は scale 後に適用される（右から掛ける）
    const scaleM = scaling(2)
    const transM = translate(10, 0)
    const combined = multiply(transM, scaleM) // translate after scale
    const p = transformPoint(combined, { x: 1, y: 0 })
    expect(p.x).toBeCloseTo(12)
    expect(p.y).toBeCloseTo(0)
  })

  it('should compose rotations additively', () => {
    const rot45 = rotation(Math.PI / 4)
    const rot90 = rotation(Math.PI / 2)
    // rot45 * rot45 = rot90
    matCloseTo(multiply(rot45, rot45), rot90)
  })
})

describe('invert', () => {
  it('should return identity for identity matrix', () => {
    const inv = invert(identity())
    expect(inv).not.toBeNull()
    // invertOrFail で安全にアクセス
    const safeInv = invertOrFail(identity())
    // matCloseTo は toBeCloseTo を使うため -0 vs 0 の問題を回避
    matCloseTo(safeInv, identity())
    // 実際に点を変換して確認（実用的な検証）
    const p = transformPoint(safeInv, { x: 3, y: 7 })
    expect(p.x).toBeCloseTo(3)
    expect(p.y).toBeCloseTo(7)
  })

  it('should return null for singular matrix', () => {
    // ゼロスケール行列は特異
    expect(invert(scaling(0))).toBeNull()
  })

  it('inverse of translate(tx, ty) should be translate(-tx, -ty)', () => {
    const inv = invertOrFail(translate(5, -3))
    matCloseTo(inv, translate(-5, 3))
  })

  it('m * invert(m) should equal identity', () => {
    const m = multiply(multiply(translate(3, -2), rotation(Math.PI / 3)), scaling(2))
    const inv = invertOrFail(m)
    matCloseTo(multiply(m, inv), identity())
  })
})

describe('transformPoint', () => {
  it('should apply translation', () => {
    const p = transformPoint(translate(10, -5), { x: 2, y: 3 })
    expect(p.x).toBeCloseTo(12)
    expect(p.y).toBeCloseTo(-2)
  })

  it('should apply rotation', () => {
    const p = transformPoint(rotation(Math.PI), { x: 1, y: 0 })
    expect(p.x).toBeCloseTo(-1)
    expect(p.y).toBeCloseTo(0)
  })

  it('should apply combined transform', () => {
    // translate(5, 0) after scale(2): point (1,0) → scale→(2,0), translate→(7,0)
    const m = multiply(translate(5, 0), scaling(2))
    const p = transformPoint(m, { x: 1, y: 0 })
    expect(p.x).toBeCloseTo(7)
    expect(p.y).toBeCloseTo(0)
  })
})

describe('transformDirection', () => {
  it('should apply rotation but ignore translation', () => {
    const m = multiply(translate(100, 100), rotation(Math.PI / 2))
    const v = transformDirection(m, { x: 1, y: 0 })
    // 回転は適用されるが平行移動は無視
    expect(v.x).toBeCloseTo(0)
    expect(v.y).toBeCloseTo(1)
  })
})
