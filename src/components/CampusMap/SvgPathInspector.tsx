// src/components/CampusMap/SvgPathInspector.tsx
import React, { useMemo, useState, useRef, useCallback, useEffect, memo } from 'react'
import { groupSvgPaths } from '../../importer/svg/groupSvgPaths'
import { applyShapeEdits } from './page1ShapeEdits'
import { buildBridgeSegments, buildPathEndpointMap, collectShapeVertexStats } from './shapeVertexEditor'
import type { Page1InspectConfig, PathStatus, CustomShape, ShapeEditConfig, ShapeVertexRef } from './page1InspectTypes'

export interface SvgPathInspectorProps {
  rawSvg: string
  keepGroups?: number[]
  excludeText?: boolean
  hiddenPathRanges?: Array<{ group?: number; start: number; end: number }>
  /** 初期設定。保存ボタンで data/ に保存（dev 時）。 */
  initialConfig?: Page1InspectConfig
  configFileName?: string
}

const STATUS_ORDER: PathStatus[] = ['incomplete', 'completed', 'deleted']
const clampZoom = (v: number) => Math.max(0.1, Math.min(20, v))

async function saveConfigToRepo(filename: string, data: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, config: data }),
    })
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` }
    return json
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export const SvgPathInspector: React.FC<SvgPathInspectorProps> = ({
  rawSvg,
  keepGroups,
  excludeText,
  hiddenPathRanges,
  initialConfig,
  configFileName = 'page1-inspect-config.json',
}) => {
  const { groups, svgInnerHTML, viewBox } = useMemo(
    () => groupSvgPaths(rawSvg),
    [rawSvg],
  )

  const keepGroupSet = useMemo(
    () => (keepGroups && keepGroups.length > 0 ? new Set(keepGroups) : null),
    [keepGroups],
  )

  const allPaths = useMemo(() => {
    const out: { pathIndex: number; groupIndex: number }[] = []
    for (const g of groups) {
      if (keepGroupSet !== null && !keepGroupSet.has(g.index)) continue
      for (const shape of g.shapes) {
        for (const p of shape.paths) {
          out.push({ pathIndex: p.pathIndex, groupIndex: g.index })
        }
      }
    }
    return out.sort((a, b) => a.pathIndex - b.pathIndex)
  }, [groups, keepGroupSet])

  const baseConfig = useMemo(
    () => initialConfig ?? { keepGroups: keepGroups ?? [], hiddenPathRanges: hiddenPathRanges ?? [], pathStatus: {}, shapeStatus: {}, customShapes: [], hiddenShapeIds: [], shapeEdits: { bridges: [], relations: [], merges: [], splits: [] } },
    [initialConfig, keepGroups, hiddenPathRanges],
  )
  const emptyShapeEdits = useMemo<ShapeEditConfig>(() => ({
    bridges: baseConfig.shapeEdits?.bridges ?? [],
    relations: baseConfig.shapeEdits?.relations ?? [],
    merges: baseConfig.shapeEdits?.merges ?? [],
    splits: baseConfig.shapeEdits?.splits ?? [],
  }), [baseConfig.shapeEdits])

  const initialEntry = useMemo(() => ({
    pathStatus: baseConfig.pathStatus ?? {},
    customShapes: baseConfig.customShapes ?? [],
  }), [baseConfig.pathStatus, baseConfig.customShapes])

  type HistoryEntry = { pathStatus: Record<number, PathStatus>; customShapes: CustomShape[] }
  const [historyState, setHistoryState] = useState<{ history: HistoryEntry[]; index: number }>(() => ({ history: [initialEntry], index: 0 }))

  const pathStatus = historyState.history[historyState.index]?.pathStatus ?? initialEntry.pathStatus
  const customShapes = historyState.history[historyState.index]?.customShapes ?? initialEntry.customShapes
  const [shapeEdits, setShapeEdits] = useState<ShapeEditConfig>(emptyShapeEdits)
  const [shapeStatus, setShapeStatus] = useState<Record<string, PathStatus>>(baseConfig.shapeStatus ?? {})
  const [shapeHeights, setShapeHeights] = useState<Record<string, number>>(baseConfig.shapeHeights ?? {})
  const [editorMode, setEditorMode] = useState<'path' | 'shape'>('path')
  const [selectedVertices, setSelectedVertices] = useState<Array<{ shapeId: string; key: string; ref: ShapeVertexRef }>>([])
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [heightDraft, setHeightDraft] = useState<string>('0')
  const effectiveShapes = useMemo(
    () => applyShapeEdits(customShapes, shapeEdits),
    [customShapes, shapeEdits],
  )
  const pathEndpointMap = useMemo(() => buildPathEndpointMap(groups), [groups])
  const bridgeSegments = useMemo(
    () => buildBridgeSegments(shapeEdits.bridges ?? [], pathEndpointMap),
    [shapeEdits.bridges, pathEndpointMap],
  )
  const shapeVertexInfo = useMemo(() => {
    const out = new Map<string, ReturnType<typeof collectShapeVertexStats>>()
    for (const shape of effectiveShapes) {
      out.set(shape.id, collectShapeVertexStats(shape, pathEndpointMap, shapeEdits.bridges ?? []))
    }
    return out
  }, [effectiveShapes, pathEndpointMap, shapeEdits.bridges])

  const setPathStatus = useCallback((updater: (prev: Record<number, PathStatus>) => Record<number, PathStatus>) => {
    setHistoryState(prev => {
      const current = prev.history[prev.index]
      const nextPathStatus = updater(current?.pathStatus ?? initialEntry.pathStatus)
      const truncated = prev.history.slice(0, prev.index + 1)
      const newEntry: HistoryEntry = { pathStatus: nextPathStatus, customShapes: current?.customShapes ?? initialEntry.customShapes }
      return { history: [...truncated, newEntry], index: prev.index + 1 }
    })
  }, [initialEntry])

  const setCustomShapes = useCallback((updater: (prev: CustomShape[]) => CustomShape[]) => {
    setHistoryState(prev => {
      const current = prev.history[prev.index]
      const nextCustomShapes = updater(current?.customShapes ?? initialEntry.customShapes)
      const truncated = prev.history.slice(0, prev.index + 1)
      const newEntry: HistoryEntry = { pathStatus: current?.pathStatus ?? initialEntry.pathStatus, customShapes: nextCustomShapes }
      return { history: [...truncated, newEntry], index: prev.index + 1 }
    })
  }, [initialEntry])

  const undo = useCallback(() => {
    setHistoryState(prev => (prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev))
  }, [])
  const redo = useCallback(() => {
    setHistoryState(prev => (prev.index < prev.history.length - 1 ? { ...prev, index: prev.index + 1 } : prev))
  }, [])
  const [selectedPaths, setSelectedPaths] = useState<Set<number>>(new Set())
  const [shapeModalOpen, setShapeModalOpen] = useState(false)
  const [pendingShapePaths, setPendingShapePaths] = useState<number[]>([])

  const [hiddenGroups, setHiddenGroups] = useState<Set<number>>(new Set())
  const [hiddenPaths, setHiddenPaths] = useState<Set<number>>(new Set())
  const [hiddenShapes, setHiddenShapes] = useState<Set<string>>(() => new Set(initialConfig?.hiddenShapeIds ?? []))
  const lastAppliedConfigRef = useRef<Page1InspectConfig | undefined>(undefined)
  useEffect(() => {
    if (initialConfig == null) return
    if (lastAppliedConfigRef.current === initialConfig) return
    lastAppliedConfigRef.current = initialConfig
    if (initialConfig.hiddenShapeIds != null) {
      setHiddenShapes(new Set(initialConfig.hiddenShapeIds))
    }
    setShapeStatus(initialConfig.shapeStatus ?? {})
    setShapeHeights(initialConfig.shapeHeights ?? {})
    setShapeEdits({
      bridges: initialConfig.shapeEdits?.bridges ?? [],
      relations: initialConfig.shapeEdits?.relations ?? [],
      merges: initialConfig.shapeEdits?.merges ?? [],
      splits: initialConfig.shapeEdits?.splits ?? [],
    })
  }, [initialConfig])
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null)
  const [hoveredPath, setHoveredPath] = useState<number | null>(null)
  const [hoveredShape, setHoveredShape] = useState<string | null>(null)
  const hoverPathPendingRef = useRef<number | null>(null)
  const hoverPathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const HOVER_THROTTLE_MS = 50
  const setHoveredPathThrottled = useCallback((value: number | null) => {
    hoverPathPendingRef.current = value
    if (hoverPathTimerRef.current != null) return
    hoverPathTimerRef.current = setTimeout(() => {
      setHoveredPath(hoverPathPendingRef.current)
      hoverPathTimerRef.current = null
    }, HOVER_THROTTLE_MS)
  }, [])
  const [deletedSectionOpen, setDeletedSectionOpen] = useState(false)
  const [pathListTab, setPathListTab] = useState<'incomplete' | 'completed'>('incomplete')
  const [confirmedSectionOpen, setConfirmedSectionOpen] = useState(false)
  const [shapesSectionOpen, setShapesSectionOpen] = useState(false)
  const [vertexSectionOpen, setVertexSectionOpen] = useState(true)
  const [selectedListOpen, setSelectedListOpen] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [rotation, setRotation] = useState(0)
  const dragRef = useRef<{ mode: 'pan' | 'select' | 'rotate'; x: number; y: number; startX: number; startY: number; startRotation: number; moved: boolean } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const getPathStatus = useCallback((pathIndex: number): PathStatus => {
    return pathStatus[pathIndex] ?? 'incomplete'
  }, [pathStatus])

  const setPathStatusAt = useCallback((pathIndex: number, status: PathStatus) => {
    setPathStatus(prev => ({ ...prev, [pathIndex]: status }))
  }, [setPathStatus])

  const cyclePathStatus = useCallback((pathIndex: number) => {
    const current = getPathStatus(pathIndex)
    const idx = STATUS_ORDER.indexOf(current)
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]!
    setPathStatusAt(pathIndex, next)
  }, [getPathStatus, setPathStatusAt])

  const togglePathSelection = useCallback((pathIndex: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(pathIndex)) next.delete(pathIndex)
      else next.add(pathIndex)
      return next
    })
  }, [])

  const openShapeModal = useCallback(() => {
    if (selectedPaths.size === 0) return
    setPendingShapePaths([...selectedPaths].sort((a, b) => a - b))
    setShapeModalOpen(true)
  }, [selectedPaths])

  const confirmCreateShape = useCallback((isClosed: boolean, hasFill: boolean, fillColor?: string) => {
    const id = `cs-${Date.now()}`
    setCustomShapes(prev => [...prev, { id, pathIndices: pendingShapePaths, isClosed, hasFill, fillColor }])
    setShapeModalOpen(false)
    setSelectedPaths(new Set())
  }, [pendingShapePaths])

  const confirmedShapes = useMemo(
    () => effectiveShapes.filter(s => s.isClosed && s.hasFill),
    [effectiveShapes],
  )

  const buildExportConfig = useCallback((): Page1InspectConfig => ({
    ...baseConfig,
    keepGroups: baseConfig.keepGroups,
    hiddenPathRanges: baseConfig.hiddenPathRanges,
    pathStatus: { ...pathStatus },
    shapeStatus: { ...shapeStatus },
    shapeHeights: { ...shapeHeights },
    customShapes: [...customShapes],
    hiddenShapeIds: [...hiddenShapes],
    shapeEdits,
  }), [baseConfig, pathStatus, shapeStatus, shapeHeights, customShapes, hiddenShapes, shapeEdits])

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleBackup = useCallback(async () => {
    const cfg = buildExportConfig()
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = configFileName.replace('.json', `-backup-${ts}.json`)
    const result = await saveConfigToRepo(filename, cfg)
    if (!result.ok) {
      setSaveStatus('error')
      setSaveError(result.error ?? 'バックアップ失敗')
    }
  }, [buildExportConfig, configFileName])

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    setSaveError(null)
    const cfg = buildExportConfig()
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupFilename = configFileName.replace('.json', `-backup-${ts}.json`)
    const backupResult = await saveConfigToRepo(backupFilename, cfg)
    const saveResult = await saveConfigToRepo(configFileName, cfg)
    if (saveResult.ok) {
      setSaveStatus('ok')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
      setSaveError(saveResult.error ?? '保存失敗')
    }
    if (!backupResult.ok) setSaveError(prev => (prev ? `${prev} (バックアップも失敗)` : 'バックアップ失敗'))
  }, [buildExportConfig, configFileName])

  const ROTATE_SENSITIVITY = 0.3
  const wheelHandler = useCallback((e: WheelEvent) => {
    e.preventDefault()
    if (e.shiftKey) {
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX
      setRotation(r => r + delta * ROTATE_SENSITIVITY)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setZoom(z => clampZoom(z * factor))
    setPanX(px => px * factor + (mx - cx) * (1 - factor))
    setPanY(py => py * factor + (my - cy) * (1 - factor))
  }, [])
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', wheelHandler, { passive: false })
    return () => el.removeEventListener('wheel', wheelHandler)
  }, [wheelHandler])
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      dragRef.current = { mode: 'pan', x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, startRotation: 0, moved: false }
    } else if (e.button === 0) {
      e.preventDefault()
      if (e.shiftKey) {
        dragRef.current = { mode: 'rotate', x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, startRotation: rotation, moved: false }
      } else {
        dragRef.current = { mode: 'select', x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, startRotation: 0, moved: false }
        setSelectionBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY })
      }
    }
  }, [rotation])
  const ROTATE_DRAG_SENSITIVITY = 0.5
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current
    if (drag) {
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
      if (drag.mode === 'pan') {
        setPanX(v => v + dx)
        setPanY(v => v + dy)
      } else if (drag.mode === 'rotate') {
        setRotation(drag.startRotation + dx * ROTATE_DRAG_SENSITIVITY)
      } else {
        setSelectionBox(b => b ? { ...b, x2: e.clientX, y2: e.clientY } : null)
      }
      dragRef.current = { ...drag, x: e.clientX, y: e.clientY }
      return
    }
    const target = e.target as Element
    const sp = target.getAttribute?.('data-sp')
    setHoveredPathThrottled(sp != null ? Number(sp) : null)
  }, [setHoveredPathThrottled])
  const addPathsInBoxToSelection = useCallback((box: { x1: number; y1: number; x2: number; y2: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const left = Math.min(box.x1, box.x2)
    const right = Math.max(box.x1, box.x2)
    const top = Math.min(box.y1, box.y2)
    const bottom = Math.max(box.y1, box.y2)
    const selRect = { left, right, top, bottom }
    const els = canvas.querySelectorAll('[data-sp]')
    const toAdd = new Set<number>()
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.right >= selRect.left && r.left <= selRect.right && r.bottom >= selRect.top && r.top <= selRect.bottom) {
        const sp = el.getAttribute('data-sp')
        if (sp != null) toAdd.add(Number(sp))
      }
    }
    if (toAdd.size > 0) setSelectedPaths(prev => new Set([...prev, ...toAdd]))
    else setSelectedPaths(new Set())
  }, [])
  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    setSelectionBox(null)
    if (!drag) return
    if (drag.mode === 'select') {
      if (drag.moved) {
        addPathsInBoxToSelection({ x1: drag.startX, y1: drag.startY, x2: e.clientX, y2: e.clientY })
      } else {
        const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null
        const sp = el?.closest?.('[data-sp]')?.getAttribute?.('data-sp')
        if (sp != null) togglePathSelection(Number(sp), e)
        else setSelectedPaths(new Set())
      }
    }
  }, [togglePathSelection, addPathsInBoxToSelection])
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag || e.button !== (drag.mode === 'pan' ? 1 : 0)) return
      dragRef.current = null
      setSelectionBox(null)
      if (drag.mode === 'select') {
        if (drag.moved) {
          addPathsInBoxToSelection({ x1: drag.startX, y1: drag.startY, x2: e.clientX, y2: e.clientY })
        } else {
          const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null
          const sp = el?.closest?.('[data-sp]')?.getAttribute?.('data-sp')
          if (sp != null) togglePathSelection(Number(sp), e as unknown as React.MouseEvent)
          else setSelectedPaths(new Set())
        }
      }
    }
    window.addEventListener('mouseup', handler)
    return () => window.removeEventListener('mouseup', handler)
  }, [togglePathSelection, addPathsInBoxToSelection])
  const resetView = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); setRotation(0) }, [])

  const baseCssText = useMemo(() => {
    const rules: string[] = []
    if (keepGroupSet) {
      for (const g of groups) {
        if (!keepGroupSet.has(g.index)) rules.push(`[data-sg="${g.index}"]{display:none}`)
      }
    }
    for (const idx of hiddenGroups) rules.push(`[data-sg="${idx}"]{display:none}`)
    for (const pidx of hiddenPaths) rules.push(`[data-sp="${pidx}"]{display:none}`)
    for (const key of hiddenShapes) rules.push(`[data-ss="${key}"]{display:none}`)
    for (const s of effectiveShapes) {
      if (!hiddenShapes.has(s.id) && (shapeStatus[s.id] ?? 'incomplete') !== 'deleted') continue
      for (const pid of s.pathIndices) {
        rules.push(`path[data-sp="${pid}"]{display:none!important;pointer-events:none!important}`)
      }
    }
    for (const [idx, s] of Object.entries(pathStatus)) {
      if (s === 'deleted') rules.push(`[data-sp="${idx}"]{display:none}`)
    }
    if (hiddenPathRanges) {
      for (const { group, start, end } of hiddenPathRanges) {
        const prefix = group !== undefined ? `[data-sg="${group}"]` : ''
        for (let i = start; i <= end; i++) {
          rules.push(`${prefix}[data-sp="${i}"]{display:none}`)
        }
      }
    }
    if (excludeText) rules.push('text,tspan,use,image{display:none}')
    for (const s of effectiveShapes) {
      if (hiddenShapes.has(s.id) || (shapeStatus[s.id] ?? 'incomplete') === 'deleted') continue
      if (s.hasFill && s.fillColor) {
        const color = s.fillColor.trim()
        for (const pid of s.pathIndices) {
          const sel = `path[data-sp="${pid}"]`
          rules.push(`${sel}{fill:${color}!important;fill-opacity:0.5!important}`)
          rules.push(`${sel}{stroke:${color}!important;stroke-width:1!important;stroke-opacity:0.9!important}`)
        }
      }
    }
    return rules.join('\n')
  }, [groups, keepGroupSet, hiddenGroups, hiddenPaths, hiddenShapes, hiddenPathRanges, excludeText, pathStatus, shapeStatus, effectiveShapes])

  const highlightCssText = useMemo(() => {
    const rules: string[] = []
    if (hoveredGroup !== null) rules.push(`[data-sg="${hoveredGroup}"]{stroke:orange!important;stroke-width:1.5!important;opacity:1!important}`)
    if (hoveredPath !== null) rules.push(`[data-sp="${hoveredPath}"]{stroke:cyan!important;stroke-width:1.5!important;opacity:1!important}`)
    if (hoveredShape !== null) {
      const cs = effectiveShapes.find(s => s.id === hoveredShape)
      if (cs) for (const pid of cs.pathIndices) rules.push(`path[data-sp="${pid}"]{stroke:yellow!important;stroke-width:2!important;opacity:1!important}`)
      else rules.push(`[data-ss="${hoveredShape}"]{stroke:yellow!important;stroke-width:2!important;opacity:1!important}`)
    }
    for (const pid of selectedPaths) {
      rules.push(`path[data-sp="${pid}"]{stroke:rgb(239,68,68)!important;opacity:1!important}`)
    }
    return rules.join('\n')
  }, [hoveredGroup, hoveredPath, hoveredShape, effectiveShapes, selectedPaths])

  const togglePath = useCallback((pidx: number) => {
    setHiddenPaths(prev => { const n = new Set(prev); if (n.has(pidx)) n.delete(pidx); else n.add(pidx); return n })
  }, [])
  const toggleShape = useCallback((shapeId: string) => {
    setHiddenShapes(prev => { const n = new Set(prev); if (n.has(shapeId)) n.delete(shapeId); else n.add(shapeId); return n })
  }, [])
  const cycleShapeStatus = useCallback((shapeId: string) => {
    setShapeStatus(prev => {
      const current = prev[shapeId] ?? 'incomplete'
      const idx = STATUS_ORDER.indexOf(current)
      const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]!
      return { ...prev, [shapeId]: next }
    })
  }, [])
  const visibleShapes = useMemo(
    () => effectiveShapes.filter(s => (shapeStatus[s.id] ?? 'incomplete') !== 'deleted'),
    [effectiveShapes, shapeStatus],
  )
  const shapeRows = useMemo(
    () => visibleShapes.map(shape => ({
      shape,
      status: shapeStatus[shape.id] ?? 'incomplete',
      height: shapeHeights[shape.id] ?? 0,
      vertices: shapeVertexInfo.get(shape.id) ?? { isClosed: false, all: [], dangling: [] },
    })),
    [visibleShapes, shapeStatus, shapeHeights, shapeVertexInfo],
  )
  const selectedShapeRow = useMemo(
    () => shapeRows.find((r) => r.shape.id === selectedShapeId) ?? null,
    [shapeRows, selectedShapeId],
  )
  const handleVertexClick = useCallback((shapeId: string, key: string, ref: ShapeVertexRef) => {
    setSelectedVertices(prev => {
      const exists = prev.find(v => v.shapeId === shapeId && v.key === key)
      if (exists) return prev.filter(v => !(v.shapeId === shapeId && v.key === key))
      const next = [...prev, { shapeId, key, ref }]
      return next.length > 2 ? next.slice(next.length - 2) : next
    })
  }, [])
  const addBridgeFromSelection = useCallback(() => {
    if (selectedShapeId == null || selectedVertices.length !== 2) return
    const [a, b] = selectedVertices
    if (a == null || b == null) return
    if (a.shapeId !== selectedShapeId || b.shapeId !== selectedShapeId) return
    if (a.shapeId === b.shapeId && a.key === b.key) return
    const id = `bridge-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    setShapeEdits(prev => ({
      ...prev,
      bridges: [...(prev.bridges ?? []), { id, from: a.ref, to: b.ref, kind: 'manual-bridge' }],
    }))
    setSelectedVertices([])
  }, [selectedVertices, selectedShapeId])
  const applyShapeHeight = useCallback(() => {
    if (selectedShapeId == null) return
    const next = Number(heightDraft)
    if (!Number.isFinite(next)) return
    setShapeHeights(prev => ({ ...prev, [selectedShapeId]: Math.max(0, next) }))
  }, [selectedShapeId, heightDraft])
  const removeBridge = useCallback((bridgeId: string) => {
    setShapeEdits(prev => ({
      ...prev,
      bridges: (prev.bridges ?? []).filter(b => b.id !== bridgeId),
    }))
  }, [])
  const hideAll = useCallback(() => {
    setHiddenPaths(new Set(allPaths.map(p => p.pathIndex)))
  }, [allPaths])
  const showAll = useCallback(() => {
    setHiddenGroups(new Set())
    setHiddenPaths(new Set())
    setHiddenShapes(new Set())
  }, [])

  const drag = dragRef.current
  const isPanning = drag?.mode === 'pan'
  const isRotating = drag?.mode === 'rotate'
  const isSelecting = drag?.mode === 'select'
  const visiblePathCount = allPaths.filter(p => getPathStatus(p.pathIndex) !== 'deleted' && !hiddenPaths.has(p.pathIndex)).length
  const deletedPathIndices = useMemo(
    () => Object.entries(pathStatus).filter(([, s]) => s === 'deleted').map(([k]) => Number(k)),
    [pathStatus],
  )
  const shapesContainingPath = useCallback((pathIndex: number) => effectiveShapes.filter(s => s.pathIndices.includes(pathIndex)), [effectiveShapes])
  const onMouseLeave = useCallback(() => {
    if (hoverPathTimerRef.current != null) {
      clearTimeout(hoverPathTimerRef.current)
      hoverPathTimerRef.current = null
    }
    hoverPathPendingRef.current = null
    setHoveredPath(null)
    if (dragRef.current) {
      dragRef.current = null
      setSelectionBox(null)
    }
  }, [])
  useEffect(() => {
    if (selectedShapeId == null) return
    const row = shapeRows.find((r) => r.shape.id === selectedShapeId)
    if (row == null) {
      setSelectedShapeId(null)
      setSelectedVertices([])
      return
    }
    setHeightDraft(String(shapeHeights[selectedShapeId] ?? 0))
  }, [selectedShapeId, shapeRows, shapeHeights])
  useEffect(() => {
    if (editorMode === 'shape') {
      setSelectedPaths(new Set())
    } else {
      setSelectedVertices([])
      setSelectedShapeId(null)
    }
  }, [editorMode])

  const section = (label: string, open: boolean, setOpen: (v: boolean) => void, bg: string, content: React.ReactNode) => (
    <div style={{ borderBottom: '1px solid var(--border-1)' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={e => e.key === 'Enter' && setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: bg, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-1)' }}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
      </div>
      {open && content}
    </div>
  )

  const pathStatusLabel = (s: PathStatus) => ({ incomplete: '未', completed: '完', deleted: '削' }[s])
  const pathStatusColor = (s: PathStatus) => ({ incomplete: 'rgba(234,179,8,0.2)', completed: 'rgba(34,197,94,0.15)', deleted: 'rgba(239,68,68,0.15)' }[s])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        data-inspector-svg="true"
        ref={canvasRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-1)', cursor: isPanning ? 'grabbing' : isRotating ? 'grabbing' : 'crosshair', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onDoubleClick={resetView}
      >
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', transform: `translate(${panX}px, ${panY}px) rotate(${rotation}deg) scale(${zoom})`, transformOrigin: '50% 50%' }}>
          <style data-inspector-style="base">{baseCssText}</style>
          <style data-inspector-style="highlight">{highlightCssText}</style>
          <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
          {editorMode === 'shape' && (
            <g data-shape-editor-overlay="true">
              {bridgeSegments.map(seg => (
                <line
                  key={seg.id}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke="rgb(16,185,129)"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                  opacity={0.9}
                />
              ))}
              {(selectedShapeRow?.vertices.dangling ?? []).map(v => {
                const shapeId = selectedShapeRow?.shape.id ?? ''
                const selected = selectedVertices.some(sel => sel.shapeId === shapeId && sel.key === v.key)
                const ref = v.refs[0]
                if (ref == null) return null
                return (
                  <circle
                    key={`${shapeId}:${v.key}`}
                    data-dangling-vertex={`${shapeId}:${v.key}`}
                    cx={v.x}
                    cy={v.y}
                    r={selected ? 2.8 : 2.2}
                    fill={selected ? 'rgb(239,68,68)' : 'rgb(59,130,246)'}
                    stroke="white"
                    strokeWidth={0.4}
                    style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation()
                      handleVertexClick(shapeId, v.key, ref)
                    }}
                  />
                )
              })}
            </g>
          )}
        </svg>
        {selectionBox && (() => {
          const canvas = canvasRef.current
          if (!canvas) return null
          const r = canvas.getBoundingClientRect()
          const left = Math.min(selectionBox.x1, selectionBox.x2) - r.left
          const top = Math.min(selectionBox.y1, selectionBox.y2) - r.top
          const w = Math.abs(selectionBox.x2 - selectionBox.x1)
          const h = Math.abs(selectionBox.y2 - selectionBox.y1)
          return (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', left, top, width: w, height: h, border: '2px solid rgb(6,182,212)', background: 'rgba(6,182,212,0.15)' }} />
            </div>
          )
        })()}
      </div>

      <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--border-1)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '5px 8px', borderBottom: '1px solid var(--border-1)', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              data-editor-mode="path"
              onClick={() => setEditorMode('path')}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                padding: '3px 6px',
                borderRadius: 2,
                border: '1px solid',
                borderColor: editorMode === 'path' ? 'var(--accent)' : 'var(--border-2)',
                background: editorMode === 'path' ? 'var(--accent-bg)' : 'transparent',
                color: editorMode === 'path' ? 'var(--accent)' : 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              パス編集
            </button>
            <button
              type="button"
              data-editor-mode="shape"
              onClick={() => setEditorMode('shape')}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                padding: '3px 6px',
                borderRadius: 2,
                border: '1px solid',
                borderColor: editorMode === 'shape' ? 'var(--accent)' : 'var(--border-2)',
                background: editorMode === 'shape' ? 'var(--accent-bg)' : 'transparent',
                color: editorMode === 'shape' ? 'var(--accent)' : 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              シェイプ編集
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)', flex: 1 }}>
              {editorMode === 'path' ? `${visiblePathCount}/${allPaths.length}` : `${visibleShapes.length}/${effectiveShapes.length}`}
            </span>
            <button type="button" onClick={undo} disabled={historyState.index <= 0} title="元に戻す" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 5px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: historyState.index <= 0 ? 'var(--text-4)' : 'var(--text-3)', cursor: historyState.index <= 0 ? 'not-allowed' : 'pointer', opacity: historyState.index <= 0 ? 0.5 : 1 }}>元に戻す</button>
            <button type="button" onClick={redo} disabled={historyState.index >= historyState.history.length - 1} title="やり直す" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 5px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: historyState.index >= historyState.history.length - 1 ? 'var(--text-4)' : 'var(--text-3)', cursor: historyState.index >= historyState.history.length - 1 ? 'not-allowed' : 'pointer', opacity: historyState.index >= historyState.history.length - 1 ? 0.5 : 1 }}>やり直す</button>
            {(['HIDE ALL', 'SHOW ALL'] as const).map(l => (
              <button key={l} type="button" onClick={l === 'HIDE ALL' ? hideAll : showAll} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 5px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          {editorMode === 'path' && selectedPaths.size > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={openShapeModal} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, padding: '4px 8px', borderRadius: 2, border: '1px solid rgb(34,197,94)', background: 'rgba(34,197,94,0.2)', color: 'rgb(34,197,94)', cursor: 'pointer' }}>
                シェイプ化 ({selectedPaths.size})
              </button>
              <button type="button" onClick={() => { setPathStatus(prev => { const n = { ...prev }; for (const p of selectedPaths) n[p] = 'deleted'; return n }); setSelectedPaths(new Set()) }} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, padding: '4px 8px', borderRadius: 2, border: '1px solid rgb(239,68,68)', background: 'rgba(239,68,68,0.2)', color: 'rgb(239,68,68)', cursor: 'pointer' }}>
                削除 ({selectedPaths.size})
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={handleBackup} disabled={saveStatus === 'saving'} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, padding: '4px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', opacity: saveStatus === 'saving' ? 0.6 : 1 }}>バックアップ</button>
              <button type="button" onClick={handleSave} disabled={saveStatus === 'saving'} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, padding: '4px', borderRadius: 2, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)', cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', opacity: saveStatus === 'saving' ? 0.6 : 1 }}>{saveStatus === 'saving' ? '保存中...' : saveStatus === 'ok' ? '保存済' : '保存'}</button>
            </div>
            {saveError && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgb(239,68,68)' }}>{saveError}</span>}
          </div>
        </div>

        {editorMode === 'path' && selectedPaths.size > 0 && section('選択中', selectedListOpen, setSelectedListOpen, 'rgba(239,68,68,0.15)', (
          <div style={{ maxHeight: 120, overflowY: 'auto' }}>
            {[...selectedPaths].sort((a, b) => a - b).map(pid => {
              const inShapes = shapesContainingPath(pid)
              const isHidden = hiddenPaths.has(pid)
              return (
                <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-mono)', fontSize: 8 }}>
                  <span style={{ width: 32, flexShrink: 0 }}>p{pid}</span>
                  {inShapes.length > 0 && <span style={{ flex: 1, color: 'var(--text-3)', fontSize: 7 }}>シェイプ{inShapes.length}件</span>}
                  <button type="button" onClick={e => { e.stopPropagation(); togglePathSelection(pid, e as unknown as React.MouseEvent) }} style={{ padding: '0px 4px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 7 }}>選択解除</button>
                  <button type="button" onClick={() => togglePath(pid)} style={{ padding: '0px 4px', borderRadius: 2, border: `1px solid ${isHidden ? 'var(--border-2)' : 'rgba(239,68,68,0.6)'}`, background: isHidden ? 'transparent' : 'rgba(239,68,68,0.15)', color: isHidden ? 'var(--text-3)' : 'rgb(239,68,68)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 7 }}>{isHidden ? '表示' : '非表示'}</button>
                </div>
              )
            })}
          </div>
        ))}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {section('削除', deletedSectionOpen, setDeletedSectionOpen, 'rgba(239,68,68,0.15)', deletedPathIndices.length > 0 ? (
            <div style={{ padding: '4px 20px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-2)' }}>
              {deletedPathIndices.sort((a, b) => a - b).map(p => <div key={p}>path {p}</div>)}
            </div>
          ) : <div style={{ padding: '4px 20px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>なし</div>)}
          {section('確定', confirmedSectionOpen, setConfirmedSectionOpen, 'rgba(34,197,94,0.2)', confirmedShapes.length > 0 ? (
            <div style={{ padding: '4px 20px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-2)' }}>
              {confirmedShapes.map(s => <div key={s.id}>[{s.pathIndices.join(',')}] {s.fillColor ?? ''}</div>)}
            </div>
          ) : <div style={{ padding: '4px 20px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>閉合+塗りで確定</div>)}
          {section('シェイプ', shapesSectionOpen, setShapesSectionOpen, 'rgba(100,116,139,0.2)', effectiveShapes.length > 0 ? (
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {shapeRows.map(({ shape: s, status, height, vertices }) => {
                const isHidden = hiddenShapes.has(s.id)
                const label = `p${s.pathIndices.join(',p')}`
                return (
                  <div
                    key={s.id}
                    data-shape-row={s.id}
                    data-shape-selected={selectedShapeId === s.id ? 'true' : undefined}
                    onMouseEnter={() => setHoveredShape(s.id)}
                    onMouseLeave={() => setHoveredShape(null)}
                    onClick={() => {
                      if (editorMode === 'shape') {
                        setSelectedShapeId(s.id)
                        setSelectedVertices([])
                        setHeightDraft(String(shapeHeights[s.id] ?? 0))
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: selectedShapeId === s.id ? '3px solid rgb(16,185,129)' : hoveredShape === s.id ? '3px solid rgb(234,179,8)' : '3px solid transparent', background: selectedShapeId === s.id ? 'rgba(16,185,129,0.14)' : hoveredShape === s.id ? 'rgba(234,179,8,0.12)' : 'transparent', opacity: isHidden ? 0.4 : 1, cursor: editorMode === 'shape' ? 'pointer' : 'default' }}
                  >
                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>{label}</span>
                    {editorMode === 'shape' && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: vertices.isClosed ? 'rgb(34,197,94)' : 'rgb(234,179,8)', flexShrink: 0 }}>
                        {vertices.isClosed ? '閉合' : `穴:${vertices.dangling.length}`}
                      </span>
                    )}
                    {editorMode === 'shape' && (
                      <button type="button" onClick={() => cycleShapeStatus(s.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 7, padding: '0px 3px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>
                        {pathStatusLabel(status)}
                      </button>
                    )}
                    {editorMode === 'shape' && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'rgb(34,197,94)', flexShrink: 0 }}>
                        z:{Math.round(height)}
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--text-3)', flexShrink: 0 }}>{s.pathIndices.length}本</span>
                    <button type="button" onClick={() => toggleShape(s.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 7, padding: '0px 4px', borderRadius: 2, border: `1px solid ${isHidden ? 'var(--border-2)' : 'rgba(100,116,139,0.6)'}`, background: isHidden ? 'transparent' : 'rgba(100,116,139,0.15)', color: isHidden ? 'var(--text-3)' : 'rgb(148,163,184)', cursor: 'pointer' }}>{isHidden ? '表示' : '非表示'}</button>
                  </div>
                )
              })}
            </div>
          ) : <div style={{ padding: '4px 20px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>グループ結合でシェイプ化</div>)}
          {editorMode === 'shape' && section('頂点接続', vertexSectionOpen, setVertexSectionOpen, 'rgba(14,165,233,0.12)', (
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-2)' }}>
                シェイプ選択後、穴頂点を2つ選択して接続線を作成
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: selectedShapeId ? 'rgb(16,185,129)' : 'var(--text-3)' }}>
                選択シェイプ: {selectedShapeId ?? 'なし'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                選択: {selectedVertices.length}/2
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>高さ</span>
                <input
                  data-shape-height-input="true"
                  type="number"
                  min={0}
                  step={1}
                  value={heightDraft}
                  onChange={(e) => setHeightDraft(e.target.value)}
                  style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 4px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)' }}
                />
                <button
                  type="button"
                  data-apply-shape-height="true"
                  onClick={applyShapeHeight}
                  disabled={selectedShapeId == null}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8,
                    padding: '3px 6px',
                    borderRadius: 2,
                    border: '1px solid var(--border-2)',
                    background: selectedShapeId == null ? 'transparent' : 'rgba(34,197,94,0.15)',
                    color: selectedShapeId == null ? 'var(--text-4)' : 'rgb(34,197,94)',
                    cursor: selectedShapeId == null ? 'not-allowed' : 'pointer',
                  }}
                >
                  高さ適用
                </button>
              </div>
              <button
                type="button"
                data-add-bridge="true"
                onClick={addBridgeFromSelection}
                disabled={selectedShapeId == null || selectedVertices.length !== 2}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  padding: '4px 6px',
                  borderRadius: 2,
                  border: '1px solid rgb(16,185,129)',
                  background: selectedShapeId != null && selectedVertices.length === 2 ? 'rgba(16,185,129,0.2)' : 'transparent',
                  color: selectedShapeId != null && selectedVertices.length === 2 ? 'rgb(16,185,129)' : 'var(--text-4)',
                  cursor: selectedShapeId != null && selectedVertices.length === 2 ? 'pointer' : 'not-allowed',
                }}
              >
                接続線を追加
              </button>
              {(shapeEdits.bridges ?? []).length > 0 && (
                <div style={{ maxHeight: 96, overflowY: 'auto', borderTop: '1px solid var(--border-1)', paddingTop: 4 }}>
                  {(shapeEdits.bridges ?? []).map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.from.pathIndex}:{b.from.endpoint} → {b.to.pathIndex}:{b.to.endpoint}
                      </span>
                      <button type="button" onClick={() => removeBridge(b.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 7, padding: '0px 4px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {editorMode === 'path' && (
          <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-1)', display: 'flex', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            <button type="button" onClick={() => setPathListTab('incomplete')} style={{ flex: 1, padding: '4px 8px', border: 'none', borderBottom: pathListTab === 'incomplete' ? '2px solid var(--accent)' : '2px solid transparent', background: pathListTab === 'incomplete' ? 'var(--accent-bg)' : 'transparent', color: pathListTab === 'incomplete' ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>未完了</button>
            <button type="button" onClick={() => setPathListTab('completed')} style={{ flex: 1, padding: '4px 8px', border: 'none', borderBottom: pathListTab === 'completed' ? '2px solid var(--accent)' : '2px solid transparent', background: pathListTab === 'completed' ? 'var(--accent-bg)' : 'transparent', color: pathListTab === 'completed' ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>完了</button>
          </div>
        )}

        {editorMode === 'path' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {allPaths.map(({ pathIndex, groupIndex }) => {
              const status = getPathStatus(pathIndex)
              if (status === 'deleted') return null
              const showInList = status === pathListTab
              if (!showInList) return null
              return (
                <PathRow
                  key={pathIndex}
                  pathIndex={pathIndex}
                  groupIndex={groupIndex}
                  statusLabel={pathStatusLabel(status)}
                  statusColor={pathStatusColor(status)}
                  isPathHidden={hiddenPaths.has(pathIndex)}
                  isSelected={selectedPaths.has(pathIndex)}
                  isHovered={hoveredPath === pathIndex}
                  onMouseEnter={() => setHoveredPath(pathIndex)}
                  onMouseLeave={() => setHoveredPath(null)}
                  onToggleSelect={e => togglePathSelection(pathIndex, e as unknown as React.MouseEvent)}
                  onCycleStatus={() => cyclePathStatus(pathIndex)}
                  onTogglePath={() => togglePath(pathIndex)}
                />
              )
            })}
          </div>
        )}

        {shapeModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <ShapeModal
              pathIndices={pendingShapePaths}
              onConfirm={confirmCreateShape}
              onCancel={() => setShapeModalOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const PathRow = memo(function PathRow(
  props: {
    pathIndex: number
    groupIndex: number
    statusLabel: string
    statusColor: string
    isPathHidden: boolean
    isSelected: boolean
    isHovered: boolean
    onMouseEnter: () => void
    onMouseLeave: () => void
    onToggleSelect: (e: React.MouseEvent) => void
    onCycleStatus: () => void
    onTogglePath: () => void
  },
) {
  const { pathIndex, groupIndex, statusLabel, statusColor, isPathHidden, isSelected, isHovered, onMouseEnter, onMouseLeave, onToggleSelect, onCycleStatus, onTogglePath } = props
  return (
    <div
      data-path-row={pathIndex}
      data-group-row={groupIndex}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: isHovered ? '3px solid rgb(6,182,212)' : '3px solid transparent', background: isHovered ? 'rgba(6,182,212,0.15)' : statusColor, opacity: isPathHidden ? 0.35 : 1 }}
    >
      <input type="checkbox" checked={isSelected} onChange={() => {}} onClick={onToggleSelect} style={{ width: 12, height: 12, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, width: 28, flexShrink: 0 }}>g{groupIndex}</span>
      <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8 }}>p{pathIndex}</span>
      <button type="button" data-path-status={pathIndex} onClick={onCycleStatus} style={{ fontFamily: 'var(--font-mono)', fontSize: 7, padding: '0px 3px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>{statusLabel}</button>
      <button type="button" data-path-toggle={pathIndex} onClick={onTogglePath} style={{ fontFamily: 'var(--font-mono)', fontSize: 7, padding: '0px 3px', borderRadius: 2, border: `1px solid ${isPathHidden ? 'var(--border-2)' : 'rgba(6,182,212,0.6)'}`, background: isPathHidden ? 'transparent' : 'rgba(6,182,212,0.1)', color: isPathHidden ? 'var(--text-3)' : 'rgb(6,182,212)', cursor: 'pointer' }}>{isPathHidden ? 'OFF' : 'ON'}</button>
    </div>
  )
})

function ShapeModal({ pathIndices, onConfirm, onCancel }: { pathIndices: number[]; onConfirm: (isClosed: boolean, hasFill: boolean, fillColor?: string) => void; onCancel: () => void }) {
  const [isClosed, setIsClosed] = useState(false)
  const [hasFill, setHasFill] = useState(false)
  const [fillColor, setFillColor] = useState('#888888')
  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: 16, minWidth: 280, border: '1px solid var(--border-1)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginBottom: 12 }}>シェイプ化: paths {pathIndices.join(', ')}</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
        <input type="checkbox" checked={isClosed} onChange={e => setIsClosed(e.target.checked)} />
        閉合
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
        <input type="checkbox" checked={hasFill} onChange={e => setHasFill(e.target.checked)} />
        塗り
      </label>
      {hasFill && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>色:</span>
          <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} style={{ width: 36, height: 24, padding: 0, border: '1px solid var(--border-2)' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 12px', borderRadius: 4, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}>キャンセル</button>
        <button type="button" onClick={() => onConfirm(isClosed, hasFill, hasFill ? fillColor : undefined)} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 12px', borderRadius: 4, border: '1px solid rgb(34,197,94)', background: 'rgba(34,197,94,0.2)', color: 'rgb(34,197,94)', cursor: 'pointer' }}>作成</button>
      </div>
    </div>
  )
}
