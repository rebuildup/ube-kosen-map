/**
 * @module math
 * @description 数理ライブラリ: Vec2 / 変換行列 / ポリゴン演算
 *
 * [P-6] Mathematical Abstraction: 空間要素は数理モデルとして表現する。
 *
 * すべての関数は副作用のない純粋関数として実装されている。
 *
 * @example
 * ```typescript
 * import { vec2, add, distance } from './math'
 * import { identity, translate, transformPoint } from './math'
 * import { area, centroid, containsPoint } from './math'
 * ```
 */

// 型定義
export type { Vec2, Vec3, Mat3, Polygon } from './types'

// Vec2 演算
export {
  vec2,
  add,
  sub,
  scale,
  negate,
  dot,
  cross,
  length,
  lengthSq,
  normalize,
  distance,
  distanceSq,
  equals,
  lerp,
  nearestPointOnSegment,
} from './vec2'

// アフィン変換行列（3×3）
export {
  identity,
  translate,
  scaling,
  rotation,
  multiply,
  invert,
  transformPoint,
  transformDirection,
} from './matrix'

// ポリゴン幾何学演算
export {
  signedArea,
  area,
  centroid,
  containsPoint,
  segmentIntersection,
  isSelfIntersecting,
} from './polygon'
