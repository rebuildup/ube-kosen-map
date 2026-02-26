/**
 * Pseudo3DView — exploded-floor CSS 3D transform view.
 * [P-6] Mathematical Abstraction: each floor DOM element gets translateZ(level * spacing).
 * [§0] React DOM + CSS Transform; no Canvas/WebGL.
 * Parent container has perspective + rotateX + rotateY.
 * transform-style: preserve-3d propagates 3D positioning to children.
 */

import React, { useState, useRef, useCallback } from 'react'
import type { CampusGraph, BuildingId } from '../../core/schema/types'

export interface Pseudo3DViewProps {
  graph: CampusGraph
  buildingId: BuildingId
  floorSpacing?: number
  rotateX?: number
  rotateY?: number
  perspective?: number
  onSpacingChange?: (spacing: number) => void
  width?: number
  height?: number
}

const getFloors = (graph: CampusGraph, buildingId: BuildingId) =>
  Object.values(graph.floors)
    .filter(f => f.buildingId === buildingId)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))

export const Pseudo3DView: React.FC<Pseudo3DViewProps> = ({
  graph,
  buildingId,
  floorSpacing = 80,
  rotateX: rotateXProp,
  rotateY: rotateYProp,
  perspective = 800,
  onSpacingChange,
  width = 480,
  height = 400,
}) => {
  const [spacing, setSpacing] = useState(floorSpacing)
  const [rotX, setRotX] = useState(rotateXProp ?? 40)
  const [rotY, setRotY] = useState(rotateYProp ?? 30)

  // Controlled override
  const activeRotX = rotateXProp ?? rotX
  const activeRotY = rotateYProp ?? rotY

  const drag = useRef({ active: false, lastX: 0, lastY: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    drag.current = { active: true, lastX: e.clientX, lastY: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.lastX
    const dy = e.clientY - drag.current.lastY
    drag.current.lastX = e.clientX
    drag.current.lastY = e.clientY
    setRotY(prev => prev + dx * 0.4)
    setRotX(prev => Math.max(-80, Math.min(80, prev - dy * 0.4)))
  }, [])

  const onMouseUp = useCallback(() => { drag.current.active = false }, [])

  const handleSpacing = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setSpacing(v)
    onSpacingChange?.(v)
  }

  const floors = getFloors(graph, buildingId)

  return (
    <div
      aria-label="pseudo 3d view"
      style={{ width, userSelect: 'none' }}
    >
      {/* 3D viewport */}
      <div
        style={{
          width,
          height,
          perspective: `${perspective}px`,
          overflow: 'hidden',
          background: '#0f172a',
          borderRadius: 8,
          cursor: 'grab',
          position: 'relative',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* 3D scene container */}
        <div
          data-3d-scene="true"
          style={{
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${activeRotX}deg) rotateY(${activeRotY}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {floors.map(floor => {
            const level = floor.level ?? 0
            const z = level * (rotateXProp !== undefined ? floorSpacing : spacing)
            return (
              <div
                key={floor.id}
                data-floor-level={level}
                style={{
                  position: 'absolute',
                  width: 240,
                  height: 160,
                  transform: `translateZ(${z}px)`,
                  background: 'rgba(148, 163, 184, 0.25)',
                  border: '1.5px solid rgba(148,163,184,0.6)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e2e8f0',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {floor.name ?? `${level}F`}
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12, color: '#64748b' }}>
        <label htmlFor="spacing-slider">フロア間隔</label>
        <input
          id="spacing-slider"
          type="range"
          data-spacing-slider="true"
          min={20}
          max={200}
          value={rotateXProp !== undefined ? floorSpacing : spacing}
          onChange={handleSpacing}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: 32, textAlign: 'right' }}>{rotateXProp !== undefined ? floorSpacing : spacing}px</span>
      </div>
    </div>
  )
}
