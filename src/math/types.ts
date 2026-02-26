/**
 * @module math/types
 * @description 数理ライブラリの基本型定義
 *
 * [P-6] Mathematical Abstraction: 空間要素は数理モデルとして表現する。
 * graph-schema.md の Vec2, Vec3, Polygon 定義に準拠する。
 */

/** 2Dベクトル（平面図上の座標） */
export interface Vec2 {
  readonly x: number
  readonly y: number
}

/** 3Dベクトル（フロア高さを含む空間座標） */
export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * 3×3 アフィン変換行列（列優先）
 *
 * ```
 * | m00  m10  m20 |   | a  c  e |
 * | m01  m11  m21 | = | b  d  f |
 * |  0    0    1  |   | 0  0  1 |
 * ```
 *
 * 2D同次座標系での表現:
 *   m00, m01: X軸の向き（回転・スケール）
 *   m10, m11: Y軸の向き（回転・スケール）
 *   m20, m21: 平行移動量（tx, ty）
 */
export interface Mat3 {
  readonly m00: number
  readonly m10: number
  readonly m20: number
  readonly m01: number
  readonly m11: number
  readonly m21: number
  //            0                    0                    1   (暗黙の第3行)
}

/** ポリゴン（頂点列で定義される閉じた多角形） */
export interface Polygon {
  /** 頂点配列（順序は統一: 反時計回りを正とする） */
  readonly vertices: readonly Vec2[]
}
