/**
 * TraceEditor — full-page map editing application.
 *
 * Layout:
 *   [ToolBar] | [TraceEditorCanvas] | [BuildingFloorManager + AttributePanel + ValidationPanel]
 *
 * Wires together all editor subsystems:
 *   - useEditorState: central state (tool, graph, undo/redo, selection)
 *   - TraceEditorCanvas: snap-driven SVG drawing canvas
 *   - ToolBar: tool selection + undo/redo + load/save
 *   - AttributePanel: metadata editing (F2-2)
 *   - BuildingFloorManager: building/floor CRUD
 *   - ValidationPanel: real-time validation errors
 *   - LayerControl: layer visibility toggle
 *
 * [§0] React DOM only — no Canvas/WebGL
 * [P-1] Space drawing → node auto-placement at centroid
 * [P-2] snap engine filters every click position
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorState } from './useEditorState'
import { ToolBar } from './ToolBar'
import { TraceEditorCanvas } from './TraceEditorCanvas'
import { AttributePanel } from './AttributePanel'
import { BuildingFloorManager } from './BuildingFloorManager'
import { ValidationPanel } from '../components/ValidationPanel/ValidationPanel'
import { LayerControl } from '../components/LayerControl/LayerControl'
import { validate } from '../core/graph/validate'
import { addNode, addSpace } from '../core/graph/manager'
import { placeDoor } from '../core/autolink'
import { saveCampusGraph, loadCampusGraph } from '../core/graph/persistence'
import { createNodeId, createSpaceId } from '../core/schema/ids'
import { getLayerVisibility } from '../core/zoom'
import { identity as identityFn } from '../math'
import type { Mat3, Vec2 } from '../math'
import type { LayerVisibility } from '../core/zoom'

const INITIAL_VISIBILITY: LayerVisibility = { ...getLayerVisibility('Z4'), validation: true }

export const TraceEditor: React.FC = () => {
  const editor = useEditorState()
  const [matrix, setMatrix] = useState<Mat3>(identityFn)
  const [visibility, setVisibility] = useState<LayerVisibility>(INITIAL_VISIBILITY)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const validationResult = validate(editor.graph)

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.ctrlKey && e.key === 'z') { editor.undo(); return }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { editor.redo(); return }
      switch (e.key.toLowerCase()) {
        case 'v': editor.setTool('select'); break
        case 's': if (!e.ctrlKey) editor.setTool('space'); break
        case 'n': editor.setTool('node'); break
        case 'd': editor.setTool('door'); break
        case 'escape': editor.cancelDrawing(); editor.setTool('select'); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editor])

  // ── Space drawing: vertex add + polygon close ─────────────────────────────

  const handleVertexAdd = useCallback((worldPos: Vec2) => {
    const verts = editor.drawingVertices
    // Close polygon when clicking near the first vertex (or 3+ verts)
    const isClose = verts.length >= 3 &&
      Math.abs(worldPos.x - verts[0].x) < 12 &&
      Math.abs(worldPos.y - verts[0].y) < 12

    if (isClose) {
      // Confirm space: create Space + anchor Node at centroid
      const sid = createSpaceId()
      const nid = createNodeId()
      const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length
      const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length
      let g = editor.graph

      const spaceResult = addSpace(g, {
        id: sid,
        floorId: editor.activeFloorId as any,
        polygon: { vertices: [...verts] },
        name: 'スペース',
        type: 'other',
      })
      if (spaceResult.ok) g = spaceResult.value

      const nodeResult = addNode(g, {
        id: nid,
        position: { x: cx, y: cy },
        floorId: editor.activeFloorId as any,
        type: 'other',
      })
      if (nodeResult.ok) g = nodeResult.value

      editor.applyGraphUpdate(g)
      editor.cancelDrawing()
      editor.setTool('select')
    } else {
      editor.addDrawingVertex(worldPos)
    }
  }, [editor])

  // ── Node placement ────────────────────────────────────────────────────────

  const handleNodePlace = useCallback((worldPos: Vec2) => {
    const nid = createNodeId()
    const result = addNode(editor.graph, {
      id: nid,
      position: worldPos,
      floorId: editor.activeFloorId as any,
      type: 'other',
    })
    if (result.ok) editor.applyGraphUpdate(result.value)
  }, [editor])

  // ── Door placement ────────────────────────────────────────────────────────

  const handleDoorPlace = useCallback((worldPos: Vec2) => {
    const result = placeDoor(editor.graph, worldPos)
    if (result.ok) editor.applyGraphUpdate(result.value.graph)
  }, [editor])

  // ── Save / Load JSON ──────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const json = saveCampusGraph(editor.graph)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campus-graph.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [editor.graph])

  const handleLoadFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const g = loadCampusGraph(ev.target?.result as string)
        editor.applyGraphUpdate(g)
      } catch {
        alert('JSONの読み込みに失敗しました')
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be loaded again
    e.target.value = ''
  }, [editor])

  // ── Instruction hint for status bar ──────────────────────────────────────

  const hint = (() => {
    const n = editor.drawingVertices.length
    switch (editor.activeTool) {
      case 'space':
        if (n === 0) return 'クリックで頂点を追加 / 右クリックでキャンセル'
        if (n < 3) return `${n}頂点 — あと${3 - n}点以上で閉じられます`
        return `${n}頂点 — 最初の頂点をクリックで確定 / 右クリックでキャンセル`
      case 'node': return 'クリックでノードを配置'
      case 'door': return 'クリックで壁上にドアを配置'
      default: return '要素をクリックして選択'
    }
  })()

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-editor-root="true"
      style={{
        display: 'flex', width: '100vw', height: '100vh',
        background: '#0f172a', color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Left: tool palette */}
      <ToolBar
        activeTool={editor.activeTool}
        onToolChange={editor.setTool}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSave={handleSave}
        onLoad={() => fileInputRef.current?.click()}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadFile}
      />

      {/* Center: canvas + status bar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Status bar */}
        <div style={{
          height: 36, flexShrink: 0,
          background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        }}>
          <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: 13 }}>TraceEditor</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{hint}</span>
          {editor.activeFloorId && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
              フロア: {editor.graph.floors[editor.activeFloorId]?.name ?? editor.activeFloorId}
            </span>
          )}
        </div>

        {/* Drawing canvas */}
        <TraceEditorCanvas
          graph={editor.graph}
          matrix={matrix}
          setMatrix={setMatrix}
          activeTool={editor.activeTool}
          drawingVertices={editor.drawingVertices}
          activeFloorId={editor.activeFloorId}
          onVertexAdd={handleVertexAdd}
          onCancel={editor.cancelDrawing}
          onSelect={editor.selectElement}
          onNodePlace={handleNodePlace}
          onDoorPlace={handleDoorPlace}
        />
      </div>

      {/* Right: property sidebars */}
      <div style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid #334155', overflow: 'hidden',
      }}>
        {/* Building / floor manager */}
        <div style={{ borderBottom: '1px solid #334155', maxHeight: 220, overflowY: 'auto' }}>
          <BuildingFloorManager
            graph={editor.graph}
            activeFloorId={editor.activeFloorId}
            onGraphUpdate={editor.applyGraphUpdate}
            onFloorSelect={editor.setActiveFloor}
          />
        </div>

        {/* Attribute panel */}
        <div style={{ flex: 1, overflowY: 'auto', borderBottom: '1px solid #334155' }}>
          <AttributePanel
            graph={editor.graph}
            selectedId={editor.selectedId}
            selectedKind={editor.selectedKind}
            onUpdate={editor.applyGraphUpdate}
          />
        </div>

        {/* Layer control */}
        <div style={{ padding: 8, borderBottom: '1px solid #334155' }}>
          <LayerControl
            visibility={visibility}
            onChange={setVisibility}
            isEditorMode
          />
        </div>

        {/* Validation panel */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ValidationPanel
            result={validationResult}
            onFocus={ids => editor.selectElement(ids[0] ?? null, 'node')}
          />
        </div>
      </div>
    </div>
  )
}
