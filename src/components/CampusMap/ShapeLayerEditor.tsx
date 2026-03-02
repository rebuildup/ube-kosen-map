import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { groupSvgPaths } from '../../importer/svg/groupSvgPaths'
import { applyShapeEdits } from './page1ShapeEdits'
import { buildBridgeSegments, buildPathEndpointMap, collectShapeVertexStats } from './shapeVertexEditor'
import type {
  Page1InspectConfig,
  PathStatus,
  ShapeEditConfig,
  ShapeLayerDefinition,
  ShapePlacement,
  ShapeTransition,
  ShapeVertexRef,
} from './page1InspectTypes'

export interface ShapeLayerEditorProps {
  rawSvg: string
  initialConfig?: Page1InspectConfig
  configFileName?: string
  onConfigChange?: (config: Page1InspectConfig) => void
}

const STATUS_ORDER: PathStatus[] = ['incomplete', 'completed', 'deleted']

const parsePathIndexList = (raw: string): number[] => raw
  .split(',')
  .map((x) => Number(x.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0)

const uniqSorted = (arr: number[]): number[] => [...new Set(arr)].sort((a, b) => a - b)

const clampZoom = (v: number): number => Math.max(0.2, Math.min(8, v))
const vertexKeyFromPoint = (x: number, y: number, tolerance: number = 1): string => {
  const qx = Math.round(x / tolerance)
  const qy = Math.round(y / tolerance)
  return `${qx}:${qy}`
}

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

export const ShapeLayerEditor: React.FC<ShapeLayerEditorProps> = ({
  rawSvg,
  initialConfig,
  configFileName = 'page1-inspect-config.json',
  onConfigChange,
}) => {
  const { groups, svgInnerHTML, viewBox } = useMemo(() => groupSvgPaths(rawSvg), [rawSvg])

  const [baseConfig] = useState<Page1InspectConfig>(() => initialConfig ?? {
    keepGroups: [],
    hiddenPathRanges: [],
    pathStatus: {},
    shapeStatus: {},
    shapeHeights: {},
    shapeLayers: [{ id: 'layer-ground', name: 'Ground', baseZ: 0, color: '#64748b' }],
    shapePlacements: {},
    shapeTransitions: [],
    customShapes: [],
    hiddenShapeIds: [],
    shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
  })

  const [shapeEdits, setShapeEdits] = useState<ShapeEditConfig>({
    bridges: baseConfig.shapeEdits?.bridges ?? [],
    removedVertices: baseConfig.shapeEdits?.removedVertices ?? [],
    relations: baseConfig.shapeEdits?.relations ?? [],
    merges: baseConfig.shapeEdits?.merges ?? [],
    splits: baseConfig.shapeEdits?.splits ?? [],
  })
  const [shapeStatus, setShapeStatus] = useState<Record<string, PathStatus>>(baseConfig.shapeStatus ?? {})
  const [shapeLayers, setShapeLayers] = useState<ShapeLayerDefinition[]>(
    baseConfig.shapeLayers && baseConfig.shapeLayers.length > 0
      ? baseConfig.shapeLayers
      : [{ id: 'layer-ground', name: 'Ground', baseZ: 0, color: '#64748b' }],
  )
  const [shapePlacements, setShapePlacements] = useState<Record<string, ShapePlacement>>(baseConfig.shapePlacements ?? {})
  const [shapeTransitions, setShapeTransitions] = useState<ShapeTransition[]>(baseConfig.shapeTransitions ?? [])
  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>({})
  const [layerExpanded, setLayerExpanded] = useState<Record<string, boolean>>({})

  const [activeShapeId, setActiveShapeId] = useState<string | null>(null)
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null)
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set())
  const [selectedVertices, setSelectedVertices] = useState<Array<{ key: string; ref: ShapeVertexRef }>>([])
  const [bulkTargetLayerId, setBulkTargetLayerId] = useState<string>('')

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const panDragRef = useRef<{ x: number; y: number } | null>(null)
  const selectDragRef = useRef<{ shapeIds: Set<string> } | null>(null)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [transitionKind, setTransitionKind] = useState<'stairs' | 'slope'>('stairs')
  const [transitionFromLayer, setTransitionFromLayer] = useState<string>('')
  const [transitionToLayer, setTransitionToLayer] = useState<string>('')
  const [transitionLowerRaw, setTransitionLowerRaw] = useState<string>('')
  const [transitionUpperRaw, setTransitionUpperRaw] = useState<string>('')
  const [transitionStepCountRaw, setTransitionStepCountRaw] = useState<string>('')

  const customShapes = baseConfig.customShapes ?? []
  const effectiveShapes = useMemo(() => applyShapeEdits(customShapes, shapeEdits), [customShapes, shapeEdits])
  const pathEndpointMap = useMemo(() => buildPathEndpointMap(groups), [groups])
  const bridgeSegments = useMemo(
    () => buildBridgeSegments(shapeEdits.bridges ?? [], pathEndpointMap),
    [shapeEdits.bridges, pathEndpointMap],
  )

  const deletedPathSet = useMemo(
    () => new Set(
      Object.entries(baseConfig.pathStatus ?? {})
        .filter(([, status]) => status === 'deleted')
        .map(([k]) => Number(k)),
    ),
    [baseConfig.pathStatus],
  )

  const normalizedShapes = useMemo(() => {
    return effectiveShapes
      .map((shape) => ({
        ...shape,
        pathIndices: shape.pathIndices.filter((pid) => !deletedPathSet.has(pid)),
      }))
      .filter((shape) => shape.pathIndices.length > 0)
  }, [effectiveShapes, deletedPathSet])

  const layerById = useMemo(() => new Map(shapeLayers.map((l) => [l.id, l])), [shapeLayers])
  const displayLayers = useMemo(
    () => [...shapeLayers].sort((a, b) => (b.baseZ - a.baseZ) || a.name.localeCompare(b.name)),
    [shapeLayers],
  )

  const shapeRows = useMemo(() => {
    return normalizedShapes
      .filter((shape) => (shapeStatus[shape.id] ?? 'incomplete') !== 'deleted')
      .map((shape) => {
        const placement = shapePlacements[shape.id] ?? {
          shapeId: shape.id,
          layerId: shapeLayers[0]?.id ?? 'layer-ground',
          height: baseConfig.shapeHeights?.[shape.id] ?? 0,
        }
        const layer = layerById.get(placement.layerId)
        const vertices = collectShapeVertexStats(shape, pathEndpointMap, shapeEdits.bridges ?? [], shapeEdits.removedVertices ?? [])
        return { shape, placement, layer, vertices, status: shapeStatus[shape.id] ?? 'incomplete' }
      })
  }, [normalizedShapes, shapeStatus, shapePlacements, shapeLayers, baseConfig.shapeHeights, layerById, pathEndpointMap, shapeEdits.bridges, shapeEdits.removedVertices])
  const bridgeEntries = useMemo(() => {
    return bridgeSegments.map((seg, index) => {
      const bridge = (shapeEdits.bridges ?? [])[index]
      if (!bridge) return null
      const owner = shapeRows.find((row) =>
        row.shape.pathIndices.includes(bridge.from.pathIndex) || row.shape.pathIndices.includes(bridge.to.pathIndex),
      )
      if (!owner) return null
      return {
        ...seg,
        pathIndex: -(index + 1),
        shapeId: owner.shape.id,
      }
    }).filter((x): x is { id: string; x1: number; y1: number; x2: number; y2: number; pathIndex: number; shapeId: string } => x != null)
  }, [bridgeSegments, shapeEdits.bridges, shapeRows])
  const bridgePathIndicesByShapeId = useMemo(() => {
    const out = new Map<string, number[]>()
    for (const b of bridgeEntries) {
      const arr = out.get(b.shapeId) ?? []
      arr.push(b.pathIndex)
      out.set(b.shapeId, arr)
    }
    return out
  }, [bridgeEntries])

  const activeRow = useMemo(
    () => shapeRows.find((r) => r.shape.id === activeShapeId) ?? null,
    [shapeRows, activeShapeId],
  )
  const selectedRows = useMemo(
    () => shapeRows.filter((r) => selectedShapeIds.has(r.shape.id)),
    [shapeRows, selectedShapeIds],
  )
  const vertexTargetRow = useMemo(
    () => activeRow ?? selectedRows[0] ?? null,
    [activeRow, selectedRows],
  )

  const rowsByLayer = useMemo(() => {
    const out = new Map<string, typeof shapeRows>()
    for (const layer of shapeLayers) out.set(layer.id, [])
    for (const row of shapeRows) {
      const layerId = row.placement.layerId
      const arr = out.get(layerId)
      if (arr) arr.push(row)
      else out.set(layerId, [row])
    }
    return out
  }, [shapeLayers, shapeRows])

  const shapeIdsByPathIndex = useMemo(() => {
    const out = new Map<number, string[]>()
    const rowsSorted = [...shapeRows].sort(
      (a, b) => (b.layer?.baseZ ?? 0) - (a.layer?.baseZ ?? 0),
    )
    for (const row of rowsSorted) {
      for (const pid of row.shape.pathIndices) {
        const arr = out.get(pid) ?? []
        arr.push(row.shape.id)
        out.set(pid, arr)
      }
    }
    for (const b of bridgeEntries) {
      const arr = out.get(b.pathIndex) ?? []
      arr.push(b.shapeId)
      out.set(b.pathIndex, arr)
    }
    return out
  }, [shapeRows, bridgeEntries])

  useEffect(() => {
    if (shapeLayers.length === 0) {
      setShapeLayers([{ id: 'layer-ground', name: 'Ground', baseZ: 0, color: '#64748b' }])
      return
    }
    setLayerVisible((prev) => {
      const next: Record<string, boolean> = {}
      for (const layer of shapeLayers) next[layer.id] = prev[layer.id] ?? true
      return next
    })
    setLayerExpanded((prev) => {
      const next: Record<string, boolean> = {}
      for (const layer of shapeLayers) next[layer.id] = prev[layer.id] ?? true
      return next
    })
    if (bulkTargetLayerId === '' && shapeLayers[0]) setBulkTargetLayerId(shapeLayers[0].id)
    if (transitionFromLayer === '' && shapeLayers[0]) setTransitionFromLayer(shapeLayers[0].id)
    if (transitionToLayer === '' && shapeLayers[0]) setTransitionToLayer(shapeLayers[0].id)
  }, [shapeLayers, bulkTargetLayerId, transitionFromLayer, transitionToLayer])

  const cycleShapeStatus = useCallback((shapeId: string) => {
    setShapeStatus(prev => {
      const current = prev[shapeId] ?? 'incomplete'
      const idx = STATUS_ORDER.indexOf(current)
      const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]!
      return { ...prev, [shapeId]: next }
    })
  }, [])

  const onActivateShape = useCallback((shapeId: string) => {
    setActiveShapeId(shapeId)
    setSelectedShapeIds(prev => {
      const next = new Set(prev)
      next.add(shapeId)
      return next
    })
    setSelectedVertices([])
  }, [])

  const toggleShapeSelection = useCallback((shapeId: string) => {
    setSelectedShapeIds(prev => {
      const next = new Set(prev)
      if (next.has(shapeId)) next.delete(shapeId)
      else next.add(shapeId)
      return next
    })
  }, [])

  const onSelectVertex = useCallback((key: string, ref: ShapeVertexRef) => {
    if (activeShapeId == null) return
    setSelectedVertices(prev => {
      const exists = prev.find(v => v.key === key)
      if (exists) return prev.filter(v => v.key !== key)
      const next = [...prev, { key, ref }]
      return next.length > 2 ? next.slice(next.length - 2) : next
    })
  }, [activeShapeId])

  const addBridge = useCallback(() => {
    if (activeShapeId == null || selectedVertices.length !== 2) return
    const [a, b] = selectedVertices
    if (a == null || b == null) return
    const id = `bridge-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    setShapeEdits(prev => ({
      ...prev,
      bridges: [...(prev.bridges ?? []), { id, from: a.ref, to: b.ref, kind: 'manual-bridge' }],
    }))
    setSelectedVertices([])
  }, [activeShapeId, selectedVertices])

  const removeSelectedVertices = useCallback(() => {
    if (selectedVertices.length === 0) return
    const refKey = (v: ShapeVertexRef): string => `${v.pathIndex}:${v.endpoint}`
    const removedKeys = new Set(selectedVertices.map((v) => refKey(v.ref)))
    setShapeEdits(prev => {
      const currentRemoved = prev.removedVertices ?? []
      const existingKeys = new Set(currentRemoved.map((v) => refKey(v)))
      const mergedRemoved = [...currentRemoved]
      for (const sv of selectedVertices) {
        const k = refKey(sv.ref)
        if (existingKeys.has(k)) continue
        existingKeys.add(k)
        mergedRemoved.push(sv.ref)
      }
      const nextBridges = (prev.bridges ?? []).filter(
        (b) => !removedKeys.has(refKey(b.from)) && !removedKeys.has(refKey(b.to)),
      )
      return {
        ...prev,
        removedVertices: mergedRemoved,
        bridges: nextBridges,
      }
    })
    setSelectedVertices([])
  }, [selectedVertices])
  const removeVerticesBetweenSelection = useCallback(() => {
    if (vertexTargetRow == null || selectedVertices.length !== 2) return
    const [a, b] = selectedVertices
    if (!a || !b) return
    const removedRefKeySet = new Set((shapeEdits.removedVertices ?? []).map((v) => `${v.pathIndex}:${v.endpoint}`))
    const keyToRefs = new Map<string, ShapeVertexRef[]>()
    const adj = new Map<string, Set<string>>()
    const addNode = (key: string): void => {
      if (!adj.has(key)) adj.set(key, new Set())
    }
    const endpointKey = (ref: ShapeVertexRef): string | null => {
      const pair = pathEndpointMap.get(ref.pathIndex)
      if (!pair) return null
      const pt = ref.endpoint === 'start' ? pair.start : pair.end
      return vertexKeyFromPoint(pt[0], pt[1])
    }
    const addRef = (ref: ShapeVertexRef): void => {
      const rk = `${ref.pathIndex}:${ref.endpoint}`
      if (removedRefKeySet.has(rk)) return
      const key = endpointKey(ref)
      if (!key) return
      const refs = keyToRefs.get(key) ?? []
      refs.push(ref)
      keyToRefs.set(key, refs)
    }
    const connect = (ra: ShapeVertexRef, rb: ShapeVertexRef): void => {
      const ka = endpointKey(ra)
      const kb = endpointKey(rb)
      if (!ka || !kb || ka === kb) return
      addNode(ka)
      addNode(kb)
      adj.get(ka)?.add(kb)
      adj.get(kb)?.add(ka)
      addRef(ra)
      addRef(rb)
    }
    for (const pid of vertexTargetRow.shape.pathIndices) {
      connect({ pathIndex: pid, endpoint: 'start' }, { pathIndex: pid, endpoint: 'end' })
    }
    for (const br of shapeEdits.bridges ?? []) {
      if (!vertexTargetRow.shape.pathIndices.includes(br.from.pathIndex) || !vertexTargetRow.shape.pathIndices.includes(br.to.pathIndex)) continue
      connect(br.from, br.to)
    }
    const start = a.key
    const goal = b.key
    if (!adj.has(start) || !adj.has(goal)) return
    const queue: string[] = [start]
    const seen = new Set<string>([start])
    const parent = new Map<string, string>()
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (cur === goal) break
      for (const nx of adj.get(cur) ?? []) {
        if (seen.has(nx)) continue
        seen.add(nx)
        parent.set(nx, cur)
        queue.push(nx)
      }
    }
    if (!seen.has(goal)) return
    const path: string[] = []
    let cur: string | undefined = goal
    while (cur) {
      path.push(cur)
      if (cur === start) break
      cur = parent.get(cur)
    }
    path.reverse()
    const between = path.slice(1, -1)
    if (between.length === 0) return
    const toRemove: ShapeVertexRef[] = []
    for (const k of between) {
      for (const ref of keyToRefs.get(k) ?? []) toRemove.push(ref)
    }
    if (toRemove.length === 0) return
    const refKey = (v: ShapeVertexRef): string => `${v.pathIndex}:${v.endpoint}`
    const removedKeys = new Set(toRemove.map(refKey))
    setShapeEdits(prev => {
      const currentRemoved = prev.removedVertices ?? []
      const existing = new Set(currentRemoved.map(refKey))
      const merged = [...currentRemoved]
      for (const r of toRemove) {
        const k = refKey(r)
        if (existing.has(k)) continue
        existing.add(k)
        merged.push(r)
      }
      const sameRef = (x: ShapeVertexRef, y: ShapeVertexRef): boolean => (
        x.pathIndex === y.pathIndex && x.endpoint === y.endpoint
      )
      const hasBridgeBetween = (prev.bridges ?? []).some((br) => (
        (sameRef(br.from, a.ref) && sameRef(br.to, b.ref))
        || (sameRef(br.from, b.ref) && sameRef(br.to, a.ref))
      ))
      const nextBridges = (prev.bridges ?? []).filter((br) => !removedKeys.has(refKey(br.from)) && !removedKeys.has(refKey(br.to)))
      if (!hasBridgeBetween) {
        nextBridges.push({
          id: `bridge-between-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          from: a.ref,
          to: b.ref,
          kind: 'manual-bridge',
        })
      }
      return {
        ...prev,
        removedVertices: merged,
        bridges: nextBridges,
      }
    })
    setSelectedVertices([])
  }, [vertexTargetRow, selectedVertices, shapeEdits.removedVertices, shapeEdits.bridges, pathEndpointMap])

  const upsertPlacement = useCallback((shapeId: string, next: Partial<ShapePlacement>) => {
    setShapePlacements(prev => {
      const existing = prev[shapeId] ?? {
        shapeId,
        layerId: shapeLayers[0]?.id ?? 'layer-ground',
        height: baseConfig.shapeHeights?.[shapeId] ?? 0,
      }
      const merged: ShapePlacement = {
        shapeId,
        layerId: next.layerId ?? existing.layerId,
        height: next.height ?? existing.height,
      }
      return { ...prev, [shapeId]: merged }
    })
  }, [shapeLayers, baseConfig.shapeHeights])

  const applyBulkLayer = useCallback(() => {
    if (selectedShapeIds.size === 0 || bulkTargetLayerId === '') return
    setShapePlacements(prev => {
      const out = { ...prev }
      for (const shapeId of selectedShapeIds) {
        const existing = out[shapeId] ?? {
          shapeId,
          layerId: shapeLayers[0]?.id ?? 'layer-ground',
          height: baseConfig.shapeHeights?.[shapeId] ?? 0,
        }
        out[shapeId] = { ...existing, layerId: bulkTargetLayerId }
      }
      return out
    })
  }, [selectedShapeIds, bulkTargetLayerId, shapeLayers, baseConfig.shapeHeights])

  const addLayer = useCallback(() => {
    const id = `layer-${Date.now()}`
    const next: ShapeLayerDefinition = { id, name: `Layer ${shapeLayers.length + 1}`, baseZ: 0, color: '#64748b' }
    setShapeLayers(prev => [...prev, next])
  }, [shapeLayers.length])

  const updateLayer = useCallback((layerId: string, patch: Partial<ShapeLayerDefinition>) => {
    setShapeLayers(prev => prev.map(l => l.id === layerId ? { ...l, ...patch } : l))
  }, [])

  const removeLayer = useCallback((layerId: string) => {
    if (shapeLayers.length <= 1) return
    const fallback = shapeLayers.find(l => l.id !== layerId)
    if (!fallback) return
    setShapeLayers(prev => prev.filter(l => l.id !== layerId))
    setShapePlacements(prev => {
      const out: Record<string, ShapePlacement> = {}
      for (const [shapeId, placement] of Object.entries(prev)) {
        out[shapeId] = placement.layerId === layerId ? { ...placement, layerId: fallback.id } : placement
      }
      return out
    })
    setShapeTransitions(prev => prev.filter(t => t.fromLayerId !== layerId && t.toLayerId !== layerId))
  }, [shapeLayers])

  const addTransition = useCallback(() => {
    const lower = uniqSorted(parsePathIndexList(transitionLowerRaw))
    const upper = uniqSorted(parsePathIndexList(transitionUpperRaw))
    if (lower.length === 0 || upper.length === 0) return
    const id = `tr-${Date.now()}`
    const stepCountNum = Number(transitionStepCountRaw)
    const stepCount = Number.isFinite(stepCountNum) && stepCountNum > 0 ? Math.floor(stepCountNum) : undefined
    setShapeTransitions(prev => [
      ...prev,
      {
        id,
        kind: transitionKind,
        fromLayerId: transitionFromLayer,
        toLayerId: transitionToLayer,
        lowerEdgePathIndices: lower,
        upperEdgePathIndices: upper,
        stepCount,
      },
    ])
    setTransitionLowerRaw('')
    setTransitionUpperRaw('')
    setTransitionStepCountRaw('')
  }, [transitionKind, transitionFromLayer, transitionToLayer, transitionLowerRaw, transitionUpperRaw, transitionStepCountRaw])

  const removeTransition = useCallback((id: string) => {
    setShapeTransitions(prev => prev.filter(t => t.id !== id))
  }, [])

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setZoom((z) => clampZoom(z * factor))
  }, [])

  const clearSelection = useCallback(() => {
    setActiveShapeId(null)
    setSelectedShapeIds(new Set())
    setSelectedVertices([])
  }, [])

  const pickPathIndexFromTarget = useCallback((target: EventTarget | null): number | null => {
    if (!(target instanceof Element)) return null
    const pathEl = target.closest('path[data-sp],polyline[data-sp],polygon[data-sp],line[data-sp]')
    if (!pathEl) return null
    const raw = pathEl.getAttribute('data-sp')
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }, [])

  const pickShapeIdFromTarget = useCallback((target: EventTarget | null): string | null => {
    const pid = pickPathIndexFromTarget(target)
    if (pid == null) return null
    const ids = shapeIdsByPathIndex.get(pid)
    return ids?.[0] ?? null
  }, [pickPathIndexFromTarget, shapeIdsByPathIndex])

  const pickShapeIdFromPoint = useCallback((x: number, y: number): string | null => {
    const fn = (document as Document & { elementFromPoint?: (x: number, y: number) => Element | null }).elementFromPoint
    if (typeof fn !== 'function') return null
    const el = fn.call(document, x, y)
    return pickShapeIdFromTarget(el)
  }, [pickShapeIdFromTarget])

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1) {
      e.preventDefault()
      panDragRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (e.button !== 0) return
    const shapeId = pickShapeIdFromTarget(e.target) ?? pickShapeIdFromPoint(e.clientX, e.clientY)
    if (shapeId) {
      setHoveredShapeId(shapeId)
      setActiveShapeId(shapeId)
      setSelectedShapeIds((prev) => {
        const next = new Set(prev)
        next.add(shapeId)
        selectDragRef.current = { shapeIds: next }
        return next
      })
      setSelectedVertices([])
      return
    }
    setHoveredShapeId(null)
    clearSelection()
  }, [pickShapeIdFromTarget, pickShapeIdFromPoint, clearSelection])

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.x
      const dy = e.clientY - panDragRef.current.y
      panDragRef.current = { x: e.clientX, y: e.clientY }
      setPanX(v => v + dx)
      setPanY(v => v + dy)
      return
    }
    const shapeId = pickShapeIdFromPoint(e.clientX, e.clientY) ?? pickShapeIdFromTarget(e.target)
    setHoveredShapeId(shapeId)
    if (!selectDragRef.current || !shapeId || selectDragRef.current.shapeIds.has(shapeId)) return
    const next = new Set(selectDragRef.current.shapeIds)
    next.add(shapeId)
    selectDragRef.current.shapeIds = next
    setActiveShapeId(shapeId)
    setSelectedShapeIds(new Set(next))
    setSelectedVertices([])
  }, [pickShapeIdFromPoint, pickShapeIdFromTarget])

  const onMouseUp = useCallback(() => {
    panDragRef.current = null
    selectDragRef.current = null
  }, [])

  const onMouseLeave = useCallback(() => {
    panDragRef.current = null
    selectDragRef.current = null
    setHoveredShapeId(null)
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])

  const baseCssText = useMemo(() => {
    const rules: string[] = []
    rules.push('path,polyline,polygon,line,rect,ellipse{display:none}')
    rules.push('[data-editor-vertex="true"]{display:inline!important}')
    for (const row of shapeRows) {
      if (!layerVisible[row.placement.layerId]) continue
      const color = row.layer?.color ?? '#94a3b8'
      const renderPathIds = [...row.shape.pathIndices, ...(bridgePathIndicesByShapeId.get(row.shape.id) ?? [])]
      for (const pid of renderPathIds) {
        const sel = `path[data-sp="${pid}"],polyline[data-sp="${pid}"],polygon[data-sp="${pid}"],line[data-sp="${pid}"]`
        rules.push(`${sel}{display:inline;stroke:${color}!important;stroke-opacity:0.9!important}`)
      }
    }
    for (const row of shapeRows) {
      if (!selectedShapeIds.has(row.shape.id) || !layerVisible[row.placement.layerId]) continue
      const renderPathIds = [...row.shape.pathIndices, ...(bridgePathIndicesByShapeId.get(row.shape.id) ?? [])]
      for (const pid of renderPathIds) {
        const sel = `path[data-sp="${pid}"],polyline[data-sp="${pid}"],polygon[data-sp="${pid}"],line[data-sp="${pid}"]`
        rules.push(`${sel}{stroke:rgb(239,68,68)!important}`)
      }
    }
    if (hoveredShapeId && !selectedShapeIds.has(hoveredShapeId)) {
      const hovered = shapeRows.find((r) => r.shape.id === hoveredShapeId)
      if (hovered) {
        const renderPathIds = [...hovered.shape.pathIndices, ...(bridgePathIndicesByShapeId.get(hovered.shape.id) ?? [])]
        for (const pid of renderPathIds) {
          const sel = `path[data-sp="${pid}"],polyline[data-sp="${pid}"],polygon[data-sp="${pid}"],line[data-sp="${pid}"]`
          rules.push(`${sel}{stroke:rgb(245,158,11)!important}`)
        }
      }
    }
    return rules.join('\n')
  }, [shapeRows, layerVisible, hoveredShapeId, selectedShapeIds, bridgePathIndicesByShapeId])

  const buildExportConfig = useCallback((): Page1InspectConfig => {
    const shapeHeights: Record<string, number> = {}
    for (const placement of Object.values(shapePlacements)) {
      shapeHeights[placement.shapeId] = placement.height
    }
    return {
      ...baseConfig,
      shapeEdits,
      shapeStatus,
      shapeLayers,
      shapePlacements,
      shapeTransitions,
      shapeHeights,
      hiddenShapeIds: [],
    }
  }, [baseConfig, shapeEdits, shapeStatus, shapeLayers, shapePlacements, shapeTransitions])

  useEffect(() => {
    if (onConfigChange == null) return
    onConfigChange(buildExportConfig())
  }, [onConfigChange, buildExportConfig])

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
    if (!backupResult.ok) setSaveError(prev => (prev ? `${prev} (バックアップ失敗)` : 'バックアップ失敗'))
  }, [buildExportConfig, configFileName])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: 320, borderRight: '1px solid var(--border-1)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-1)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>Layer Groups</div>
        <div style={{ padding: '8px', borderBottom: '1px solid var(--border-1)', display: 'flex', gap: 4 }}>
          <select value={bulkTargetLayerId} onChange={(e) => setBulkTargetLayerId(e.target.value)} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8 }}>
            {displayLayers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button type="button" onClick={applyBulkLayer} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>
            選択へ適用({selectedShapeIds.size})
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {displayLayers.map((layer) => {
            const rows = rowsByLayer.get(layer.id) ?? []
            return (
              <div key={layer.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-2)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    data-layer-expand={layer.id}
                    onClick={() => setLayerExpanded((prev) => ({ ...prev, [layer.id]: !(prev[layer.id] ?? true) }))}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 8, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', width: 20 }}
                  >
                    {(layerExpanded[layer.id] ?? true) ? '▼' : '▶'}
                  </button>
                  <button
                    type="button"
                    data-layer-toggle={layer.id}
                    onClick={() => setLayerVisible((prev) => ({ ...prev, [layer.id]: !(prev[layer.id] ?? true) }))}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 8, border: '1px solid var(--border-2)', background: 'transparent', color: (layerVisible[layer.id] ?? true) ? 'rgb(34,197,94)' : 'var(--text-3)', cursor: 'pointer', width: 28 }}
                  >
                    {(layerVisible[layer.id] ?? true) ? 'ON' : 'OFF'}
                  </button>
                  <span style={{ flex: 1 }}>
                    {layer.name} (z:{layer.baseZ}) / {rows.length} shapes
                  </span>
                </div>
                {(layerExpanded[layer.id] ?? true) && rows.map((row) => {
                  const active = row.shape.id === activeShapeId
                  const hovered = !active && row.shape.id === hoveredShapeId
                  const checked = selectedShapeIds.has(row.shape.id)
                  return (
                    <div
                      key={row.shape.id}
                      data-shape-row={row.shape.id}
                      onClick={() => onActivateShape(row.shape.id)}
                      onMouseEnter={() => setHoveredShapeId(row.shape.id)}
                      onMouseLeave={() => setHoveredShapeId((prev) => (prev === row.shape.id ? null : prev))}
                      style={{
                        padding: '6px 8px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: active ? '3px solid rgb(16,185,129)' : '3px solid transparent',
                        background: active ? 'rgba(16,185,129,0.12)' : hovered ? 'rgba(245,158,11,0.12)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => { e.stopPropagation(); toggleShapeSelection(row.shape.id) }}
                        />
                        <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.shape.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cycleShapeStatus(row.shape.id) }}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 7, padding: '0 4px', borderRadius: 2, border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}
                        >
                          {row.status === 'incomplete' ? '未' : row.status === 'completed' ? '完' : '削'}
                        </button>
                      </div>
                      <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-3)' }}>
                        h:{Math.round(row.placement.height)} / {row.vertices.isClosed ? 'closed' : `open(${row.vertices.dangling.length})`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div data-map-canvas="true" style={{ flex: 1, position: 'relative', background: 'var(--bg-1)', overflow: 'hidden', zIndex: 1 }} onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onDoubleClick={resetView}>
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '50% 50%', cursor: panDragRef.current ? 'grabbing' : 'default' }}
        >
          <style>{baseCssText}</style>
          <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
          {bridgeEntries.map((seg) => (
            <line
              key={seg.id}
              data-sp={seg.pathIndex}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke="rgb(148,163,184)"
              strokeWidth={0.9}
            />
          ))}
          {(vertexTargetRow?.vertices.all ?? []).map((v) => {
            const ref = v.refs[0]
            if (!ref) return null
            const selected = selectedVertices.some(s => s.key === v.key)
            const isDangling = (vertexTargetRow?.vertices.dangling ?? []).some((d) => d.key === v.key)
            return (
              <circle
                key={v.key}
                data-editor-vertex="true"
                data-shape-vertex={v.key}
                {...(isDangling ? { 'data-dangling-vertex': v.key } : {})}
                cx={v.x}
                cy={v.y}
                r={selected ? 1.1 : isDangling ? 0.9 : 0.7}
                fill={selected ? 'rgb(239,68,68)' : isDangling ? 'rgb(100,116,139)' : 'rgb(71,85,105)'}
                fillOpacity={selected ? 0.8 : isDangling ? 0.75 : 0.65}
                stroke="rgb(15,23,42)"
                strokeWidth={0.18}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onSelectVertex(v.key, ref) }}
                style={{ cursor: 'pointer' }}
              />
            )
          })}
        </svg>
      </div>

      <div style={{ width: 360, borderLeft: '1px solid var(--border-1)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', overflowY: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ padding: 8, borderBottom: '1px solid var(--border-1)', display: 'flex', gap: 6 }}>
          <button type="button" onClick={handleBackup} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8 }}>バックアップ</button>
          <button type="button" onClick={handleSave} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8 }}>{saveStatus === 'saving' ? '保存中' : '保存'}</button>
        </div>
        {saveError && <div style={{ padding: '4px 8px', color: 'rgb(239,68,68)', fontFamily: 'var(--font-mono)', fontSize: 8 }}>{saveError}</div>}

        <div style={{ padding: 8, borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, marginBottom: 6 }}>アクティブシェイプ</div>
          <div data-active-shape-label="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 6 }}>{activeRow?.shape.id ?? 'なし'}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select
              value={vertexTargetRow?.placement.layerId ?? ''}
              onChange={(e) => { if (vertexTargetRow) upsertPlacement(vertexTargetRow.shape.id, { layerId: e.target.value }) }}
              disabled={vertexTargetRow == null}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8 }}
            >
              {vertexTargetRow == null && <option value="">シェイプ未選択</option>}
              {displayLayers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input
              data-shape-height-input="true"
              type="number"
              min={0}
              step={1}
              value={vertexTargetRow?.placement.height ?? 0}
              disabled={vertexTargetRow == null}
              onChange={(e) => { if (vertexTargetRow) upsertPlacement(vertexTargetRow.shape.id, { height: Math.max(0, Number(e.target.value) || 0) }) }}
              style={{ width: 80, fontFamily: 'var(--font-mono)', fontSize: 8 }}
            />
          </div>
          <button
            type="button"
            data-add-bridge="true"
            disabled={vertexTargetRow == null || selectedVertices.length !== 2}
            onClick={addBridge}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 8 }}
          >
            穴頂点を接続 ({selectedVertices.length}/2)
          </button>
          <button
            type="button"
            data-delete-vertex="true"
            disabled={vertexTargetRow == null || selectedVertices.length === 0}
            onClick={removeSelectedVertices}
            style={{ width: '100%', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 8 }}
          >
            選択頂点を削除 ({selectedVertices.length})
          </button>
          <button
            type="button"
            data-delete-between-vertices="true"
            disabled={vertexTargetRow == null || selectedVertices.length !== 2}
            onClick={removeVerticesBetweenSelection}
            style={{ width: '100%', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 8 }}
          >
            2頂点間の中間頂点を削除
          </button>
        </div>

        <div style={{ padding: 8, borderBottom: '1px solid var(--border-1)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, marginBottom: 6 }}>レイヤー定義</div>
          <button type="button" onClick={addLayer} style={{ marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: 8 }}>レイヤー追加</button>
          {displayLayers.map((layer) => (
            <div key={layer.id} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 38px 42px', gap: 4, marginBottom: 4 }}>
              <input value={layer.name} onChange={(e) => updateLayer(layer.id, { name: e.target.value })} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }} />
              <input type="number" value={layer.baseZ} onChange={(e) => updateLayer(layer.id, { baseZ: Number(e.target.value) || 0 })} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }} />
              <input type="color" value={layer.color ?? '#64748b'} onChange={(e) => updateLayer(layer.id, { color: e.target.value })} style={{ padding: 0 }} />
              <button type="button" onClick={() => removeLayer(layer.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 7 }}>削除</button>
            </div>
          ))}
        </div>

        <div style={{ padding: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, marginBottom: 6 }}>階段/スロープ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
            <select value={transitionKind} onChange={(e) => setTransitionKind(e.target.value as 'stairs' | 'slope')} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>
              <option value="stairs">stairs</option>
              <option value="slope">slope</option>
            </select>
            <input type="number" min={0} placeholder="stepCount(任意)" value={transitionStepCountRaw} onChange={(e) => setTransitionStepCountRaw(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
            <select value={transitionFromLayer} onChange={(e) => setTransitionFromLayer(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>
              {displayLayers.map((l) => <option key={l.id} value={l.id}>from:{l.name}</option>)}
            </select>
            <select value={transitionToLayer} onChange={(e) => setTransitionToLayer(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>
              {displayLayers.map((l) => <option key={l.id} value={l.id}>to:{l.name}</option>)}
            </select>
          </div>
          <input placeholder="lower edge path indices (e.g. 10,11)" value={transitionLowerRaw} onChange={(e) => setTransitionLowerRaw(e.target.value)} style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 8 }} />
          <input placeholder="upper edge path indices (e.g. 22,23)" value={transitionUpperRaw} onChange={(e) => setTransitionUpperRaw(e.target.value)} style={{ width: '100%', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 8 }} />
          <button type="button" onClick={addTransition} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 6 }}>遷移追加</button>
          {shapeTransitions.map((tr) => (
            <div key={tr.id} style={{ borderTop: '1px solid var(--border-1)', paddingTop: 4, marginTop: 4 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}>{tr.kind} {tr.fromLayerId}→{tr.toLayerId} {tr.stepCount != null ? `(steps:${tr.stepCount})` : '(no steps)'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-3)' }}>low:{tr.lowerEdgePathIndices.join(',')} / up:{tr.upperEdgePathIndices.join(',')}</div>
              <button type="button" onClick={() => removeTransition(tr.id)} style={{ fontFamily: 'var(--font-mono)', fontSize: 7 }}>削除</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
