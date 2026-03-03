// src/map/CampusMap.tsx
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import type { CSSProperties } from 'react'
import type React from 'react'
import { clusterPoints } from './clustering'
import { computeLabelLayout } from './labelLayout'
import { MapPin, ClusterPin, HighlightPin, getPointColor } from './MapPin'
import ZoomControls from './ZoomControls'
import type { Coordinate, ViewBox, InteractivePoint, PointCluster } from './types'
import type { ParsedMap } from './parseLayers'

// ---- Map geometry constants ----
const MARGIN_X = 50
const MARGIN_Y = 40
const CLUSTER_THRESHOLD = 25

export interface CampusMapProps {
  parsedMap: ParsedMap
  visibleLayers?: string[]
  points?: InteractivePoint[]
  highlightPoint?: Coordinate
  onPointClick?: (pointId: string) => void
  onPointHover?: (pointId: string | null) => void
  onMapClick?: (coordinate: Coordinate) => void
  height?: string
  showControls?: boolean
  enableFullscreen?: boolean
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
  maxZoom?: number
  minZoom?: number
  initialZoom?: number
}

// ---- Coordinate helpers ----

function getSVGContentRect(
  svgRect: DOMRect,
  viewBox: ViewBox,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const inferredRatio = viewBox.width / viewBox.height
  const svgRatio = svgRect.width / svgRect.height

  if (inferredRatio > svgRatio) {
    // Content fills width; letterbox top/bottom
    const contentWidth = svgRect.width
    const contentHeight = svgRect.width / inferredRatio
    return {
      width: contentWidth,
      height: contentHeight,
      offsetX: 0,
      offsetY: (svgRect.height - contentHeight) / 2,
    }
  } else {
    // Content fills height; pillarbox left/right
    const contentHeight = svgRect.height
    const contentWidth = svgRect.height * inferredRatio
    return {
      width: contentWidth,
      height: contentHeight,
      offsetX: (svgRect.width - contentWidth) / 2,
      offsetY: 0,
    }
  }
}

// ---- Main component ----

const CampusMap: React.FC<CampusMapProps> = ({
  parsedMap,
  visibleLayers,
  points,
  highlightPoint,
  onPointClick,
  onPointHover,
  onMapClick,
  height = '100%',
  showControls = true,
  enableFullscreen = true,
  onToggleFullscreen,
  isFullscreen: isFullscreenProp,
  maxZoom = 10,
  minZoom = 0.1,
  initialZoom = 1,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Derive map geometry from parsedMap.viewBox
  const mapGeom = useMemo(() => {
    const { x, y, width, height } = parsedMap.viewBox
    const fullW = width + MARGIN_X * 2
    const fullH = height + MARGIN_Y * 2
    return { x: x - MARGIN_X, y: y - MARGIN_Y, width: fullW, height: fullH, aspectRatio: fullH / fullW }
  }, [parsedMap.viewBox.x, parsedMap.viewBox.y, parsedMap.viewBox.width, parsedMap.viewBox.height]) // eslint-disable-line react-hooks/exhaustive-deps

  const initialVB: ViewBox = useMemo((): ViewBox => {
    if (initialZoom <= 0 || initialZoom === 1) {
      return { x: mapGeom.x, y: mapGeom.y, width: mapGeom.width, height: mapGeom.height }
    }
    const w = mapGeom.width / initialZoom
    const h = w * mapGeom.aspectRatio
    return {
      x: mapGeom.x + (mapGeom.width - w) / 2,
      y: mapGeom.y + (mapGeom.height - h) / 2,
      width: w,
      height: h,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only compute once on mount

  const [viewBox, setViewBox] = useState<ViewBox>(initialVB)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragStartViewBox, setDragStartViewBox] = useState<ViewBox | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [mobileHoveredPoint, setMobileHoveredPoint] = useState<string | null>(null)
  const [internalFullscreen, setInternalFullscreen] = useState(false)

  // Touch state
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const touchStartTimeRef = useRef<number>(0)
  const touchDistanceRef = useRef<number>(0)
  const isTouchGestureRef = useRef<boolean>(false)
  const lastTapTimeRef = useRef<number>(0)
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null)

  // rAF cancellation ref
  const rafIdRef = useRef<number | null>(null)

  const resolvedFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : internalFullscreen

  // Zoom level = ratio of full-map width to current viewBox width
  const currentZoomLevel = useMemo(
    () => mapGeom.width / viewBox.width,
    [mapGeom.width, viewBox.width],
  )

  const minVbWidth = mapGeom.width / maxZoom
  const maxVbWidth = mapGeom.width / minZoom

  // ---- Coordinate transforms ----

  const screenToSVG = useCallback(
    (screenX: number, screenY: number): Coordinate => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const svgRect = svg.getBoundingClientRect()
      const contentRect = getSVGContentRect(svgRect, viewBox)
      const adjustedRelativeX = screenX - svgRect.left - contentRect.offsetX
      const adjustedRelativeY = screenY - svgRect.top - contentRect.offsetY
      return {
        x: viewBox.x + (adjustedRelativeX / contentRect.width) * viewBox.width,
        y: viewBox.y + (adjustedRelativeY / contentRect.height) * viewBox.height,
      }
    },
    [viewBox],
  )

  const svgToScreen = useCallback(
    (svgX: number, svgY: number): { x: number; y: number } => {
      const svg = svgRef.current
      const container = containerRef.current
      if (!svg || !container) return { x: 0, y: 0 }
      const svgRect = svg.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const contentRect = getSVGContentRect(svgRect, viewBox)
      if (contentRect.width === 0 || contentRect.height === 0) {
        // Fallback for jsdom / zero-size containers
        return {
          x: svgX - viewBox.x,
          y: svgY - viewBox.y,
        }
      }
      const relX = ((svgX - viewBox.x) / viewBox.width) * contentRect.width + contentRect.offsetX
      const relY = ((svgY - viewBox.y) / viewBox.height) * contentRect.height + contentRect.offsetY
      return {
        x: svgRect.left - containerRect.left + relX,
        y: svgRect.top - containerRect.top + relY,
      }
    },
    [viewBox],
  )

  // ---- Zoom functions ----

  const clampViewBox = useCallback(
    (vb: ViewBox): ViewBox => {
      const w = Math.max(minVbWidth, Math.min(maxVbWidth, vb.width))
      const h = w * mapGeom.aspectRatio
      return { ...vb, width: w, height: h }
    },
    [minVbWidth, maxVbWidth, mapGeom.aspectRatio],
  )

  const zoomAroundPoint = useCallback(
    (svgCx: number, svgCy: number, factor: number) => {
      setViewBox((prev) => {
        const newWidth = prev.width * factor
        const newHeight = prev.height * factor
        const clamped = clampViewBox({ ...prev, width: newWidth, height: newHeight })
        const actualFactor = clamped.width / prev.width
        return {
          x: svgCx - (svgCx - prev.x) * actualFactor,
          y: svgCy - (svgCy - prev.y) * actualFactor,
          width: clamped.width,
          height: clamped.height,
        }
      })
    },
    [clampViewBox],
  )

  const zoomIn = useCallback(() => {
    const cx = viewBox.x + viewBox.width / 2
    const cy = viewBox.y + viewBox.height / 2
    zoomAroundPoint(cx, cy, 0.8)
  }, [viewBox, zoomAroundPoint])

  const zoomOut = useCallback(() => {
    const cx = viewBox.x + viewBox.width / 2
    const cy = viewBox.y + viewBox.height / 2
    zoomAroundPoint(cx, cy, 1.25)
  }, [viewBox, zoomAroundPoint])

  const resetView = useCallback(() => {
    setViewBox(initialVB)
  }, [initialVB])

  const zoomToPoint = useCallback(
    (point: Coordinate, zoomLevel: number) => {
      const targetWidth = mapGeom.width / zoomLevel
      const targetHeight = targetWidth * mapGeom.aspectRatio
      setViewBox({
        x: point.x - targetWidth / 2,
        y: point.y - targetHeight / 2,
        width: targetWidth,
        height: targetHeight,
      })
    },
    [mapGeom.width, mapGeom.aspectRatio],
  )

  // ---- Fullscreen ----

  const handleToggleFullscreen = useCallback(() => {
    if (onToggleFullscreen) {
      onToggleFullscreen()
    } else {
      setInternalFullscreen((prev) => !prev)
    }
  }, [onToggleFullscreen])

  // Escape key closes fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && resolvedFullscreen) {
        if (onToggleFullscreen) {
          onToggleFullscreen()
        } else {
          setInternalFullscreen(false)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [resolvedFullscreen, onToggleFullscreen])

  // body overflow management
  useEffect(() => {
    if (resolvedFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [resolvedFullscreen])

  // ---- Mouse event handlers ----

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button !== 0) return
      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
      setDragStartViewBox(viewBox)
    },
    [viewBox],
  )

  const handleSVGClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onMapClick) return
      // Suppress clicks that were actually drags
      if (dragStart) {
        const dx = Math.abs(e.clientX - dragStart.x)
        const dy = Math.abs(e.clientY - dragStart.y)
        if (dx > 5 || dy > 5) return
      }
      const coord = screenToSVG(e.clientX, e.clientY)
      onMapClick(coord)
    },
    [onMapClick, dragStart, screenToSVG],
  )

  // Attach mousemove/mouseup to document so drag works outside SVG
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStart || !dragStartViewBox) return
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        const svg = svgRef.current
        if (!svg) return
        const svgRect = svg.getBoundingClientRect()
        const contentRect = getSVGContentRect(svgRect, dragStartViewBox)
        const dxSVG = ((e.clientX - dragStart.x) / contentRect.width) * dragStartViewBox.width
        const dySVG = ((e.clientY - dragStart.y) / contentRect.height) * dragStartViewBox.height
        setViewBox({
          ...dragStartViewBox,
          x: dragStartViewBox.x - dxSVG,
          y: dragStartViewBox.y - dySVG,
        })
        rafIdRef.current = null
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setDragStart(null)
      setDragStartViewBox(null)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp, { passive: true })
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [isDragging, dragStart, dragStartViewBox])

  // ---- Wheel zoom ----

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY > 0 ? 1.1 : 0.9
      const svgCoord = screenToSVG(e.clientX, e.clientY)
      zoomAroundPoint(svgCoord.x, svgCoord.y, factor)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [screenToSVG, zoomAroundPoint])

  // ---- Touch handlers ----

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 1) {
        const touch = e.touches.item(0)
        if (!touch) return
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
        touchStartTimeRef.current = Date.now()
        isTouchGestureRef.current = false
        setDragStart({ x: touch.clientX, y: touch.clientY })
        setDragStartViewBox(viewBox)
        setIsDragging(true)
      } else if (e.touches.length === 2) {
        const t0 = e.touches.item(0)
        const t1 = e.touches.item(1)
        if (!t0 || !t1) return
        const dx = t1.clientX - t0.clientX
        const dy = t1.clientY - t0.clientY
        touchDistanceRef.current = Math.hypot(dx, dy)
        isTouchGestureRef.current = true
        setIsDragging(false)
      }
    },
    [viewBox],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()

      if (e.touches.length === 1 && !isTouchGestureRef.current) {
        const touch = e.touches.item(0)
        if (!touch) return
        const startPos = touchStartPosRef.current
        if (!startPos) return
        const dx = touch.clientX - startPos.x
        const dy = touch.clientY - startPos.y
        if (Math.hypot(dx, dy) > 10) {
          // Pan
          const svg = svgRef.current
          const dvb = dragStartViewBox
          if (!svg || !dvb) return
          const svgRect = svg.getBoundingClientRect()
          const contentRect = getSVGContentRect(svgRect, dvb)
          const dxSVG = (dx / contentRect.width) * dvb.width
          const dySVG = (dy / contentRect.height) * dvb.height
          setViewBox({
            ...dvb,
            x: dvb.x - dxSVG,
            y: dvb.y - dySVG,
          })
        }
      } else if (e.touches.length === 2) {
        const t0 = e.touches.item(0)
        const t1 = e.touches.item(1)
        if (!t0 || !t1) return
        const dx = t1.clientX - t0.clientX
        const dy = t1.clientY - t0.clientY
        const newDist = Math.hypot(dx, dy)
        const prevDist = touchDistanceRef.current
        if (prevDist > 0) {
          const factor = prevDist / newDist
          const midX = (t0.clientX + t1.clientX) / 2
          const midY = (t0.clientY + t1.clientY) / 2
          const svgMid = screenToSVG(midX, midY)
          zoomAroundPoint(svgMid.x, svgMid.y, factor)
        }
        touchDistanceRef.current = newDist
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      setIsDragging(false)

      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches.item(0)
        if (!touch) {
          touchStartPosRef.current = null
          setDragStart(null)
          setDragStartViewBox(null)
          return
        }
        const startPos = touchStartPosRef.current
        const duration = Date.now() - touchStartTimeRef.current

        const dist = startPos
          ? Math.hypot(touch.clientX - startPos.x, touch.clientY - startPos.y)
          : Infinity

        if (duration < 500 && dist < 15) {
          // Tap detected
          const now = Date.now()
          const timeSinceLastTap = now - lastTapTimeRef.current
          const lastPos = lastTapPosRef.current

          const tapDist = lastPos
            ? Math.hypot(touch.clientX - lastPos.x, touch.clientY - lastPos.y)
            : Infinity

          if (timeSinceLastTap < 300 && tapDist < 30) {
            // Double-tap: cycle zoom levels 1x → 2x → 4x → 8x → 1x
            const ZOOM_STEPS: number[] = [1, 2, 4, 8]
            const currentStep = ZOOM_STEPS.findIndex((z) => Math.abs(currentZoomLevel - z) < 0.5)
            const nextStep = (currentStep + 1) % ZOOM_STEPS.length
            const nextZoom = ZOOM_STEPS[nextStep] ?? 1
            const tapCoord = screenToSVG(touch.clientX, touch.clientY)
            zoomToPoint(tapCoord, nextZoom)
            lastTapTimeRef.current = 0
            lastTapPosRef.current = null
          } else {
            // Single tap
            lastTapTimeRef.current = now
            lastTapPosRef.current = { x: touch.clientX, y: touch.clientY }
            if (onMapClick) {
              const coord = screenToSVG(touch.clientX, touch.clientY)
              onMapClick(coord)
            }
          }
        }
      }

      touchStartPosRef.current = null
      setDragStart(null)
      setDragStartViewBox(null)
    }

    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })
    return () => {
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [dragStartViewBox, screenToSVG, zoomAroundPoint, zoomToPoint, onMapClick, currentZoomLevel])

  // ---- Clustering ----

  const allClusters = useMemo((): PointCluster[] => {
    if (!points || points.length === 0) return []
    const radius = CLUSTER_THRESHOLD / Math.sqrt(currentZoomLevel)
    const { clusters, singles } = clusterPoints(points, { radius, minPoints: 2 })
    return [
      ...clusters,
      ...singles.map(
        (p): PointCluster => ({
          id: `single-${p.id}`,
          coordinates: p.coordinates,
          points: [p],
          count: 1,
        }),
      ),
    ]
  }, [points, currentZoomLevel])

  // ---- Container dimensions for label layout ----

  const containerWidth = containerRef.current?.offsetWidth ?? 800
  const containerHeight = containerRef.current?.offsetHeight ?? 600

  // ---- Label layout ----

  const labelResults = useMemo(() => {
    if (allClusters.length === 0) return []
    const pinPositions = allClusters.map((c, i) => {
      const screen = svgToScreen(c.coordinates.x, c.coordinates.y)
      return { index: i, x: screen.x, y: screen.y }
    })
    return computeLabelLayout(pinPositions, {
      viewportWidth: containerWidth,
      viewportHeight: containerHeight,
    })
  }, [allClusters, svgToScreen, containerWidth, containerHeight])

  // ---- Styles ----

  const containerStyle: CSSProperties = {
    position: resolvedFullscreen ? 'fixed' : 'relative',
    inset: resolvedFullscreen ? 0 : undefined,
    width: resolvedFullscreen ? '100vw' : '100%',
    height: resolvedFullscreen ? '100vh' : (height ?? '100%'),
    zIndex: resolvedFullscreen ? 60 : undefined,
    overflow: 'hidden',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'manipulation',
    background: 'var(--map-bg, #f5f5f5)',
  }

  const pinOverlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* SVG map */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onClick={handleSVGClick}
        onMouseLeave={() => {
          setHoveredPoint(null)
          onPointHover?.(null)
        }}
        onTouchStart={handleTouchStart}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'block',
          shapeRendering: 'geometricPrecision',
        }}
      >
        {/* Inject SVG defs/styles from parsedMap */}
        {parsedMap.styles && (
          <defs>
            <style>{parsedMap.styles}</style>
          </defs>
        )}

        {/* Render layers filtered by visibleLayers */}
        {parsedMap.layers.map((layer) => {
          if (visibleLayers && !visibleLayers.includes(layer.id)) return null
          return (
            <g
              key={layer.id}
              id={layer.id}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: layer.svgContent }}
            />
          )
        })}
      </svg>

      {/* Pin overlay */}
      <div style={pinOverlayStyle}>
        {allClusters.map((cluster, i) => {
          const labelResult = labelResults[i]
          const screenPos = svgToScreen(cluster.coordinates.x, cluster.coordinates.y)

          if (cluster.count === 1) {
            const point = cluster.points[0]
            if (!point) return null
            return (
              <MapPin
                key={cluster.id}
                id={point.id}
                position={screenPos}
                svgCoordinate={cluster.coordinates}
                type={point.type as 'event' | 'exhibit' | 'room' | 'stall' | 'toilet' | 'trash'}
                color={point.color}
                label={labelResult?.direction ? point.title : undefined}
                labelPosition={labelResult?.direction ?? 'right'}
                isHovered={hoveredPoint === point.id}
                isMobileHovered={mobileHoveredPoint === point.id}
                onClick={() => {
                  onPointClick?.(point.id)
                }}
                onMouseEnter={() => {
                  setHoveredPoint(point.id)
                  onPointHover?.(point.id)
                }}
                onMouseLeave={() => {
                  setHoveredPoint(null)
                  onPointHover?.(null)
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  const startPos = touchStartPosRef.current
                  const duration = Date.now() - touchStartTimeRef.current
                  const t = e.changedTouches.item(0)
                  if (!t) return
                  const dist = startPos
                    ? Math.hypot(t.clientX - startPos.x, t.clientY - startPos.y)
                    : 0
                  if (duration < 500 && dist < 15) {
                    setMobileHoveredPoint((prev) => (prev === point.id ? null : point.id))
                    onPointClick?.(point.id)
                  }
                }}
              />
            )
          }

          // Cluster pin
          const typeSegments = cluster.points.reduce<Record<string, number>>(
            (acc, p) => {
              acc[p.type] = (acc[p.type] ?? 0) + 1
              return acc
            },
            {},
          )
          const segments = Object.entries(typeSegments).map(([type, count]) => ({
            count,
            color: getPointColor(type),
          }))

          return (
            <ClusterPin
              key={cluster.id}
              id={cluster.id}
              position={screenPos}
              count={cluster.count}
              typeSegments={segments}
              onClick={() => {
                const firstPoint = cluster.points[0]
                if (firstPoint) {
                  onPointClick?.(firstPoint.id)
                }
              }}
            />
          )
        })}

        {highlightPoint && (
          <HighlightPin
            position={svgToScreen(highlightPoint.x, highlightPoint.y)}
          />
        )}
      </div>

      {/* Zoom controls */}
      {showControls && (
        <ZoomControls
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetView}
          onToggleFullscreen={enableFullscreen ? handleToggleFullscreen : undefined}
          isFullscreen={resolvedFullscreen}
          scale={currentZoomLevel}
          minScale={minZoom}
          maxScale={maxZoom}
        />
      )}
    </div>
  )
}

export default CampusMap
