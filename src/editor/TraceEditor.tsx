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
import { ReferencePanel } from './ReferencePanel'
import type { ReferenceImageState } from './useReferenceImage'
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
  type StoredReference = ReferenceImageState & { id: string, name: string, pdfBytes: Uint8Array | null }
  const [references, setReferences] = useState<StoredReference[]>([])
  const [activeReferenceId, setActiveReferenceId] = useState<string | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const refFileInputRef = useRef<HTMLInputElement>(null)
  const validationResult = validate(editor.graph)
  const activeReference = references.find((ref) => ref.id === activeReferenceId) ?? null

  const createReferenceId = useCallback(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }, [])

  const updateActiveReference = useCallback((updater: (prev: StoredReference) => StoredReference) => {
    if (!activeReferenceId) return
    setReferences((prev) => prev.map((item) => (item.id === activeReferenceId ? updater(item) : item)))
  }, [activeReferenceId])

  const setActiveCrop = useCallback((cropX: number, cropY: number, cropWidth: number, cropHeight: number) => {
    updateActiveReference((s) => {
      const maxX = Math.max(0, s.naturalWidth - 1)
      const maxY = Math.max(0, s.naturalHeight - 1)
      const safeX = Math.min(maxX, Math.max(0, cropX))
      const safeY = Math.min(maxY, Math.max(0, cropY))
      const safeWidth = Math.min(Math.max(1, s.naturalWidth - safeX), Math.max(1, cropWidth))
      const safeHeight = Math.min(Math.max(1, s.naturalHeight - safeY), Math.max(1, cropHeight))
      return { ...s, cropX: safeX, cropY: safeY, cropWidth: safeWidth, cropHeight: safeHeight }
    })
  }, [updateActiveReference])

  const setActiveRaw = useCallback((dataUrl: string, w: number, h: number, pageCount = 1, currentPage = 1) => {
    updateActiveReference((s) => {
      const safeW = Math.max(1, w)
      const safeH = Math.max(1, h)
      const safePageCount = Math.max(1, pageCount)
      const safePage = Math.min(Math.max(1, currentPage), safePageCount)
      return {
        ...s,
        dataUrl,
        naturalWidth: safeW,
        naturalHeight: safeH,
        cropX: 0,
        cropY: 0,
        cropWidth: safeW,
        cropHeight: safeH,
        pageCount: safePageCount,
        currentPage: safePage,
      }
    })
  }, [updateActiveReference])

  const removeActiveReference = useCallback(() => {
    if (!activeReferenceId) return
    setReferences((prev) => {
      const filtered = prev.filter((item) => item.id !== activeReferenceId)
      setActiveReferenceId(filtered[0]?.id ?? null)
      return filtered
    })
  }, [activeReferenceId])

  const readAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result)
          return
        }
        reject(new Error('Unsupported file content'))
      }
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }, [])

  const loadImageNaturalSize = useCallback((dataUrl: string): Promise<{ width: number, height: number }> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const width = image.naturalWidth > 0 ? image.naturalWidth : 1000
        const height = image.naturalHeight > 0 ? image.naturalHeight : 1000
        resolve({ width, height })
      }
      image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      image.src = dataUrl
    })
  }, [])

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
    const firstVert = verts[0]  // noUncheckedIndexedAccess: Vec2 | undefined
    const isClose = verts.length >= 3 && firstVert != null &&
      Math.abs(worldPos.x - firstVert.x) < 12 &&
      Math.abs(worldPos.y - firstVert.y) < 12

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

  const handleRefFileLoad = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setReferenceError(null)
    const id = createReferenceId()
    const name = file.name
    const base: StoredReference = {
      id,
      name,
      dataUrl: null,
      opacity: 0.5,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      naturalWidth: 1,
      naturalHeight: 1,
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
      pageCount: 1,
      currentPage: 1,
      pdfBytes: null,
    }
    setReferences((prev) => [...prev, base])
    setActiveReferenceId(id)

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        setReferences((prev) => prev.map((item) => (
          item.id === id ? { ...item, pdfBytes: bytes, currentPage: 1 } : item
        )))
        return
      }

      const dataUrl = await readAsDataUrl(file)
      const size = await loadImageNaturalSize(dataUrl)
      setReferences((prev) => prev.map((item) => (
        item.id === id
          ? {
              ...item,
              dataUrl,
              naturalWidth: size.width,
              naturalHeight: size.height,
              cropX: 0,
              cropY: 0,
              cropWidth: size.width,
              cropHeight: size.height,
              pageCount: 1,
              currentPage: 1,
              pdfBytes: null,
            }
          : item
      )))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setReferenceError(`リファレンスの読み込みに失敗しました: ${message}`)
      setReferences((prev) => prev.filter((item) => item.id !== id))
      setActiveReferenceId((current) => (current === id ? null : current))
    }
  }, [createReferenceId, loadImageNaturalSize, readAsDataUrl])

  useEffect(() => {
    if (!activeReference?.pdfBytes) return
    let cancelled = false

    const run = async () => {
      try {
        const currentPage = activeReference.currentPage
        const { loadPdfPage } = await import('./loadPdfPage')
        const pageImage = await loadPdfPage(activeReference.pdfBytes, currentPage)
        if (cancelled) return
        setActiveRaw(
          pageImage.dataUrl,
          pageImage.width,
          pageImage.height,
          pageImage.pageCount,
          currentPage,
        )
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'unknown error'
        setReferenceError(`PDFの描画に失敗しました: ${message}`)
      }
    }

    void run()
    return () => { cancelled = true }
  }, [activeReference?.id, activeReference?.pdfBytes, activeReference?.currentPage, setActiveRaw])

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
        display: 'flex', width: '100%', height: '100%',
        background: 'var(--bg-1)', color: 'var(--text-1)',
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
      <input
        ref={refFileInputRef}
        type="file"
        accept=".pdf,.svg,.png,.jpg,.jpeg,.webp,.gif,.bmp"
        style={{ display: 'none' }}
        onChange={(e) => { void handleRefFileLoad(e) }}
      />

      {/* Center: canvas + status bar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Status bar */}
        <div style={{
          height: 30, flexShrink: 0,
          background: 'var(--bg-2)', borderBottom: '1px solid var(--border-1)',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.05em' }}>
            {hint}
          </span>
          {editor.activeFloorId && (
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>
              FL / {editor.graph.floors[editor.activeFloorId]?.name ?? editor.activeFloorId}
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
          referenceImages={references}
        />
      </div>

      {/* Right: property sidebars */}
      <div style={{
        width: 248, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--border-1)', background: 'var(--bg-2)', overflow: 'hidden',
      }}>
        {/* Building / floor manager */}
        <div style={{ borderBottom: '1px solid var(--border-1)', maxHeight: 220, overflowY: 'auto' }}>
          <div className="panel-label">建物・フロア</div>
          <BuildingFloorManager
            graph={editor.graph}
            activeFloorId={editor.activeFloorId}
            onGraphUpdate={editor.applyGraphUpdate}
            onFloorSelect={editor.setActiveFloor}
          />
        </div>

        {/* Attribute panel */}
        <div style={{ flex: 1, overflowY: 'auto', borderBottom: '1px solid var(--border-1)' }}>
          <div className="panel-label">属性</div>
          <AttributePanel
            graph={editor.graph}
            selectedId={editor.selectedId}
            selectedKind={editor.selectedKind}
            onUpdate={editor.applyGraphUpdate}
          />
        </div>

        {/* Layer control */}
        <div style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="panel-label">レイヤー</div>
          <LayerControl
            visibility={visibility}
            onChange={setVisibility}
            isEditorMode
          />
        </div>

        {/* Reference panel */}
        <div style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="panel-label">リファレンス</div>
          <ReferencePanel
            references={references.map((item) => ({ id: item.id, name: item.name, ref: item }))}
            activeId={activeReferenceId}
            onSelect={setActiveReferenceId}
            onAdd={() => refFileInputRef.current?.click()}
            onRemoveActive={removeActiveReference}
            actions={{
              setOpacity: (v) => updateActiveReference((s) => ({ ...s, opacity: Math.max(0, Math.min(1, v)) })),
              setX: (v) => updateActiveReference((s) => ({ ...s, x: v })),
              setY: (v) => updateActiveReference((s) => ({ ...s, y: v })),
              setScale: (v) => updateActiveReference((s) => ({ ...s, scale: Math.max(0.01, v) })),
              setRotation: (v) => updateActiveReference((s) => ({ ...s, rotation: v })),
              setCrop: setActiveCrop,
              setCurrentPage: (page) => updateActiveReference((s) => ({
                ...s,
                currentPage: Math.min(Math.max(1, page), Math.max(1, s.pageCount)),
              })),
            }}
          />
          {referenceError && (
            <div style={{ padding: '0 10px 10px', color: 'var(--red)', fontSize: 11 }}>
              {referenceError}
            </div>
          )}
        </div>

        {/* Validation panel */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="panel-label">バリデーション</div>
          <ValidationPanel
            result={validationResult}
            onFocus={ids => editor.selectElement(ids[0] ?? null, 'node')}
          />
        </div>
      </div>
    </div>
  )
}
