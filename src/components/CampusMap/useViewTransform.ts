/**
 * Hook: view transform state (zoom + pan) managed as a 3×3 affine matrix.
 *
 * [P-6] Mathematical Abstraction: zoom and pan are unified as matrix composition.
 */

import { useState, useCallback } from 'react'
import type { Mat3 } from '../../math'
import { identity, translate, scaling, multiply, transformPoint } from '../../math'

export interface ViewTransform {
  matrix: Mat3
  zoom: (factor: number, cx: number, cy: number) => void
  pan: (dx: number, dy: number) => void
  reset: () => void
}

/**
 * Compose a zoom centered on screen point (cx, cy):
 *   T_new = T(cx,cy) * S(factor) * T(-cx,-cy) * T_old
 */
const zoomAt = (m: Mat3, factor: number, cx: number, cy: number): Mat3 => {
  const toOrigin  = translate(-cx, -cy)
  const scale     = scaling(factor)
  const fromOrigin = translate(cx, cy)
  // Compute: fromOrigin * scale * toOrigin (applied before m)
  const zoomMat = multiply(fromOrigin, multiply(scale, toOrigin))
  return multiply(zoomMat, m)
}

export const useViewTransform = (minZoom = 0.1, maxZoom = 10): ViewTransform => {
  const [matrix, setMatrix] = useState<Mat3>(identity)

  const zoom = useCallback((factor: number, cx: number, cy: number) => {
    setMatrix(prev => {
      // Clamp: extract current scale from matrix (m00 is scaleX for uniform scale)
      const currentScale = prev.m00
      const clampedFactor = Math.min(
        Math.max(factor, minZoom / currentScale),
        maxZoom / currentScale,
      )
      return zoomAt(prev, clampedFactor, cx, cy)
    })
  }, [minZoom, maxZoom])

  const pan = useCallback((dx: number, dy: number) => {
    setMatrix(prev => multiply(translate(dx, dy), prev))
  }, [])

  const reset = useCallback(() => setMatrix(identity), [])

  return { matrix, zoom, pan, reset }
}

/**
 * Convert our Mat3 to a CSS/SVG matrix() string.
 * CSS matrix(a,b,c,d,e,f):
 *   a=scaleX (m00), b=skewY (m01), c=skewX (m10), d=scaleY (m11), e=tx (m20), f=ty (m21)
 */
export const matToTransform = (m: Mat3): string =>
  `matrix(${m.m00},${m.m01},${m.m10},${m.m11},${m.m20},${m.m21})`

/**
 * Transform a world-space Vec2 to screen-space using the current matrix.
 */
export { transformPoint }
