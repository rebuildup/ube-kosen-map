/**
 * @module math/vec2
 * @description 2Dベクトル演算ライブラリ
 *
 * [P-6] Mathematical Abstraction: 空間要素は数理モデルとして表現する。
 * すべての関数は副作用のない純粋関数として実装する。
 *
 * 数学的定義:
 *   Vec2 = (x, y) ∈ ℝ²
 */

import type { Vec2 } from './types'

export type { Vec2 }

/**
 * Vec2 を生成する
 * @param x x成分
 * @param y y成分
 * @returns Vec2
 *
 * @example
 * vec2(3, 4) // { x: 3, y: 4 }
 */
export function vec2(x: number, y: number): Vec2 {
  return { x, y }
}

/**
 * 加算: a + b
 * @param a 被加算ベクトル
 * @param b 加算ベクトル
 * @returns Vec2
 *
 * 数学的定義: (a.x + b.x, a.y + b.y)
 */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

/**
 * 減算: a - b
 * @param a 被減算ベクトル
 * @param b 減算ベクトル
 * @returns Vec2
 *
 * 数学的定義: (a.x - b.x, a.y - b.y)
 */
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

/**
 * スカラー倍: v * s
 * @param v ベクトル
 * @param s スカラー値
 * @returns Vec2
 *
 * 数学的定義: (v.x * s, v.y * s)
 */
export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s }
}

/**
 * 符号反転（ネゲート）: -v
 * @param v ベクトル
 * @returns Vec2
 *
 * 数学的定義: (-v.x, -v.y)
 */
export function negate(v: Vec2): Vec2 {
  return { x: -v.x || 0, y: -v.y || 0 }
}

/**
 * 内積: a · b
 * @param a ベクトル a
 * @param b ベクトル b
 * @returns スカラー値
 *
 * 数学的定義: a.x * b.x + a.y * b.y
 */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y
}

/**
 * 2D外積（スカラー値として返す）: a × b
 * @param a ベクトル a
 * @param b ベクトル b
 * @returns スカラー値（正: b は a の左側、負: b は a の右側）
 *
 * 数学的定義: a.x * b.y - a.y * b.x
 * 幾何学的意味: a と b の作る平行四辺形の符号付き面積
 */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x
}

/**
 * ベクトルの長さ（ユークリッドノルム）: |v|
 * @param v ベクトル
 * @returns 非負のスカラー値
 *
 * 数学的定義: √(v.x² + v.y²)
 */
export function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

/**
 * ベクトルの長さの2乗: |v|²
 * @param v ベクトル
 * @returns 非負のスカラー値（sqrt を避けてパフォーマンス向上）
 *
 * 数学的定義: v.x² + v.y²
 */
export function lengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y
}

/**
 * 正規化（単位ベクトル化）: v / |v|
 * @param v ゼロベクトル以外のベクトル
 * @returns 長さ 1 のベクトル。v がゼロベクトルの場合はゼロベクトルをそのまま返す
 *
 * 数学的定義: v / |v|  (|v| ≠ 0)
 */
export function normalize(v: Vec2): Vec2 {
  const len = length(v)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

/**
 * 2点間のユークリッド距離
 * @param a 点 a
 * @param b 点 b
 * @returns 非負のスカラー値
 *
 * 数学的定義: |a - b| = √((a.x-b.x)² + (a.y-b.y)²)
 */
export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b))
}

/**
 * 2点間の距離の2乗（sqrt 省略版）
 * @param a 点 a
 * @param b 点 b
 * @returns 非負のスカラー値
 */
export function distanceSq(a: Vec2, b: Vec2): number {
  return lengthSq(sub(a, b))
}

/**
 * 2ベクトルの等値比較（浮動小数点許容誤差あり）
 * @param a ベクトル a
 * @param b ベクトル b
 * @param epsilon 許容誤差（デフォルト: 1e-10）
 * @returns 等しければ true
 */
export function equals(a: Vec2, b: Vec2, epsilon = 1e-10): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon
}

/**
 * 線形補間（Lerp）: a + t * (b - a)
 * @param a 開始点
 * @param b 終了点
 * @param t 補間パラメータ（0.0 = a, 1.0 = b）
 * @returns 補間されたベクトル
 *
 * 数学的定義: (1-t) * a + t * b
 */
export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}

/**
 * 点から線分への最近点を求める
 * @param point 対象の点
 * @param segStart 線分の始点
 * @param segEnd 線分の終点
 * @returns 線分上の最近点（端点でクランプされる）
 *
 * 数学的根拠:
 *   線分を p(t) = segStart + t * (segEnd - segStart), t ∈ [0, 1] と定義し、
 *   (point - p(t)) · (segEnd - segStart) = 0 を満たす t を求め、[0,1] にクランプする。
 */
export function nearestPointOnSegment(point: Vec2, segStart: Vec2, segEnd: Vec2): Vec2 {
  const d = sub(segEnd, segStart)
  const lenSq = lengthSq(d)
  if (lenSq === 0) {
    // 線分が点に縮退している
    return { x: segStart.x, y: segStart.y }
  }
  const t = dot(sub(point, segStart), d) / lenSq
  const clamped = Math.max(0, Math.min(1, t))
  return lerp(segStart, segEnd, clamped)
}
