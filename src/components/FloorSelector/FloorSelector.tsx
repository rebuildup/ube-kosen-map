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
        gap: 2,
        padding: '4px 6px',
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
              padding: '5px 10px',
              borderRadius: 3,
              border: '1px solid',
              borderColor: isActive ? 'var(--accent)' : 'transparent',
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontWeight: isActive ? 700 : 400,
              fontSize: 11,
              letterSpacing: '0.04em',
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              textAlign: 'left',
              transition: 'all 0.1s',
            }}
          >
            {floor.name ?? `${floor.level}F`}
          </button>
        )
      })}
    </div>
  )
}
