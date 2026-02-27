import { useState, useCallback } from 'react'

export interface ReferenceImageState {
  dataUrl: string | null
  opacity: number
  x: number
  y: number
  scale: number
  rotation: number  // degrees
  naturalWidth: number
  naturalHeight: number
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
  pageCount: 1,
  currentPage: 1,
}

export interface UseReferenceImageReturn {
  ref: ReferenceImageState
  setOpacity: (v: number) => void
  setX: (v: number) => void
  setY: (v: number) => void
  setScale: (v: number) => void
  setRotation: (v: number) => void
  setCurrentPage: (page: number) => void
  /** Set raw dataUrl + intrinsic size (after file load / PDF render) */
  setRaw: (dataUrl: string, w: number, h: number, pageCount?: number) => void
  clear: () => void
}

export const useReferenceImage = (): UseReferenceImageReturn => {
  const [ref, setRef] = useState<ReferenceImageState>(INITIAL)

  const setOpacity     = useCallback((v: number) => setRef(s => ({ ...s, opacity: Math.max(0, Math.min(1, v)) })), [])
  const setX           = useCallback((v: number) => setRef(s => ({ ...s, x: v })), [])
  const setY           = useCallback((v: number) => setRef(s => ({ ...s, y: v })), [])
  const setScale       = useCallback((v: number) => setRef(s => ({ ...s, scale: Math.max(0.01, v) })), [])
  const setRotation    = useCallback((v: number) => setRef(s => ({ ...s, rotation: v })), [])
  const setCurrentPage = useCallback((page: number) => setRef(s => ({ ...s, currentPage: page })), [])

  const setRaw = useCallback((dataUrl: string, w: number, h: number, pageCount = 1) => {
    setRef(s => ({ ...s, dataUrl, naturalWidth: w, naturalHeight: h, pageCount, currentPage: 1 }))
  }, [])

  const clear = useCallback(() => setRef(INITIAL), [])

  return { ref, setOpacity, setX, setY, setScale, setRotation, setCurrentPage, setRaw, clear }
}
