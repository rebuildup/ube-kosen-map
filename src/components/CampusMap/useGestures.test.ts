import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  getDoubleTapNextState,
  getPinchCenterAndScale,
  getTwoFingerRotation,
  DoubleTapState,
  useGestures,
} from './useGestures'

// ── Double-tap state machine ──────────────────────────────────────────────────

describe('double-tap state machine', () => {
  it('transitions: normal → zoom1 → zoom2 → fullscreen → normal', () => {
    let state: DoubleTapState = 'normal'
    state = getDoubleTapNextState(state)
    expect(state).toBe('zoom1')
    state = getDoubleTapNextState(state)
    expect(state).toBe('zoom2')
    state = getDoubleTapNextState(state)
    expect(state).toBe('fullscreen')
    state = getDoubleTapNextState(state)
    expect(state).toBe('normal')
  })
})

// ── Pinch: center and scale ───────────────────────────────────────────────────

describe('getPinchCenterAndScale', () => {
  it('computes center between two touch points', () => {
    const { center } = getPinchCenterAndScale(
      { x: 0, y: 0 }, { x: 100, y: 0 },   // prev fingers
      { x: 0, y: 0 }, { x: 200, y: 0 },   // curr fingers
    )
    // Center of current = (0+200)/2, 0
    expect(center.x).toBeCloseTo(100)
    expect(center.y).toBeCloseTo(0)
  })

  it('computes scale factor from pinch distance change', () => {
    const { scaleFactor } = getPinchCenterAndScale(
      { x: 0, y: 0 }, { x: 100, y: 0 },  // prev: distance 100
      { x: 0, y: 0 }, { x: 200, y: 0 },  // curr: distance 200
    )
    expect(scaleFactor).toBeCloseTo(2.0) // doubled
  })

  it('returns scaleFactor=1 when prev distance is 0', () => {
    const { scaleFactor } = getPinchCenterAndScale(
      { x: 50, y: 0 }, { x: 50, y: 0 }, // same point
      { x: 0, y: 0 }, { x: 100, y: 0 },
    )
    expect(scaleFactor).toBeCloseTo(1.0)
  })
})

// ── Two-finger rotation ────────────────────────────────────────────────────────

describe('getTwoFingerRotation', () => {
  it('returns 0 when fingers have not moved', () => {
    const delta = getTwoFingerRotation(
      { x: 0, y: 0 }, { x: 100, y: 0 },
      { x: 0, y: 0 }, { x: 100, y: 0 },
    )
    expect(delta).toBeCloseTo(0)
  })

  it('returns PI/2 when fingers rotate 90°', () => {
    // Prev: vector (100, 0), Curr: vector (0, 100) — 90° rotation
    const delta = getTwoFingerRotation(
      { x: 0, y: 0 }, { x: 100, y: 0 },
      { x: 0, y: 0 }, { x: 0, y: 100 },
    )
    expect(Math.abs(delta)).toBeCloseTo(Math.PI / 2, 2)
  })

  it('returns negative angle for counter-clockwise rotation', () => {
    const delta = getTwoFingerRotation(
      { x: 0, y: 0 }, { x: 0, y: 100 },
      { x: 0, y: 0 }, { x: 100, y: 0 },
    )
    expect(delta).toBeLessThan(0)
  })
})

describe('mouse pan button policy', () => {
  it('does not pan on left drag', () => {
    const setMatrix = vi.fn()
    const { result } = renderHook(() => useGestures({
      m00: 1, m10: 0, m20: 0, m01: 0, m11: 1, m21: 0,
    }, setMatrix))

    act(() => {
      result.current.onMouseDown({ button: 0, shiftKey: false, clientX: 10, clientY: 10 } as React.MouseEvent)
      result.current.onMouseMove({ clientX: 30, clientY: 30 } as React.MouseEvent)
    })

    expect(setMatrix).not.toHaveBeenCalled()
  })

  it('pans on middle-button drag', () => {
    const setMatrix = vi.fn()
    const { result } = renderHook(() => useGestures({
      m00: 1, m10: 0, m20: 0, m01: 0, m11: 1, m21: 0,
    }, setMatrix))

    act(() => {
      result.current.onMouseDown({ button: 1, shiftKey: false, clientX: 10, clientY: 10 } as React.MouseEvent)
      result.current.onMouseMove({ clientX: 30, clientY: 30 } as React.MouseEvent)
    })

    expect(setMatrix).toHaveBeenCalled()
  })
})
