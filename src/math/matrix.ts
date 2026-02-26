/**
 * @module math/matrix
 * @description 3×3 アフィン変換行列ライブラリ（2D同次座標）
 *
 * [P-6] Mathematical Abstraction: 回転・スケール・移動は変換行列（アフィン変換）で統一的に処理する。
 * すべての関数は副作用のない純粋関数として実装する。
 *
 * 行列の表現（列優先 / column-major）:
 * ```
 * | m00  m10  m20 |   | a  c  tx |
 * | m01  m11  m21 | = | b  d  ty |
 * |  0    0    1  |   | 0  0   1 |
 * ```
 *
 * 同次座標での点ベクトル:
 * ```
 * | x' |   | m00 m10 m20 |   | x |
 * | y' | = | m01 m11 m21 | * | y |
 * | 1  |   |  0   0   1  |   | 1 |
 * ```
 */

import type { Mat3, Vec2 } from './types'

export type { Mat3 }

/**
 * 単位行列（恒等変換）
 * @returns Mat3
 *
 * 数学的定義:
 * ```
 * | 1 0 0 |
 * | 0 1 0 |
 * | 0 0 1 |
 * ```
 */
export function identity(): Mat3 {
  return {
    m00: 1,
    m10: 0,
    m20: 0,
    m01: 0,
    m11: 1,
    m21: 0,
  }
}

/**
 * 平行移動行列の生成
 * @param tx X方向の移動量
 * @param ty Y方向の移動量
 * @returns Mat3
 *
 * 数学的定義:
 * ```
 * | 1  0  tx |
 * | 0  1  ty |
 * | 0  0   1 |
 * ```
 */
export function translate(tx: number, ty: number): Mat3 {
  return {
    m00: 1,
    m10: 0,
    m20: tx,
    m01: 0,
    m11: 1,
    m21: ty,
  }
}

/**
 * 拡大縮小行列の生成
 * @param sx X方向のスケール係数
 * @param sy Y方向のスケール係数（省略時は sx と同値）
 * @returns Mat3
 *
 * 数学的定義:
 * ```
 * | sx  0  0 |
 * |  0 sy  0 |
 * |  0  0  1 |
 * ```
 */
export function scaling(sx: number, sy?: number): Mat3 {
  const sy_ = sy ?? sx
  return {
    m00: sx,
    m10: 0,
    m20: 0,
    m01: 0,
    m11: sy_,
    m21: 0,
  }
}

/**
 * 回転行列の生成（原点周り、反時計回りが正）
 * @param angle 回転角度（ラジアン）
 * @returns Mat3
 *
 * 数学的定義:
 * ```
 * | cos(θ)  -sin(θ)  0 |
 * | sin(θ)   cos(θ)  0 |
 * |    0        0    1 |
 * ```
 */
export function rotation(angle: number): Mat3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return {
    m00: c,
    m10: -s,
    m20: 0,
    m01: s,
    m11: c,
    m21: 0,
  }
}

/**
 * 行列の合成（乗算）: a * b
 * @param a 左辺行列（先に適用される変換）
 * @param b 右辺行列（後に適用される変換）
 * @returns Mat3
 *
 * 数学的定義（行列の積）:
 *   C = A * B
 *   C[i][j] = Σ_k A[i][k] * B[k][j]
 *
 * 注: 変換の適用順序は右から左。例: multiply(translate(10,0), rotation(π/4)) は
 *     「回転してから平行移動」を表す。
 */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  return {
    m00: a.m00 * b.m00 + a.m10 * b.m01,
    m10: a.m00 * b.m10 + a.m10 * b.m11,
    m20: a.m00 * b.m20 + a.m10 * b.m21 + a.m20,

    m01: a.m01 * b.m00 + a.m11 * b.m01,
    m11: a.m01 * b.m10 + a.m11 * b.m11,
    m21: a.m01 * b.m20 + a.m11 * b.m21 + a.m21,
  }
}

/**
 * 逆行列の計算
 * @param m 可逆な変換行列
 * @returns 逆行列 Mat3。行列式が 0 に近い（特異行列）場合は null を返す
 *
 * 2D アフィン変換行列（最終行が [0,0,1]）の逆行列:
 *   det = m00*m11 - m10*m01
 *   inv_a = m11/det,   inv_b = -m01/det
 *   inv_c = -m10/det,  inv_d = m00/det
 *   inv_tx = (m10*m21 - m11*m20)/det
 *   inv_ty = (m01*m20 - m00*m21)/det
 */
export function invert(m: Mat3): Mat3 | null {
  const det = m.m00 * m.m11 - m.m10 * m.m01
  if (Math.abs(det) < 1e-10) return null

  const invDet = 1 / det
  return {
    m00: m.m11 * invDet,
    m10: -m.m10 * invDet,
    m20: (m.m10 * m.m21 - m.m11 * m.m20) * invDet,

    m01: -m.m01 * invDet,
    m11: m.m00 * invDet,
    m21: (m.m01 * m.m20 - m.m00 * m.m21) * invDet,
  }
}

/**
 * 行列による点の変換: m * (v.x, v.y, 1)
 * @param m 変換行列
 * @param v 変換する点
 * @returns 変換後の点 Vec2
 *
 * 数学的定義（同次座標での行列・ベクトル積）:
 * ```
 * x' = m00 * x + m10 * y + m20
 * y' = m01 * x + m11 * y + m21
 * ```
 */
export function transformPoint(m: Mat3, v: Vec2): Vec2 {
  return {
    x: m.m00 * v.x + m.m10 * v.y + m.m20,
    y: m.m01 * v.x + m.m11 * v.y + m.m21,
  }
}

/**
 * 行列による方向ベクトルの変換（平行移動成分を無視）
 * @param m 変換行列
 * @param v 変換する方向ベクトル
 * @returns 変換後の方向ベクトル Vec2
 *
 * 数学的定義: 同次座標で w=0 の場合
 * ```
 * x' = m00 * x + m10 * y
 * y' = m01 * x + m11 * y
 * ```
 */
export function transformDirection(m: Mat3, v: Vec2): Vec2 {
  return {
    x: m.m00 * v.x + m.m10 * v.y,
    y: m.m01 * v.x + m.m11 * v.y,
  }
}
