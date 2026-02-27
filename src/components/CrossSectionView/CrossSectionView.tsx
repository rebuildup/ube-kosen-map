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
    e.isVertical && nodeFloor.has(e.sourceNodeId) && nodeFloor.has(e.targetNodeId),
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
      style={{ width, background: 'var(--bg-1)', border: '1px solid var(--border-1)', borderRadius: 4, overflow: 'hidden' }}
    >
      {/* Direction selector */}
      <div style={{ display: 'flex', gap: 4, padding: 8, background: 'var(--bg-2)', borderBottom: '1px solid var(--border-1)' }}>
        {DIRECTIONS.map(d => (
          <button
            key={d}
            data-direction={d}
            aria-pressed={d === activeDir}
            onClick={() => handleDir(d)}
            style={{
              padding: '2px 10px',
              fontSize: 10,
              borderRadius: 2,
              border: '1px solid',
              cursor: d === activeDir ? 'default' : 'pointer',
              background: d === activeDir ? 'var(--accent-bg)' : 'transparent',
              color: d === activeDir ? 'var(--accent)' : 'var(--text-2)',
              borderColor: d === activeDir ? 'var(--accent)' : 'var(--border-2)',
              fontWeight: d === activeDir ? 700 : 400,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {DIRECTION_LABELS[d]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-3)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>
          {DIRECTION_LABELS[activeDir]}
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
              borderBottom: '1px solid var(--border-1)',
              borderLeft: '3px solid var(--border-2)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8,
              marginBottom: 2,
              background: 'var(--bg-2)',
              borderRadius: '0 3px 3px 0',
              fontSize: 11,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ fontWeight: 600, marginRight: 8, minWidth: 24, color: 'var(--text-1)' }}>
              {floor.name ?? `${floor.level}F`}
            </span>
            <div style={{
              flex: 1, height: '40%',
              background: 'var(--border-2)',
              borderRadius: 2,
              opacity: 0.5,
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
              background: 'linear-gradient(to bottom, var(--amber), var(--orange))',
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
