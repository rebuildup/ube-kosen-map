import { useState, useCallback } from 'react'

export interface ReferenceImageState {
  dataUrl: string | null
  opacity: number
  x: number
  y: number
  scale: number
  rotation: number
  naturalWidth: number
  naturalHeight: number
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  pageCount: number
  currentPage: number
}

const INITIAL: ReferenceImageState = {
  dataUrl: null,
  opacity: 0.5,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  cropX: 0,
  cropY: 0,
  cropWidth: 0,
  cropHeight: 0,
  pageCount: 1,
  currentPage: 1,
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export interface UseReferenceImageReturn {
  ref: ReferenceImageState
  setOpacity: (v: number) => void
  setX: (v: number) => void
  setY: (v: number) => void
  setScale: (v: number) => void
  setRotation: (v: number) => void
  setCrop: (cropX: number, cropY: number, cropWidth: number, cropHeight: number) => void
  setCurrentPage: (page: number) => void
  setRaw: (dataUrl: string, w: number, h: number, pageCount?: number, currentPage?: number) => void
  clear: () => void
}

export const useReferenceImage = (): UseReferenceImageReturn => {
  const [ref, setRef] = useState<ReferenceImageState>(INITIAL)

  const setOpacity     = useCallback((v: number) => setRef(s => ({ ...s, opacity: Math.max(0, Math.min(1, v)) })), [])
  const setX           = useCallback((v: number) => setRef(s => ({ ...s, x: v })), [])
  const setY           = useCallback((v: number) => setRef(s => ({ ...s, y: v })), [])
  const setScale       = useCallback((v: number) => setRef(s => ({ ...s, scale: Math.max(0.01, v) })), [])
  const setRotation    = useCallback((v: number) => setRef(s => ({ ...s, rotation: v })), [])
  const setCrop = useCallback((cropX: number, cropY: number, cropWidth: number, cropHeight: number) => {
    setRef((s) => {
      const maxX = Math.max(0, s.naturalWidth - 1)
      const maxY = Math.max(0, s.naturalHeight - 1)
      const safeX = clamp(cropX, 0, maxX)
      const safeY = clamp(cropY, 0, maxY)
      const safeWidth = clamp(cropWidth, 1, Math.max(1, s.naturalWidth - safeX))
      const safeHeight = clamp(cropHeight, 1, Math.max(1, s.naturalHeight - safeY))
      return { ...s, cropX: safeX, cropY: safeY, cropWidth: safeWidth, cropHeight: safeHeight }
    })
  }, [])
  const setCurrentPage = useCallback((page: number) => {
    setRef(s => ({ ...s, currentPage: clamp(page, 1, Math.max(1, s.pageCount)) }))
  }, [])

  const setRaw = useCallback((dataUrl: string, w: number, h: number, pageCount = 1, currentPage = 1) => {
    const safeW = Math.max(1, w)
    const safeH = Math.max(1, h)
    const safePageCount = Math.max(1, pageCount)
    setRef(s => ({
      ...s,
      dataUrl,
      naturalWidth: safeW,
      naturalHeight: safeH,
      cropX: 0,
      cropY: 0,
      cropWidth: safeW,
      cropHeight: safeH,
      pageCount: safePageCount,
      currentPage: clamp(currentPage, 1, safePageCount),
    }))
  }, [])

  const clear = useCallback(() => setRef(INITIAL), [])

  return { ref, setOpacity, setX, setY, setScale, setRotation, setCrop, setCurrentPage, setRaw, clear }
}
