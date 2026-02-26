/**
 * FloorSelector — UI for selecting the active floor in multi-floor editing.
 *
 * [P-4] Semantic Zoom: current floor is fully visible (opacity 1.0),
 *        adjacent floors are shown at reduced opacity for reference.
 */

import React from 'react'
import type { Floor } from '../../core/schema'

export interface FloorVisibility {
  floorId: string
  opacity: number
  isActive: boolean
}

export interface FloorSelectorProps {
  floors: Floor[]
  activeFloorId?: string
  onFloorChange?: (floorId: string) => void
}

/** Compute opacity for each floor relative to the active one */
export const computeFloorVisibility = (
  floors: Floor[],
  activeFloorId: string | undefined,
): FloorVisibility[] => {
  const activeIndex = floors.findIndex(f => f.id === activeFloorId)

  return floors.map((floor, idx) => {
    if (activeFloorId === undefined || activeIndex === -1) {
      return { floorId: floor.id, opacity: 1, isActive: idx === 0 }
    }
    const diff = Math.abs(idx - activeIndex)
    const opacity = diff === 0 ? 1 : diff === 1 ? 0.3 : 0
    return { floorId: floor.id, opacity, isActive: floor.id === activeFloorId }
  })
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  floors,
  activeFloorId,
  onFloorChange,
}) => {
  const sorted = [...floors].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))

  return (
    <div
      role="listbox"
      aria-label="floor selector"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 8,
        background: 'rgba(255,255,255,0.9)',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: 60,
      }}
    >
      {sorted.map(floor => {
        const isActive = floor.id === activeFloorId
        return (
          <button
            key={floor.id}
            role="option"
            aria-selected={isActive}
            data-floor-id={floor.id}
            onClick={() => onFloorChange?.(floor.id)}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              background: isActive ? '#dbeafe' : 'transparent',
              cursor: 'pointer',
              fontWeight: isActive ? 700 : 400,
              fontSize: 13,
              color: isActive ? '#1d4ed8' : '#374151',
            }}
          >
            {floor.name ?? `${floor.level}F`}
          </button>
        )
      })}
    </div>
  )
}
