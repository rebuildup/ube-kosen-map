/**
 * TraceEditorCanvas — interactive editing overlay on top of a graph-aware SVG canvas.
 *
 * Renders:
 *   - All graph elements (spaces, edges, nodes) in world-space SVG
 *   - In-progress polygon when space tool is active (dashed lines + vertex circles)
 *   - Snap indicator at current mouse position
 *
 * Fires callbacks for vertex placement, node placement, door placement, cancel.
 * Pan/zoom/rotate are delegated to useGestures.
 *
 * [§0] React DOM + SVG — no Canvas/WebGL
 * [P-2] Every mouse position is filtered through the snap engine before firing callbacks
 * [P-6] Screen↔world conversion via Mat3 inversion
 */

import React, { useRef, useState, useCallback } from 'react'
import type { CampusGraph } from '../core/schema'
import type { Vec2, Mat3 } from '../math'
import { invert, transformPoint } from '../math'
import { findSnap } from '../core/snap'
import type { SnapResult } from '../core/snap'
import { useGestures } from '../components/CampusMap/useGestures'
import { matToTransform } from '../components/CampusMap/useViewTransform'
import type { EditorTool } from './useEditorState'

export interface TraceEditorCanvasProps {
  graph: CampusGraph
  matrix: Mat3
  setMatrix: (m: Mat3 | ((prev: Mat3) => Mat3)) => void
  activeTool: EditorTool
  drawingVertices: Vec2[]
  activeFloorId?: string | null
  onVertexAdd: (worldPos: Vec2) => void
  onCancel: () => void
  onSelect: (id: string | null, kind: 'node' | 'edge' | 'space' | null) => void
  onNodePlace: (worldPos: Vec2) => void
  onDoorPlace: (worldPos: Vec2) => void
}

// ── Snap context helpers ──────────────────────────────────────────────────────

const collectVertices = (graph: CampusGraph, floorId?: string | null): Vec2[] => {
  const verts: Vec2[] = []
  for (const node of Object.values(graph.nodes)) {
    if (floorId && node.floorId !== floorId) continue
    if (node.position) verts.push(node.position)
  }
  for (const space of Object.values(graph.spaces)) {
    if (space.polygon?.vertices) verts.push(...space.polygon.vertices)
  }
  return verts
}

const collectSegments = (graph: CampusGraph): [Vec2, Vec2][] => {
  const segs: [Vec2, Vec2][] = []
  for (const space of Object.values(graph.spaces)) {
    const verts = space.polygon?.vertices ?? []
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i]
      const b = verts[(i + 1) % verts.length]
      if (a && b) segs.push([a, b])  // noUncheckedIndexedAccess guard
    }
  }
  return segs
}

// ── Snap indicator colors ─────────────────────────────────────────────────────

const SNAP_COLORS: Record<string, string> = {
  vertex: '#3b82f6',
  edge: '#10b981',
  orthogonal: '#06b6d4',
  grid: '#6b7280',
  free: 'transparent',
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TraceEditorCanvas: React.FC<TraceEditorCanvasProps> = ({
  graph, matrix, setMatrix,
  activeTool, drawingVertices, activeFloorId,
  onVertexAdd, onCancel, onSelect, onNodePlace, onDoorPlace,
}) => {
  const [snap, setSnap] = useState<SnapResult | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gestures = useGestures(matrix, setMatrix)

  const screenToWorld = useCallback((sx: number, sy: number): Vec2 => {
    const inv = invert(matrix)
    if (!inv) return { x: sx, y: sy }
    return transformPoint(inv, { x: sx, y: sy })
  }, [matrix])

  const toScreen = useCallback((w: Vec2) => transformPoint(matrix, w), [matrix])

  // ── Mouse move: update snap indicator ──────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    gestures.onMouseMove(e)
    if (activeTool === 'select') return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const result = findSnap(world, {
      vertices: collectVertices(graph, activeFloorId),
      segments: collectSegments(graph),
      previousPoint: drawingVertices[drawingVertices.length - 1],
    })
    setSnap(result)
  }, [activeTool, graph, activeFloorId, drawingVertices, screenToWorld, gestures])

  // ── Click: place vertex / node / door ──────────────────────────────────────

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const world = snap?.position ?? screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    if (activeTool === 'space') onVertexAdd(world)
    else if (activeTool === 'node') onNodePlace(world)
    else if (activeTool === 'door') onDoorPlace(world)
  }, [activeTool, snap, screenToWorld, onVertexAdd, onNodePlace, onDoorPlace])

  // ── Right-click: cancel drawing ────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onCancel()
  }, [onCancel])

  const transformStr = matToTransform(matrix)

  // ── Build SVG drawing overlays (screen-space) ──────────────────────────────

  const drawingLines: React.ReactNode[] = []
  const drawingCircles: React.ReactNode[] = []

  for (let i = 0; i < drawingVertices.length; i++) {
    const v = drawingVertices[i]
    if (!v) continue  // noUncheckedIndexedAccess guard
    const s = toScreen(v)
    drawingCircles.push(
      <circle
        key={`dv-${i}`}
        data-drawing-vertex={i}
        cx={s.x} cy={s.y} r={4}
        fill="#3b82f6" stroke="#fff" strokeWidth={1.5}
      />,
    )
    if (i > 0) {
      const pv = drawingVertices[i - 1]
      if (!pv) continue  // noUncheckedIndexedAccess guard
      const prev = toScreen(pv)
      drawingLines.push(
        <line
          key={`dl-${i}`}
          data-drawing-line={i}
          x1={prev.x} y1={prev.y} x2={s.x} y2={s.y}
          stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 3"
        />,
      )
    }
  }

  // Ghost line: last placed vertex → current snap position
  const lastVertex = drawingVertices[drawingVertices.length - 1]
  if (drawingVertices.length > 0 && snap && lastVertex) {
    const last = toScreen(lastVertex)
    const sp = toScreen(snap.position)
    drawingLines.push(
      <line
        key="ghost"
        x1={last.x} y1={last.y} x2={sp.x} y2={sp.y}
        stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" opacity={0.5}
      />,
    )
  }

  // Snap indicator circle
  let snapIndicator: React.ReactNode = null
  if (snap && activeTool !== 'select') {
    const sp = toScreen(snap.position)
    const color = SNAP_COLORS[snap.type] ?? '#fff'
    snapIndicator = (
      <circle
        cx={sp.x} cy={sp.y}
        r={snap.type === 'vertex' ? 7 : 5}
        fill="none" stroke={color} strokeWidth={2} opacity={0.9}
      />
    )
  }

  // ── Graph element rendering (world-space, inside SVG transform) ────────────

  const spaces = Object.values(graph.spaces)
  const edges  = Object.values(graph.edges)
  const nodes  = Object.values(graph.nodes)

  return (
    <div
      ref={containerRef}
      data-editor-canvas="true"
      className="canvas-grid"
      style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        cursor: activeTool === 'select' ? 'default' : 'crosshair',
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={gestures.onMouseDown}
      onMouseUp={gestures.onMouseUp}
      onMouseLeave={gestures.onMouseLeave}
      onClick={handleClick}
      onDoubleClick={gestures.onDoubleClick}
      onContextMenu={handleContextMenu}
      onWheel={gestures.onWheel}
      onTouchStart={gestures.onTouchStart}
      onTouchMove={gestures.onTouchMove}
      onTouchEnd={gestures.onTouchEnd}
    >
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        {/* World-space graph content */}
        <g transform={transformStr}>
          {/* Spaces */}
          {spaces.map(s => {
            const pts = (s.polygon?.vertices ?? []).map(v => `${v.x},${v.y}`).join(' ')
            return pts ? (
              <polygon
                key={s.id}
                data-space-id={s.id}
                points={pts}
                fill="rgba(16,185,129,0.15)"
                stroke="#10b981"
                strokeWidth={1.5}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={activeTool === 'select' ? () => onSelect(s.id, 'space') : undefined}
              />
            ) : null
          })}

          {/* Edges */}
          {edges.map(e => {
            const a = graph.nodes[e.sourceNodeId]?.position
            const b = graph.nodes[e.targetNodeId]?.position
            if (!a || !b) return null
            return (
              <line
                key={e.id}
                data-edge-id={e.id}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#f97316" strokeWidth={2}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={activeTool === 'select' ? () => onSelect(e.id, 'edge') : undefined}
              />
            )
          })}

          {/* Nodes */}
          {nodes.map(n => {
            if (!n.position) return null
            return (
              <circle
                key={n.id}
                data-node-id={n.id}
                cx={n.position.x} cy={n.position.y} r={5}
                fill="#60a5fa" stroke="#fff" strokeWidth={1.5}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={activeTool === 'select' ? () => onSelect(n.id, 'node') : undefined}
              />
            )
          })}
        </g>

        {/* Screen-space drawing overlays */}
        {drawingLines}
        {drawingCircles}
        {snapIndicator}
      </svg>
    </div>
  )
}
