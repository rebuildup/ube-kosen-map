import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { groupSvgPaths } from '../../importer/svg/groupSvgPaths'
import { parseSvgSegments } from '../../importer/svg/parseSvgSegments'

export interface StructuralSvgPseudo3DProps {
  rawSvg: string
  mode?: 'flat' | '3d'
  hideNonBuildingSymbols?: boolean
  width?: number | string
  height?: number | string
  showWalls?: boolean
  zScale?: number
  renderAsLayerFloors?: boolean
  onPathSelect?: (pathIndex: number, options?: { additive: boolean; toggle: boolean }) => void
  selectedPathIndices?: number[]
  showGrid?: boolean
  gridSpacing?: number
  gridLevels?: number[]
  showLayerToggles?: boolean
  shapeFaces?: Array<{
    id: string
    pathIndices: number[]
    baseZ?: number
    height: number
    color?: string
  }>
  visiblePathIndices?: number[]
  shapeTransitions?: Array<{
    id: string
    kind: 'stairs' | 'slope'
    fromZ: number
    toZ: number
    lowerPathIndices: number[]
    upperPathIndices: number[]
    stepCount?: number
  }>
}

type WallSegment = {
  id: string
  shapeId: string
  color: string
  baseZ: number
  height: number
  x1: number
  y1: number
  x2: number
  y2: number
}

type Segment2D = { x1: number; y1: number; x2: number; y2: number }
type PlaneGroup = { key: string; z: number; color: string; pathIndices: number[]; kind: 'base' | 'top' }

// Correctness-first: keep full geometry by default.
// If performance tuning is needed later, re-enable sampling with measured thresholds.
const MAX_RENDERED_WALL_SEGMENTS = Number.MAX_SAFE_INTEGER

const sampleArray = <T,>(items: T[], maxCount: number): T[] => {
  if (items.length <= maxCount) return items
  if (maxCount <= 0) return []
  const out: T[] = []
  const step = items.length / maxCount
  for (let i = 0; i < maxCount; i += 1) {
    out.push(items[Math.floor(i * step)] as T)
  }
  return out
}

const VISIBLE_GEOMETRY_SELECTOR = 'path,polyline,polygon,line,rect,circle,ellipse'
const HIDE_NON_LAYER_SELECTOR = `${VISIBLE_GEOMETRY_SELECTOR},text,tspan,image,use`

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
  width = '100%',
  height = '100%',
  showWalls = true,
  zScale = 1,
  renderAsLayerFloors = false,
  onPathSelect,
  selectedPathIndices,
  showGrid = false,
  gridSpacing = 120,
  gridLevels,
  shapeFaces = [],
  visiblePathIndices,
  shapeTransitions = [],
}) => {
  const { svgInnerHTML, viewBox } = useMemo(() => groupSvgPaths(rawSvg), [rawSvg])
  const vb = useMemo(() => parseViewBox(viewBox), [viewBox])

  const [rotationX, setRotationX] = useState(58)
  const [rotationY, setRotationY] = useState(0)
  const [rotationZ, setRotationZ] = useState(-10)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const dragState = useRef<{ x: number; y: number; mode: 'rotate' | 'pan' } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const clampZoom = (v: number): number => Math.max(0.2, Math.min(6, v))

  const resetView = useCallback(() => {
    setRotationX(58)
    setRotationY(0)
    setRotationZ(-10)
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w > 0 && h > 0) setContainerSize({ w, h })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const svgLayout = useMemo(() => {
    const { w: cw, h: ch } = containerSize
    if (!cw || !ch) return null
    const scale = Math.min(cw / vb.width, ch / vb.height)
    const offsetX = (cw - vb.width * scale) / 2
    const offsetY = (ch - vb.height * scale) / 2
    return { cw, ch, scale, offsetX, offsetY }
  }, [containerSize, vb])

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setZoom((z) => clampZoom(z * factor))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Left click is reserved for selection/editing in the 3D editor.
    if (e.button === 1) {
      e.preventDefault()
      dragState.current = { x: e.clientX, y: e.clientY, mode: 'pan' }
      return
    }
    if (e.button === 2) {
      e.preventDefault()
      dragState.current = { x: e.clientX, y: e.clientY, mode: 'rotate' }
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

  const rawSegments = useMemo(() => parseSvgSegments(rawSvg), [rawSvg])

  const segmentMapByPath = useMemo(() => {
    const map = new Map<number, Segment2D[]>()
    for (const seg of rawSegments) {
      if (seg.pathIndex == null) continue
      const arr = map.get(seg.pathIndex) ?? []
      arr.push({ x1: seg.a.x, y1: seg.a.y, x2: seg.b.x, y2: seg.b.y })
      map.set(seg.pathIndex, arr)
    }
    return map
  }, [rawSegments])

  const faceGeometry = useMemo(() => {
    return shapeFaces
      .filter((face) => face.height > 0 && face.pathIndices.length > 0)
      .map((face) => {
        const segments: Segment2D[] = []
        for (const pid of face.pathIndices) {
          const pathSegments = segmentMapByPath.get(pid)
          if (!pathSegments) continue
          for (const seg of pathSegments) segments.push(seg)
        }
        return {
          id: face.id,
          color: face.color ?? '#22c55e',
          baseZ: face.baseZ ?? 0,
          height: face.height,
          segments,
        }
      })
  }, [shapeFaces, segmentMapByPath])

  const wallSegments = useMemo(() => {
    const out: WallSegment[] = []
    for (const face of faceGeometry) {
      let idx = 0
      for (const seg of face.segments) {
        out.push({
          id: `${face.id}-${idx}`,
          shapeId: face.id,
          color: face.color,
          baseZ: face.baseZ,
          height: face.height,
          x1: seg.x1,
          y1: seg.y1,
          x2: seg.x2,
          y2: seg.y2,
        })
        idx += 1
      }
    }
    return sampleArray(out, MAX_RENDERED_WALL_SEGMENTS)
  }, [faceGeometry])

  const planeGroups = useMemo<PlaneGroup[]>(() => {
    const groups = new Map<string, { z: number; color: string; pathSet: Set<number>; kind: 'base' | 'top' }>()
    const upsert = (kind: 'base' | 'top', z: number, color: string, pathIndices: number[]) => {
      const key = `${kind}|${z}|${color}`
      const existing = groups.get(key) ?? { z, color, pathSet: new Set<number>(), kind }
      for (const pid of pathIndices) existing.pathSet.add(pid)
      groups.set(key, existing)
    }

    for (const face of shapeFaces) {
      if (face.pathIndices.length === 0) continue
      const color = face.color ?? '#22c55e'
      const baseZ = face.baseZ ?? 0
      const topZ = baseZ + face.height
      upsert('base', baseZ, color, face.pathIndices)
      if (!renderAsLayerFloors && face.height > 0) upsert('top', topZ, color, face.pathIndices)
    }

    return Array.from(groups.entries()).map(([key, g]) => ({
      key,
      z: g.z,
      color: g.color,
      kind: g.kind,
      pathIndices: Array.from(g.pathSet).sort((a, b) => a - b),
    }))
  }, [shapeFaces, renderAsLayerFloors])

  const sceneTransform = mode === '3d'
    ? `translate(${panX}px, ${panY}px) scale(${zoom}) rotateX(${rotationX}deg) rotateY(${rotationY}deg) rotateZ(${rotationZ}deg)`
    : `translate(${panX}px, ${panY}px) scale(${zoom})`

  const basePlaneCss = useMemo(() => {
    const base = `svg[data-base-plane="1"] ${VISIBLE_GEOMETRY_SELECTOR}{fill:none;stroke:rgba(148,163,184,0.38);stroke-width:0.8}`
    if (visiblePathIndices == null) return base
    const allowed = new Set(visiblePathIndices)
    const hideAll = `svg[data-base-plane="1"] ${HIDE_NON_LAYER_SELECTOR}{display:none}`
    const show = Array.from(allowed)
      .map((pid) => `svg[data-base-plane="1"] [data-sp="${pid}"]{display:inline;fill:none;stroke:rgba(148,163,184,0.38);stroke-width:0.8}`)
      .join('\n')
    return `${hideAll}\n${show}`
  }, [visiblePathIndices])

  const showBasePlane = mode !== '3d' || shapeFaces.length === 0
  const gridZs = useMemo(() => {
    if (gridLevels != null && gridLevels.length > 0) {
      return [...new Set([0, ...gridLevels])].sort((a, b) => a - b)
    }
    return [...new Set([0, ...planeGroups.map((p) => p.z)])].sort((a, b) => a - b)
  }, [gridLevels, planeGroups])
  const gridLines = useMemo(() => {
    const step = Math.max(10, Math.floor(gridSpacing))
    const minX = vb.minX
    const maxX = vb.minX + vb.width
    const minY = vb.minY
    const maxY = vb.minY + vb.height
    const xs: number[] = []
    const ys: number[] = []
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) xs.push(x)
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) ys.push(y)
    return { xs, ys, minX, maxX, minY, maxY }
  }, [gridSpacing, vb])

  const centroidOfPathSet = useCallback((pathIndices: number[]): { x: number; y: number } | null => {
    let sx = 0
    let sy = 0
    let count = 0
    for (const pid of pathIndices) {
      for (const seg of segmentMapByPath.get(pid) ?? []) {
        sx += seg.x1 + seg.x2
        sy += seg.y1 + seg.y2
        count += 2
      }
    }
    if (count === 0) return null
    return { x: sx / count, y: sy / count }
  }, [segmentMapByPath])

  const projectSegment = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    if (svgLayout) {
      const { cw, ch, scale, offsetX, offsetY } = svgLayout
      const midPxX = offsetX + (midX - vb.minX) * scale
      const midPxY = offsetY + (midY - vb.minY) * scale
      const len = Math.sqrt(dx * dx + dy * dy)
      return {
        leftPct: (midPxX / cw) * 100,
        topPct: (midPxY / ch) * 100,
        lenPct: (len * scale / cw) * 100,
        angleDeg: Math.atan2(dy, dx) * (180 / Math.PI),
      }
    }
    const len = Math.sqrt(dx * dx + dy * dy)
    const dxPct = (dx / vb.width) * 100
    const dyPct = (dy / vb.height) * 100
    return {
      leftPct: ((midX - vb.minX) / vb.width) * 100,
      topPct: ((midY - vb.minY) / vb.height) * 100,
      lenPct: (len / vb.width) * 100,
      angleDeg: Math.atan2(dyPct, dxPct) * (180 / Math.PI),
    }
  }, [svgLayout, vb])

  return (
    <div
      ref={viewportRef}
      data-structural-3d="true"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={resetView}
      onContextMenu={(e) => e.preventDefault()}
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
        {showBasePlane && (
          <svg
            data-base-plane="1"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <style>{basePlaneCss}</style>
            <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
          </svg>
        )}

        {mode === '3d' && showWalls && wallSegments.map((seg) => {
          const { leftPct, topPct, lenPct, angleDeg } = projectSegment(seg.x1, seg.y1, seg.x2, seg.y2)

          return (
            <div
              key={seg.id}
              data-shape-solid-wall={seg.shapeId}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${lenPct}%`,
                height: seg.height * zScale,
                background: `${seg.color}cc`,
                border: `1px solid ${seg.color}`,
                // Anchor the wall's top edge to the source segment, then extrude along +Z.
                transformOrigin: 'center top',
                transform: `translateZ(${seg.baseZ * zScale}px) rotateZ(${angleDeg}deg) rotateX(90deg)`,
                pointerEvents: 'none',
              }}
            />
          )
        })}

        {mode === '3d' && planeGroups.map((plane, planeIdx) => {
          const planeDataId = `plane-${planeIdx}`
          const hideAll = `svg[data-plane-id="${planeDataId}"] ${HIDE_NON_LAYER_SELECTOR}{display:none}`
          const opacity = plane.kind === 'top' ? 0.95 : 0.45
          const showPaths = plane.pathIndices
            .map((pid) => `svg[data-plane-id="${planeDataId}"] [data-sp="${pid}"]{display:inline;fill:none!important;stroke:${plane.color}!important;stroke-width:1.5!important;stroke-opacity:${opacity}!important}`)
            .join('\n')
          const selectedSet = new Set(selectedPathIndices ?? [])
          const selectedPaths = plane.pathIndices
            .filter((pid) => selectedSet.has(pid))
            .map((pid) => `svg[data-plane-id="${planeDataId}"] [data-sp="${pid}"]{display:inline;stroke:#f8fafc!important;stroke-width:2.6!important;stroke-opacity:1!important}`)
            .join('\n')
          return (
            <div
              key={plane.key}
              {...(plane.kind === 'top' ? { 'data-shape-solid-top': plane.key } : { 'data-shape-solid-base': plane.key })}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transform: `translateZ(${plane.z * zScale}px)`,
                pointerEvents: onPathSelect ? 'auto' : 'none',
              }}
            >
              <svg
                data-plane-id={planeDataId}
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: onPathSelect ? 'auto' : 'none' }}
                onClick={(e) => {
                  if (onPathSelect == null) return
                  const target = e.target as Element | null
                  const hit = target?.closest?.('[data-sp]')
                  const raw = hit?.getAttribute?.('data-sp')
                  if (raw == null) return
                  const pid = Number(raw)
                  if (Number.isFinite(pid)) {
                    const additive = e.shiftKey || e.ctrlKey || e.metaKey
                    const toggle = e.ctrlKey || e.metaKey
                    onPathSelect(pid, { additive, toggle })
                  }
                }}
              >
                <style>{`${hideAll}\n${showPaths}\n${selectedPaths}`}</style>
                <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
              </svg>
            </div>
          )
        })}

        {mode === '3d' && showGrid && gridZs.map((z, zi) => (
          <div
            key={`grid-${z}`}
            data-structural-grid={String(z)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transform: `translateZ(${z * zScale}px)`,
              pointerEvents: 'none',
            }}
          >
            <svg
              viewBox={viewBox}
              preserveAspectRatio="xMidYMid meet"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              {gridLines.xs.map((x, xi) => (
                <line
                  key={`gx-${z}-${x}`}
                  x1={x}
                  y1={gridLines.minY}
                  x2={x}
                  y2={gridLines.maxY}
                  stroke={xi % 5 === 0 ? 'rgba(148,163,184,0.58)' : 'rgba(148,163,184,0.4)'}
                  strokeWidth={xi % 5 === 0 ? 1 : 0.7}
                />
              ))}
              {gridLines.ys.map((y, yi) => (
                <line
                  key={`gy-${z}-${y}`}
                  x1={gridLines.minX}
                  y1={y}
                  x2={gridLines.maxX}
                  y2={y}
                  stroke={yi % 5 === 0 ? 'rgba(148,163,184,0.58)' : 'rgba(148,163,184,0.4)'}
                  strokeWidth={yi % 5 === 0 ? 1 : 0.7}
                />
              ))}
              <text
                x={gridLines.minX + 20}
                y={gridLines.minY + 24}
                fill="rgba(226,232,240,0.9)"
                fontSize={14}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                z:{z}
              </text>
              <text
                x={gridLines.minX + 20}
                y={gridLines.minY + 40}
                fill="rgba(148,163,184,0.85)"
                fontSize={11}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                grid {zi + 1}/{gridZs.length}
              </text>
            </svg>
          </div>
        ))}

        {mode === '3d' && shapeTransitions.map((tr) => {
          const color = tr.kind === 'stairs' ? '#f59e0b' : '#38bdf8'
          const lowerSvgId = `tr-lower-${tr.id}`
          const upperSvgId = `tr-upper-${tr.id}`
          const lowerHideAll = `svg[data-tr-id="${lowerSvgId}"] ${HIDE_NON_LAYER_SELECTOR}{display:none}`
          const lowerShow = tr.lowerPathIndices.map((pid) => `svg[data-tr-id="${lowerSvgId}"] [data-sp="${pid}"]{display:inline;fill:none!important;stroke:${color}!important;stroke-width:1.8!important;stroke-opacity:0.95!important}`).join('\n')
          const upperShow = tr.upperPathIndices.map((pid) => `svg[data-tr-id="${upperSvgId}"] [data-sp="${pid}"]{display:inline;fill:none!important;stroke:${color}!important;stroke-width:1.8!important;stroke-opacity:0.7!important}`).join('\n')
          const lowerC = centroidOfPathSet(tr.lowerPathIndices)
          const upperC = centroidOfPathSet(tr.upperPathIndices)
          const stepCount = tr.kind === 'stairs' ? (tr.stepCount ?? 0) : 0
          return (
            <React.Fragment key={`tr-${tr.id}`}>
              <svg
                data-tr-id={lowerSvgId}
                data-shape-transition-lower={tr.id}
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `translateZ(${tr.fromZ * zScale}px)`, pointerEvents: 'none' }}
              >
                <style>{`${lowerHideAll}\n${lowerShow}`}</style>
                <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
              </svg>
              <svg
                data-tr-id={upperSvgId}
                data-shape-transition-upper={tr.id}
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transformStyle: 'preserve-3d', transform: `translateZ(${tr.toZ * zScale}px)`, pointerEvents: 'none' }}
              >
                <style>{`${lowerHideAll}\n${upperShow}`}</style>
                <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
              </svg>
              {lowerC && upperC && (
                <div
                  data-shape-transition-link={tr.id}
                  style={{
                    position: 'absolute',
                    left: `${((lowerC.x - vb.minX) / vb.width) * 100}%`,
                    top: `${((lowerC.y - vb.minY) / vb.height) * 100}%`,
                    width: 2,
                    height: Math.abs(tr.toZ - tr.fromZ) * zScale,
                    background: `${color}cc`,
                    transformOrigin: 'top left',
                    transform: `translateZ(${Math.min(tr.fromZ, tr.toZ) * zScale}px) rotateX(90deg)`,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {lowerC && upperC && stepCount > 0 && Array.from({ length: stepCount - 1 }, (_, i) => i + 1).map((step) => {
                const t = step / stepCount
                const x = lowerC.x + (upperC.x - lowerC.x) * t
                const y = lowerC.y + (upperC.y - lowerC.y) * t
                const z = (tr.fromZ + (tr.toZ - tr.fromZ) * t) * zScale
                return (
                  <div
                    key={`step-${tr.id}-${step}`}
                    data-shape-transition-step={tr.id}
                    style={{
                      position: 'absolute',
                      left: `${((x - vb.minX) / vb.width) * 100}%`,
                      top: `${((y - vb.minY) / vb.height) * 100}%`,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: color,
                      transform: `translate(-2px,-2px) translateZ(${z}px)`,
                      pointerEvents: 'none',
                    }}
                  />
                )
              })}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
