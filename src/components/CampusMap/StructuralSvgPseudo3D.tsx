import React, { useMemo, useState, useRef, useCallback } from 'react'
import { analyzeStructuralGroups } from '../../importer/svg/analyzeStructuralGroups'

export interface StructuralSvgPseudo3DProps {
  rawSvg: string
  mode?: 'flat' | '3d'
  hideNonBuildingSymbols?: boolean
  width?: number | string
  height?: number | string
}

const ANALYSIS_CACHE = new Map<string, ReturnType<typeof analyzeStructuralGroups>>()

const getCachedAnalysis = (
  rawSvg: string,
  hideNonBuildingSymbols: boolean,
): ReturnType<typeof analyzeStructuralGroups> => {
  const key = `${hideNonBuildingSymbols ? 'hide' : 'show'}::${rawSvg}`
  const hit = ANALYSIS_CACHE.get(key)
  if (hit) return hit
  const created = analyzeStructuralGroups(rawSvg, { hideNonBuildingSymbols })
  ANALYSIS_CACHE.set(key, created)
  return created
}

const parseViewBox = (viewBox: string): { minX: number; minY: number; width: number; height: number } => {
  const nums = viewBox.trim().split(/\s+/).map(Number)
  return {
    minX: nums[0] ?? 0,
    minY: nums[1] ?? 0,
    width: nums[2] ?? 1,
    height: nums[3] ?? 1,
  }
}

export const StructuralSvgPseudo3D: React.FC<StructuralSvgPseudo3DProps> = ({
  rawSvg,
  mode = '3d',
  hideNonBuildingSymbols = true,
  width = '100%',
  height = '100%',
}) => {
  const analysis = useMemo(
    () => getCachedAnalysis(rawSvg, hideNonBuildingSymbols),
    [rawSvg, hideNonBuildingSymbols],
  )
  const vb = useMemo(() => parseViewBox(analysis.viewBox), [analysis.viewBox])
  const maxLayerZ = analysis.layers.length > 0
    ? Math.max(...analysis.layers.map((l) => l.height))
    : 0
  const [rotationX, setRotationX] = useState(56)
  const [rotationY, setRotationY] = useState(0)
  const [rotationZ, setRotationZ] = useState(-8)
  const [zoom, setZoom] = useState(0.96)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const dragState = useRef<{ x: number; y: number; mode: 'rotate' | 'pan' } | null>(null)

  const clampZoom = (v: number): number => Math.max(0.25, Math.min(5, v))

  const resetView = useCallback(() => {
    setRotationX(56)
    setRotationY(0)
    setRotationZ(-8)
    setZoom(0.96)
    setPanX(0)
    setPanY(0)
  }, [])

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setZoom((z) => clampZoom(z * factor))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragState.current = {
      x: e.clientX,
      y: e.clientY,
      mode: e.shiftKey ? 'pan' : 'rotate',
    }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const state = dragState.current
    if (!state) return
    const dx = e.clientX - state.x
    const dy = e.clientY - state.y
    dragState.current = { ...state, x: e.clientX, y: e.clientY }

    if (state.mode === 'pan') {
      setPanX((v) => v + dx)
      setPanY((v) => v + dy)
      return
    }

    setRotationY((v) => v + dx * 0.4)
    setRotationX((v) => Math.max(-89, Math.min(89, v - dy * 0.4)))
    setRotationZ((v) => v + dx * 0.05)
  }, [])

  const onMouseUp = useCallback(() => {
    dragState.current = null
  }, [])

  const sceneTransform = mode === '3d'
    ? `translate(${panX}px, ${panY}px) scale(${zoom}) rotateX(${rotationX}deg) rotateY(${rotationY}deg) rotateZ(${rotationZ}deg)`
    : `translate(${panX}px, ${panY}px) scale(${zoom})`

  return (
    <div
      data-structural-3d="true"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={resetView}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        perspective: mode === '3d' ? 1600 : 'none',
        background: 'var(--bg-1)',
        cursor: dragState.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
    >
      <div
        data-structural-scene="true"
        data-mode={mode}
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: sceneTransform,
          transformOrigin: '50% 50%',
        }}
      >
        <svg
          viewBox={analysis.viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: analysis.baseStrokeSvg.replace(/^<svg[^>]*>|<\/svg>$/g, '') }}
        />

        {analysis.layers.map((layer) => (
          <svg
            key={layer.id}
            data-structural-layer={layer.id}
            viewBox={analysis.viewBox}
            preserveAspectRatio="xMidYMid meet"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transform: mode === '3d' ? `translateZ(${layer.height}px)` : 'translateZ(0px)',
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: layer.svgMarkup }}
          />
        ))}

        {mode === '3d' && maxLayerZ > 0 && (
          <div
            data-structural-frame="true"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              transformStyle: 'preserve-3d',
            }}
          >
            {[
              { x: vb.minX, y: vb.minY },
              { x: vb.minX + vb.width, y: vb.minY },
              { x: vb.minX, y: vb.minY + vb.height },
              { x: vb.minX + vb.width, y: vb.minY + vb.height },
            ].map((c, i) => {
              const leftPct = ((c.x - vb.minX) / vb.width) * 100
              const topPct = ((c.y - vb.minY) / vb.height) * 100
              return (
                <div
                  key={`pillar-${i}`}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: 1,
                    height: maxLayerZ,
                    background: 'rgba(148,163,184,0.8)',
                    transformOrigin: 'top left',
                    transform: 'translateZ(0px) rotateX(90deg)',
                  }}
                />
              )
            })}

            {analysis.connectors.map((c, i) => {
              const dz = Math.abs(c.zTo - c.zFrom)
              if (dz < 1) return null
              const leftPct = ((c.xFrom - vb.minX) / vb.width) * 100
              const topPct = ((c.yFrom - vb.minY) / vb.height) * 100
              const zStart = Math.min(c.zFrom, c.zTo)
              const zEnd = Math.max(c.zFrom, c.zTo)
              return (
                <React.Fragment key={`zlink-${i}`}>
                  <div
                    data-structural-z-link="true"
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: 2,
                      height: dz,
                      background: 'rgba(236,72,153,0.92)',
                      pointerEvents: 'none',
                      transformOrigin: 'top left',
                      transform: `translateZ(${zStart}px) rotateX(90deg)`,
                    }}
                  />
                  <div
                    data-structural-z-point="start"
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'rgba(236,72,153,0.98)',
                      pointerEvents: 'none',
                      transform: `translate(-1px, -1px) translateZ(${zStart}px)`,
                    }}
                  />
                  <div
                    data-structural-z-point="end"
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'rgba(236,72,153,0.75)',
                      pointerEvents: 'none',
                      transform: `translate(-1px, -1px) translateZ(${zEnd}px)`,
                    }}
                  />
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
