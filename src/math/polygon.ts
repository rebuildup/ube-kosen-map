/**
 * @module math/polygon
 * @description ポリゴン幾何学演算ライブラリ
 *
 * [P-6] Mathematical Abstraction: 幾何学的演算は純粋関数として分離する。
 * [P-1] Topology First: ポリゴン自己交差チェック・ノード内包判定は
 *        グラフ整合性バリデーション（SI-1, SI-3）の基盤となる。
 * すべての関数は副作用のない純粋関数として実装する。
 *
 * 座標系の定義:
 *   - X軸: 右方向が正
 *   - Y軸: 下方向が正（スクリーン座標系）
 *   - 頂点順序: 反時計回り（CCW）を正とする（計算上は signed area が正）
 *   - ただし DOM のY軸は反転しているため、符号付き面積の正負は通常のCCWと逆になる
 */

import type { Polygon, Vec2 } from './types'
import { cross, dot, lengthSq, lerp, nearestPointOnSegment, sub } from './vec2'

export type { Polygon }

/**
 * ポリゴンの符号付き面積を計算する（靴ひも公式 / Shoelace Formula）
 * @param polygon 対象のポリゴン
 * @returns 符号付き面積
 *
 * 数学的定義（Shoelace Formula）:
 *   A = (1/2) * Σ_i (x_i * y_{i+1} - x_{i+1} * y_i)
 *
 * 符号の意味（スクリーン座標系: Y軸下向き）:
 *   正 → 時計回り（CW）
 *   負 → 反時計回り（CCW）
 *
 * 注: 数学座標系（Y軸上向き）では符号が逆になる
 */
export function signedArea(polygon: Polygon): number {
  const verts = polygon.vertices
  const n = verts.length
  if (n < 3) return 0

  let sum = 0
  for (let i = 0; i < n; i++) {
    const curr = verts[i] as Vec2
    const next = verts[(i + 1) % n] as Vec2
    sum += curr.x * next.y - next.x * curr.y
  }
  return sum / 2
}

/**
 * ポリゴンの面積（絶対値）を計算する
 * @param polygon 対象のポリゴン
 * @returns 非負の面積値
 *
 * 数学的定義: |signedArea(polygon)|
 */
export function area(polygon: Polygon): number {
  return Math.abs(signedArea(polygon))
}

/**
 * ポリゴンの重心を計算する
 * @param polygon 対象のポリゴン（3頂点以上）
 * @returns 重心座標 Vec2
 *
 * 数学的定義（ポリゴン重心）:
 *   Cx = (1 / 6A) * Σ_i (x_i + x_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i)
 *   Cy = (1 / 6A) * Σ_i (y_i + y_{i+1}) * (x_i * y_{i+1} - x_{i+1} * y_i)
 *
 * 面積が 0 の場合（頂点が 3 未満または縮退ポリゴン）は頂点の算術平均を返す。
 */
export function centroid(polygon: Polygon): Vec2 {
  const verts = polygon.vertices
  const n = verts.length
  if (n === 0) return { x: 0, y: 0 }
  if (n < 3) {
    // 算術平均にフォールバック
    const sumX = verts.reduce((acc, v) => acc + v.x, 0)
    const sumY = verts.reduce((acc, v) => acc + v.y, 0)
    return { x: sumX / n, y: sumY / n }
  }

  const A = signedArea(polygon)
  if (Math.abs(A) < 1e-10) {
    // 縮退ポリゴン: 算術平均にフォールバック
    const sumX = verts.reduce((acc, v) => acc + v.x, 0)
    const sumY = verts.reduce((acc, v) => acc + v.y, 0)
    return { x: sumX / n, y: sumY / n }
  }

  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const curr = verts[i] as Vec2
    const next = verts[(i + 1) % n] as Vec2
    const factor = curr.x * next.y - next.x * curr.y
    cx += (curr.x + next.x) * factor
    cy += (curr.y + next.y) * factor
  }
  const factor6A = 6 * A
  return { x: cx / factor6A, y: cy / factor6A }
}

/**
 * 点がポリゴン内に含まれるかを判定する（Ray Casting アルゴリズム）
 * @param point 判定する点
 * @param polygon 対象のポリゴン
 * @returns 点がポリゴン内（境界を含む）にあれば true
 *
 * 数学的根拠（Ray Casting）:
 *   点から右方向に半直線を射出し、ポリゴンの辺と交差する回数が奇数なら内部。
 *   境界上の点は内部として扱う（nearestPointOnSegment でのスナップ判定）。
 *
 * 計算量: O(n) n = 頂点数
 */
export function containsPoint(polygon: Polygon, point: Vec2): boolean {
  const verts = polygon.vertices
  const n = verts.length
  if (n < 3) return false

  let inside = false
  const { x, y } = point

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = verts[i] as Vec2
    const vj = verts[j] as Vec2

    // 境界上の点の判定（辺との距離がほぼ 0）
    const ps = nearestPointOnSegment(point, vj, vi)
    const dSq = (ps.x - x) ** 2 + (ps.y - y) ** 2
    if (dSq < 1e-10) return true

    // Ray Casting: 水平レイとの交差判定
    const intersects =
      vi.y > y !== vj.y > y && x < ((vj.x - vi.x) * (y - vi.y)) / (vj.y - vi.y) + vi.x
    if (intersects) inside = !inside
  }

  return inside
}

/**
 * 2つの線分が交差するかを判定する
 * @param p1 線分1の始点
 * @param p2 線分1の終点
 * @param p3 線分2の始点
 * @param p4 線分2の終点
 * @returns 交差する場合は true
 *
 * 数学的根拠:
 *   線分1: P(s) = p1 + s*(p2-p1), s ∈ [0,1]
 *   線分2: Q(t) = p3 + t*(p4-p3), t ∈ [0,1]
 *   P(s) = Q(t) を解いて s, t ∈ [0,1] が存在するか確認。
 *   外積を用いた定式化を使用。
 *
 * 注: 端点での接触も交差として扱う。
 * 共線（collinear）かつ重複する場合も true を返す。
 */
export function segmentIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const r = sub(p2, p1)
  const s = sub(p4, p3)
  const rxs = cross(r, s)
  const qp = sub(p3, p1)
  const qpxr = cross(qp, r)

  if (Math.abs(rxs) < 1e-10) {
    // 平行 or 共線
    if (Math.abs(qpxr) > 1e-10) return false // 平行で非接触

    // 共線: 1次元的な重複チェック
    const rLenSq = lengthSq(r)
    if (rLenSq < 1e-10) {
      // r が点: p3-p4 の線分上に p1 があるか
      const qpDotS = dot(qp, s)
      const sLenSq = lengthSq(s)
      return qpDotS >= 0 && qpDotS <= sLenSq
    }
    const t0 = dot(qp, r) / rLenSq
    const t1 = t0 + dot(s, r) / rLenSq
    const tMin = Math.min(t0, t1)
    const tMax = Math.max(t0, t1)
    return tMax >= 0 && tMin <= 1
  }

  const t = cross(qp, s) / rxs
  const u = qpxr / rxs

  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/**
 * ポリゴンが自己交差しているかを判定する（SI-3 バリデーション用）
 * @param polygon 対象のポリゴン
 * @returns 自己交差があれば true
 *
 * 数学的根拠:
 *   全ての非隣接辺ペアについて segmentIntersection を確認する。
 *   隣接辺（共通端点を持つ辺）は除外する。
 *
 * 計算量: O(n²) n = 頂点数
 */
export function isSelfIntersecting(polygon: Polygon): boolean {
  const verts = polygon.vertices
  const n = verts.length
  if (n < 4) return false // 三角形は自己交差できない

  for (let i = 0; i < n; i++) {
    const p1 = verts[i] as Vec2
    const p2 = verts[(i + 1) % n] as Vec2

    for (let j = i + 2; j < n; j++) {
      // 最後の辺と最初の辺は隣接するためスキップ
      if (i === 0 && j === n - 1) continue

      const p3 = verts[j] as Vec2
      const p4 = verts[(j + 1) % n] as Vec2

      if (segmentIntersection(p1, p2, p3, p4)) {
        // 共通端点のみの接触（辺の連結）は除外
        const touchOnly =
          (p1.x === p3.x && p1.y === p3.y) ||
          (p1.x === p4.x && p1.y === p4.y) ||
          (p2.x === p3.x && p2.y === p3.y) ||
          (p2.x === p4.x && p2.y === p4.y)
        if (!touchOnly) return true
      }
    }
  }
  return false
}
