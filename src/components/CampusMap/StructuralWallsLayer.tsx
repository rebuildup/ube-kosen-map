// src/components/CampusMap/StructuralWallsLayer.tsx
import React, { useMemo, useState } from 'react'
import type { Segment, SegmentKind } from '../../importer/svg/parseSvgSegments'
import { resolveHeight, type HeightMap } from '../../importer/svg/loadHeights'

interface ViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

export interface StructuralWallsLayerProps {
  segments: Segment[]
  viewBox: ViewBox
  defaultWallHeight: number
  heights: HeightMap
  mode: 'flat' | '3d'
  visibleKinds?: Set<SegmentKind>
  onSelect?: (featureId: string | undefined, kind: SegmentKind | undefined) => void
}

const KIND_COLORS: Record<SegmentKind, string> = {
  building: 'rgba(148,163,184,0.35)',
  road: 'rgba(134,239,172,0.25)',
  door: 'rgba(251,191,36,0.5)',
  balcony: 'rgba(196,181,253,0.3)',
  other: 'rgba(148,163,184,0.2)',
}

export const StructuralWallsLayer: React.FC<StructuralWallsLayerProps> = ({
  segments,
  viewBox: vb,
  defaultWallHeight,
  heights,
  mode,
  visibleKinds,
  onSelect,
}) => {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const filteredSegments = useMemo(() => {
    if (mode !== '3d') return []
    return segments.filter(seg => {
      if (!visibleKinds) return true
      return visibleKinds.has(seg.kind ?? 'other')
    })
  }, [segments, mode, visibleKinds])

  if (mode !== '3d') return null

  return (
    <div
      data-walls-layer="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        transformStyle: 'preserve-3d',
      }}
    >
      {filteredSegments.map((seg, i) => {
        const { a, b } = seg
        const dx = b.x - a.x
        const dy = b.y - a.y

        const midXPct = ((a.x + b.x) / 2 - vb.minX) / vb.width * 100
        const midYPct = ((a.y + b.y) / 2 - vb.minY) / vb.height * 100

        const len = Math.sqrt(dx * dx + dy * dy)
        const lenPct = len / vb.width * 100

        // Compute angle in display space (account for viewBox aspect ratio)
        const dxPct = dx / vb.width * 100
        const dyPct = dy / vb.height * 100
        const angleDeg = Math.atan2(dyPct, dxPct) * (180 / Math.PI)

        const wallHeight = resolveHeight(seg.featureId, heights, defaultWallHeight)
        const kind: SegmentKind = seg.kind ?? 'other'
        const color = KIND_COLORS[kind]
        const isSelected = seg.featureId !== undefined && seg.featureId === selectedId

        return (
          <div
            key={i}
            data-wall={kind}
            data-feature-id={seg.featureId}
            data-selected={isSelected ? 'true' : undefined}
            style={{
              position: 'absolute',
              left: `${midXPct}%`,
              top: `${midYPct}%`,
              width: `${lenPct}%`,
              height: wallHeight,
              background: color,
              border: '1px solid rgba(148,163,184,0.4)',
              transformOrigin: 'center center',
              // rotateZ aligns the div along the segment direction;
              // rotateX(90deg) flips height into the Z axis (wall becomes vertical)
              transform: `rotateZ(${angleDeg}deg) rotateX(90deg)`,
              pointerEvents: 'auto',
              cursor: 'pointer',
              outline: isSelected ? '2px solid rgba(251,191,36,0.9)' : undefined,
            }}
            onClick={() => {
              setSelectedId(seg.featureId)
              onSelect?.(seg.featureId, seg.kind)
            }}
          />
        )
      })}
    </div>
  )
}
