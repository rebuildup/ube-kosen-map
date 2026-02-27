import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReferenceImage } from './useReferenceImage'

describe('useReferenceImage', () => {
  it('initial state is empty', () => {
    const { result } = renderHook(() => useReferenceImage())
    expect(result.current.ref.dataUrl).toBeNull()
    expect(result.current.ref.opacity).toBe(0.5)
    expect(result.current.ref.scale).toBe(1)
    expect(result.current.ref.rotation).toBe(0)
    expect(result.current.ref.x).toBe(0)
    expect(result.current.ref.y).toBe(0)
  })

  it('setOpacity clamps to 0-1', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setOpacity(1.5))
    expect(result.current.ref.opacity).toBe(1)
    act(() => result.current.setOpacity(-0.1))
    expect(result.current.ref.opacity).toBe(0)
  })

  it('setScale clamps to min 0.01', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setScale(0))
    expect(result.current.ref.scale).toBe(0.01)
  })

  it('clear resets to initial', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => {
      result.current.setOpacity(0.8)
      result.current.setScale(2)
      result.current.clear()
    })
    expect(result.current.ref.dataUrl).toBeNull()
    expect(result.current.ref.opacity).toBe(0.5)
    expect(result.current.ref.scale).toBe(1)
  })

  it('setRaw sets dataUrl and natural size', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setRaw('data:image/png;base64,abc', 800, 600))
    expect(result.current.ref.dataUrl).toBe('data:image/png;base64,abc')
    expect(result.current.ref.naturalWidth).toBe(800)
    expect(result.current.ref.naturalHeight).toBe(600)
    expect(result.current.ref.cropWidth).toBe(800)
    expect(result.current.ref.cropHeight).toBe(600)
  })

  it('setCrop clamps crop box to natural bounds', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setRaw('data:image/png;base64,abc', 300, 200))
    act(() => result.current.setCrop(-20, 50, 500, 500))
    expect(result.current.ref.cropX).toBe(0)
    expect(result.current.ref.cropY).toBe(50)
    expect(result.current.ref.cropWidth).toBe(300)
    expect(result.current.ref.cropHeight).toBe(150)
  })

  it('setCurrentPage keeps page in [1, pageCount]', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setRaw('data:image/png;base64,abc', 800, 600, 3))
    act(() => result.current.setCurrentPage(99))
    expect(result.current.ref.currentPage).toBe(3)
    act(() => result.current.setCurrentPage(0))
    expect(result.current.ref.currentPage).toBe(1)
  })
})
