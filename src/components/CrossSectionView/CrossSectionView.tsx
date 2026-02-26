/**
 * CrossSectionView — shows building floors in cross-section (4 directions).
 * [P-1] Topology First: vertical connections between floors are visualized.
 * [P-6] Mathematical Abstraction: direction = perspective axis selection.
 */

import React, { useState } from 'react'
import type { CampusGraph, BuildingId, FloorId } from '../../core/schema/types'

export type CrossSectionDirection = 'north' | 'east' | 'south' | 'west'

const DIRECTION_LABELS: Record<CrossSectionDirection, string> = {
  north: '北',
  east:  '東',
  south: '南',
  west:  '西',
}

const DIRECTIONS: CrossSectionDirection[] = ['north', 'east', 'south', 'west']

export interface CrossSectionViewProps {
  graph: CampusGraph
  buildingId: BuildingId
  direction?: CrossSectionDirection
  onDirectionChange?: (dir: CrossSectionDirection) => void
  width?: number
  height?: number
}

/** Collect floors belonging to a building, sorted high→low */
const getFloors = (graph: CampusGraph, buildingId: BuildingId) =>
  Object.values(graph.floors)
    .filter(f => f.buildingId === buildingId)
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))

/** Count vertical link edges for a building (stairs/elevator connections) */
const getVerticalLinks = (graph: CampusGraph, floorIds: Set<FloorId>) => {
  const nodeFloor = new Map<string, string>()
  Object.values(graph.nodes).forEach(n => {
    if (n.floorId && floorIds.has(n.floorId)) nodeFloor.set(n.id, n.floorId)
  })
  return Object.values(graph.edges).filter(e =>
    e.isVertical && nodeFloor.has(e.from) && nodeFloor.has(e.to),
  )
}

export const CrossSectionView: React.FC<CrossSectionViewProps> = ({
  graph,
  buildingId,
  direction: dirProp,
  onDirectionChange,
  width = 400,
  height = 300,
}) => {
  const [localDir, setLocalDir] = useState<CrossSectionDirection>('north')
  const activeDir = dirProp ?? localDir

  const handleDir = (d: CrossSectionDirection) => {
    setLocalDir(d)
    onDirectionChange?.(d)
  }

  const floors = getFloors(graph, buildingId)
  const floorIds = new Set(floors.map(f => f.id))
  const verticalLinks = getVerticalLinks(graph, floorIds)

  const floorHeight = floors.length > 0 ? Math.floor((height - 60) / floors.length) : 40

  return (
    <div
      aria-label="cross section view"
      style={{ width, background: '#f8fafc', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', overflow: 'hidden' }}
    >
      {/* Direction selector */}
      <div style={{ display: 'flex', gap: 4, padding: 8, background: '#e2e8f0' }}>
        {DIRECTIONS.map(d => (
          <button
            key={d}
            data-direction={d}
            aria-pressed={d === activeDir}
            onClick={() => handleDir(d)}
            style={{
              padding: '2px 10px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid',
              cursor: d === activeDir ? 'default' : 'pointer',
              background: d === activeDir ? '#2563eb' : '#fff',
              color: d === activeDir ? '#fff' : '#374151',
              borderColor: d === activeDir ? '#2563eb' : '#d1d5db',
              fontWeight: d === activeDir ? 700 : 400,
            }}
          >
            {DIRECTION_LABELS[d]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b', alignSelf: 'center' }}>
          断面方向: {DIRECTION_LABELS[activeDir]}
        </span>
      </div>

      {/* Floor rows */}
      <div style={{ position: 'relative', padding: '8px 16px' }}>
        {floors.map(floor => (
          <div
            key={floor.id}
            data-floor-level={floor.level ?? 0}
            style={{
              height: floorHeight,
              borderBottom: '1px solid #cbd5e1',
              borderLeft: '3px solid #64748b',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8,
              marginBottom: 2,
              background: '#fff',
              borderRadius: '0 4px 4px 0',
              fontSize: 12,
              color: '#1e293b',
            }}
          >
            <span style={{ fontWeight: 600, marginRight: 8, minWidth: 24 }}>
              {floor.name ?? `${floor.level}F`}
            </span>
            <div style={{
              flex: 1, height: '60%',
              background: '#e0e7ef',
              borderRadius: 2,
              opacity: 0.6,
            }} />
          </div>
        ))}

        {/* Vertical connection indicators */}
        {verticalLinks.length > 0 && (
          <div
            data-vertical-link="true"
            style={{
              position: 'absolute',
              right: 32,
              top: 8,
              bottom: 8,
              width: 3,
              background: 'linear-gradient(to bottom, #f59e0b, #d97706)',
              borderRadius: 2,
              opacity: 0.8,
            }}
            title={`縦接続: ${verticalLinks.length}件`}
          />
        )}
      </div>
    </div>
  )
}
