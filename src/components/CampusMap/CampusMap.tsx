/**
 * CampusMap — Minimal map rendering component.
 *
 * Renders a CampusGraph using React DOM only:
 * - Spaces: SVG <polygon>
 * - Edges:  SVG <line>
 * - Nodes:  <div> with absolute positioning
 *
 * [§0] React DOM rendering; no Canvas / WebGL.
 * [P-1] Graph topology is visually represented as nodes and edges.
 * [P-6] View transform managed as a 3×3 affine matrix.
 */

import React, { useRef, useCallback } from 'react'
import type { CampusGraph, NodeId } from '../../core/schema'
import { useViewTransform, matToTransform, transformPoint } from './useViewTransform'

export interface CampusMapProps {
  graph: CampusGraph
  width?: number
  height?: number
  selectedNodeId?: NodeId | string
  onNodeClick?: (nodeId: string) => void
  /** Optional base floor plan image URL */
  baseImageUrl?: string
}

export const CampusMap: React.FC<CampusMapProps> = ({
  graph,
  width = 800,
  height = 600,
  selectedNodeId,
  onNodeClick,
  baseImageUrl,
}) => {
  const { matrix, zoom, pan } = useViewTransform()
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // ── Wheel zoom ──────────────────────────────────────────────────────────────

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    zoom(factor, cx, cy)
  }, [zoom])

  // ── Drag pan ────────────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    pan(dx, dy)
  }, [pan])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  const worldToScreen = useCallback(
    (x: number, y: number) => transformPoint(matrix, { x, y }),
    [matrix],
  )

  const transformStr = matToTransform(matrix)

  // ── Render ──────────────────────────────────────────────────────────────────

  const nodes  = Object.values(graph.nodes)
  const edges  = Object.values(graph.edges)
  const spaces = Object.values(graph.spaces)

  return (
    <div
      data-campusmap-viewport="true"
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Base floor plan image */}
      {baseImageUrl && (
        <img
          src={baseImageUrl}
          alt="floor plan"
          style={{
            position: 'absolute',
            inset: 0,
            transform: transformStr,
            transformOrigin: '0 0',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* SVG layer: spaces + edges */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        aria-hidden="true"
      >
        <g transform={transformStr}>
          {/* Spaces */}
          {spaces.map(space => {
            const verts = space.polygon?.vertices ?? []
            if (verts.length < 3) return null
            const points = verts.map(v => `${v.x},${v.y}`).join(' ')
            return (
              <polygon
                key={space.id}
                data-space-id={space.id}
                points={points}
                fill="rgba(100, 160, 220, 0.15)"
                stroke="rgba(100, 160, 220, 0.6)"
                strokeWidth={1}
              />
            )
          })}

          {/* Edges */}
          {edges.map(edge => {
            const src = graph.nodes[edge.sourceNodeId]
            const dst = graph.nodes[edge.targetNodeId]
            const sp = src?.position ?? { x: 0, y: 0 }
            const dp = dst?.position ?? { x: 0, y: 0 }
            return (
              <line
                key={edge.id}
                data-edge-id={edge.id}
                x1={sp.x}
                y1={sp.y}
                x2={dp.x}
                y2={dp.y}
                stroke="#6b7280"
                strokeWidth={2}
              />
            )
          })}
        </g>
      </svg>

      {/* Node layer: DOM divs */}
      {nodes.map(node => {
        const pos = node.position ?? { x: 0, y: 0 }
        const screen = worldToScreen(pos.x, pos.y)
        const isSelected = node.id === selectedNodeId

        return (
          <div
            key={node.id}
            data-node-id={node.id}
            aria-selected={isSelected}
            role="button"
            tabIndex={0}
            title={node.label ?? node.id}
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isSelected ? '#ef4444' : '#3b82f6',
              border: `2px solid ${isSelected ? '#b91c1c' : '#1d4ed8'}`,
              cursor: 'pointer',
              zIndex: 10,
            }}
            onClick={e => {
              e.stopPropagation()
              onNodeClick?.(node.id)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onNodeClick?.(node.id)
              }
            }}
          />
        )
      })}
    </div>
  )
}
