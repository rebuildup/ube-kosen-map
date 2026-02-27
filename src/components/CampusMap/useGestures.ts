/**
 * useGestures — Gesture math utilities and double-tap state machine.
 *
 * Pure functions for pinch, rotation, and double-tap are exported so they
 * can be unit-tested independently of React/DOM event handling.
 *
 * [P-6] Mathematical Abstraction: all gestures are expressed as matrix
 *   transformations (zoom, rotate, pan) unified in a single Mat3.
 */

import { useRef, useCallback, useState } from 'react'
import type { Mat3 } from '../../math'
import { multiply, translate, scaling, rotation } from '../../math'

export type DoubleTapState = 'normal' | 'zoom1' | 'zoom2' | 'fullscreen'

// ── Pure math helpers ─────────────────────────────────────────────────────────

interface Point { x: number; y: number }

/** Euclidean distance between two points */
const dist = (a: Point, b: Point): number =>
  Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

/** Midpoint of two points */
const mid = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

/**
 * Compute pinch center (midpoint of current fingers) and
 * scale factor (ratio of current to previous finger distance).
 */
export const getPinchCenterAndScale = (
  prevA: Point, prevB: Point,
  currA: Point, currB: Point,
): { center: Point; scaleFactor: number } => {
  const prevDist = dist(prevA, prevB)
  const currDist = dist(currA, currB)
  const scaleFactor = prevDist > 0 ? currDist / prevDist : 1
  return { center: mid(currA, currB), scaleFactor }
}

/**
 * Compute the rotation angle (radians) between two finger configurations.
 * Positive = clockwise (in screen coordinates where Y grows downward).
 */
export const getTwoFingerRotation = (
  prevA: Point, prevB: Point,
  currA: Point, currB: Point,
): number => {
  const prevAngle = Math.atan2(prevB.y - prevA.y, prevB.x - prevA.x)
  const currAngle = Math.atan2(currB.y - currA.y, currB.x - currA.x)
  return currAngle - prevAngle
}

/**
 * Double-tap state machine transitions.
 * normal → zoom1 → zoom2 → fullscreen → normal → …
 */
export const getDoubleTapNextState = (current: DoubleTapState): DoubleTapState => {
  switch (current) {
    case 'normal':     return 'zoom1'
    case 'zoom1':      return 'zoom2'
    case 'zoom2':      return 'fullscreen'
    case 'fullscreen': return 'normal'
  }
}

/** Zoom factors for each double-tap state */
const DOUBLE_TAP_SCALE: Record<DoubleTapState, number> = {
  normal:     1.0,
  zoom1:      2.0,
  zoom2:      4.0,
  fullscreen: 1.0, // handled separately via Fullscreen API
}

// ── Rotation at point ─────────────────────────────────────────────────────────

/** Compose a rotation centered on screen point (cx, cy) into the view matrix */
const rotateAt = (m: Mat3, angle: number, cx: number, cy: number): Mat3 => {
  const toOrigin   = translate(-cx, -cy)
  const rot        = rotation(angle)
  const fromOrigin = translate(cx, cy)
  return multiply(multiply(multiply(fromOrigin, rot), toOrigin), m)
}

/** Compose a zoom centered on screen point (cx, cy) into the view matrix */
const zoomAt = (m: Mat3, factor: number, cx: number, cy: number): Mat3 => {
  const toOrigin   = translate(-cx, -cy)
  const s          = scaling(factor)
  const fromOrigin = translate(cx, cy)
  return multiply(multiply(multiply(fromOrigin, s), toOrigin), m)
}

// ── React hook: gesture state ─────────────────────────────────────────────────

export interface GestureHandlers {
  onWheel:     (e: React.WheelEvent)      => void
  onMouseDown: (e: React.MouseEvent)      => void
  onMouseMove: (e: React.MouseEvent)      => void
  onMouseUp:   (e: React.MouseEvent)      => void
  onMouseLeave:(e: React.MouseEvent)      => void
  onTouchStart:(e: React.TouchEvent)      => void
  onTouchMove: (e: React.TouchEvent)      => void
  onTouchEnd:  (e: React.TouchEvent)      => void
  onDoubleClick:(e: React.MouseEvent)     => void
}

interface MouseState {
  isDown: boolean
  isShift: boolean
  lastX: number
  lastY: number
  startX: number
  startY: number
}

interface TouchState {
  prevA: Point | null
  prevB: Point | null
}

export const useGestures = (
  matrix: Mat3,
  setMatrix: (m: Mat3 | ((prev: Mat3) => Mat3)) => void,
  minZoom = 0.1,
  maxZoom = 10,
): GestureHandlers & { doubleTapState: DoubleTapState } => {
  const mouse = useRef<MouseState>({ isDown: false, isShift: false, lastX: 0, lastY: 0, startX: 0, startY: 0 })
  const touch = useRef<TouchState>({ prevA: null, prevB: null })
  const [doubleTapState, setDoubleTapState] = useState<DoubleTapState>('normal')

  const clampScale = (m: Mat3, newM: Mat3): Mat3 => {
    const s = Math.abs(newM.m00)
    if (s < minZoom || s > maxZoom) return m
    return newM
  }

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setMatrix(prev => clampScale(prev, zoomAt(prev, factor, cx, cy)))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isMiddleDrag = e.button === 1
    const isRotateDrag = e.button === 0 && e.shiftKey
    if (!isMiddleDrag && !isRotateDrag) {
      mouse.current.isDown = false
      return
    }
    mouse.current = { isDown: true, isShift: e.shiftKey, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const m = mouse.current
    if (!m.isDown) return
    const dx = e.clientX - m.lastX
    const dy = e.clientY - m.lastY
    mouse.current.lastX = e.clientX
    mouse.current.lastY = e.clientY

    if (m.isShift) {
      // Rotation around the drag-start point
      const angle = dx * 0.005
      setMatrix(prev => rotateAt(prev, angle, m.startX, m.startY))
    } else {
      setMatrix(prev => multiply(translate(dx, dy), prev))
    }
  }, [])

  const onMouseUp  = useCallback(() => { mouse.current.isDown = false }, [])
  const onMouseLeave = useCallback(() => { mouse.current.isDown = false }, [])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      if (!t0 || !t1) return
      touch.current.prevA = { x: t0.clientX, y: t0.clientY }
      touch.current.prevB = { x: t1.clientX, y: t1.clientY }
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return
    const t = touch.current
    if (!t.prevA || !t.prevB) return

    const t0 = e.touches[0]
    const t1 = e.touches[1]
    if (!t0 || !t1) return
    const currA: Point = { x: t0.clientX, y: t0.clientY }
    const currB: Point = { x: t1.clientX, y: t1.clientY }

    const { center, scaleFactor } = getPinchCenterAndScale(t.prevA, t.prevB, currA, currB)
    const rotDelta = getTwoFingerRotation(t.prevA, t.prevB, currA, currB)

    setMatrix(prev => {
      let m = zoomAt(prev, scaleFactor, center.x, center.y)
      m = clampScale(prev, m)
      m = rotateAt(m, rotDelta, center.x, center.y)
      return m
    })

    touch.current.prevA = currA
    touch.current.prevB = currB
  }, [])

  const onTouchEnd = useCallback(() => {
    touch.current.prevA = null
    touch.current.prevB = null
  }, [])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    setDoubleTapState(prev => {
      const next = getDoubleTapNextState(prev)
      if (next === 'fullscreen') {
        (e.currentTarget as HTMLElement).requestFullscreen?.().catch(() => {})
      } else if (next === 'normal') {
        document.exitFullscreen?.().catch(() => {})
        setMatrix(() => ({ m00: 1, m10: 0, m20: 0, m01: 0, m11: 1, m21: 0 }))
      } else {
        const factor = DOUBLE_TAP_SCALE[next] / DOUBLE_TAP_SCALE[prev === 'normal' ? 'normal' : prev]
        setMatrix(m => clampScale(m, zoomAt(m, factor, cx, cy)))
      }
      return next
    })
  }, [])

  return {
    onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
    onTouchStart, onTouchMove, onTouchEnd, onDoubleClick,
    doubleTapState,
  }
}
