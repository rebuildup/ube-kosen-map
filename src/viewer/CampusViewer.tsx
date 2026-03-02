/**
 * CampusViewer — Campus map viewer for staff and students.
 *
 * Layout:
 *   [FloorSelector + LayerControl] | [ViewModeToggle + Map Area] | [SearchPanel + RoutePanel]
 *
 * Routing UX:
 *   - Click a node on map OR select from SearchPanel → set as start
 *   - Second selection → set as goal → A* runs automatically
 *   - RoutePanel shows result; "クリア" resets
 *
 * [§0] React DOM only — no Canvas/WebGL
 * [P-3] Pluggable routing profiles (DEFAULT, CART, RAIN, ACCESSIBLE)
 * [P-4] ViewMode-driven disclosure: aerial / floor / cross-section / pseudo-3d / building
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import type { CampusGraph, NodeId } from '../core/schema'
import type { RoutingProfile } from '../core/routing/cost'
import type { Route } from '../core/routing'
import type { ViewMode } from '../components/ViewModeToggle/ViewModeToggle'
import { StructuralSvgPseudo3D, ShapeLayerEditor } from '../components/CampusMap'
import { FloorSelector } from '../components/FloorSelector/FloorSelector'
import { LayerControl } from '../components/LayerControl/LayerControl'
import { SearchPanel } from '../components/SearchPanel/SearchPanel'
import { RoutePanel } from '../components/RoutePanel/RoutePanel'
import { ViewModeToggle } from '../components/ViewModeToggle/ViewModeToggle'
import { CrossSectionView } from '../components/CrossSectionView/CrossSectionView'
import { findRoute } from '../core/routing/astar'
import {
  PROFILE_DEFAULT, PROFILE_CART, PROFILE_RAIN, PROFILE_ACCESSIBLE,
  DEFAULT_CONTEXT,
} from '../core/routing/cost'
import { getLayerVisibility } from '../core/zoom'
import page1SvgRaw from '../../docs/reference/page_1.svg?raw'
import type { Page1InspectConfig } from '../components/CampusMap/page1InspectTypes'
import { applyShapeEdits } from '../components/CampusMap/page1ShapeEdits'

const DEFAULT_INSPECT_CONFIG: Page1InspectConfig = {
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
  shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
}

const PROFILES: RoutingProfile[] = [
  PROFILE_DEFAULT, PROFILE_CART, PROFILE_RAIN, PROFILE_ACCESSIBLE,
]

const PROFILE_LABELS: Record<string, string> = {
  default:    '標準',
  cart:       '台車',
  rain:       '雨天',
  accessible: 'バリアフリー',
}

export interface CampusViewerProps {
  graph: CampusGraph
}

const DEFAULT_LAYER_HEIGHT = 2
const DEFAULT_PSEUDO_3D_Z_SCALE = 6
const parsePathIndexList = (raw: string): number[] => raw
  .split(',')
  .map((x) => Number(x.trim()))
  .filter((n) => Number.isFinite(n) && n >= 0)
const uniqueSorted = (items: number[]): number[] => [...new Set(items)].sort((a, b) => a - b)

const resolveEffectiveHiddenShapeSet = (
  shapeIds: string[],
  hiddenShapeIds: string[] | undefined,
  shapeStatus: Page1InspectConfig['shapeStatus'],
): Set<string> => {
  const hiddenSet = new Set(hiddenShapeIds ?? [])
  if (hiddenSet.size === 0) return hiddenSet
  const deletedCount = Object.values(shapeStatus ?? {}).filter((s) => s === 'deleted').length
  // Legacy inspector data may carry "all hidden" even when shapes are active.
  const looksLikeLegacyAllHidden = hiddenSet.size >= shapeIds.length && deletedCount === 0
  return looksLikeLegacyAllHidden ? new Set<string>() : hiddenSet
}

const isSameConfig = (a: Page1InspectConfig, b: Page1InspectConfig): boolean => (
  JSON.stringify(a) === JSON.stringify(b)
)

export const CampusViewer: React.FC<CampusViewerProps> = ({ graph }) => {
  const [viewMode, setViewMode]       = useState<ViewMode>('floor')
  const [activeFloorId, setActiveFloorId] = useState<string | undefined>(
    Object.keys(graph.floors)[0],
  )
  const [startNodeId, setStartNodeId] = useState<NodeId | null>(null)
  const [goalNodeId,  setGoalNodeId]  = useState<NodeId | null>(null)
  const [profileIndex, setProfileIndex] = useState(0)
  const [visibility, setVisibility]   = useState({ ...getLayerVisibility('Z4'), validation: false })
  const [hideNonBuildingSymbols, setHideNonBuildingSymbols] = useState(true)
  const [page1InspectConfig, setPage1InspectConfig] = useState<Page1InspectConfig>(DEFAULT_INSPECT_CONFIG)
  const [selectedShapeId3D, setSelectedShapeId3D] = useState<string | null>(null)
  const [selectedShapeIds3D, setSelectedShapeIds3D] = useState<Set<string>>(new Set())
  const [zScale3D, setZScale3D] = useState(DEFAULT_PSEUDO_3D_Z_SCALE)
  const [showGrid3D, setShowGrid3D] = useState(true)
  const [gridSpacing3D, setGridSpacing3D] = useState(120)
  const [hiddenLayerIds3D, setHiddenLayerIds3D] = useState<Set<string>>(new Set())
  const [hiddenShapeIds3D, setHiddenShapeIds3D] = useState<Set<string>>(new Set())
  const [shapeFilter3D, setShapeFilter3D] = useState('')
  const [batchLayerId3D, setBatchLayerId3D] = useState('')
  const [batchHeight3D, setBatchHeight3D] = useState(0)
  const [renderSolid3D, setRenderSolid3D] = useState(false)
  const [pathDeleteRaw3D, setPathDeleteRaw3D] = useState('')
  const [pathRestoreRaw3D, setPathRestoreRaw3D] = useState('')
  const [shapePathRaw3D, setShapePathRaw3D] = useState('')
  const [newShapePathsRaw3D, setNewShapePathsRaw3D] = useState('')
  const [newShapeLayerId3D, setNewShapeLayerId3D] = useState('')
  const [newShapeHeight3D, setNewShapeHeight3D] = useState(0)

  const loadInspectConfig = useCallback(() => {
    fetch('/api/load-config?filename=page1-inspect-config.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((cfg: Page1InspectConfig) => setPage1InspectConfig(cfg))
      .catch(() => {})
  }, [])

  const handleInspectConfigChange = useCallback((next: Page1InspectConfig) => {
    setPage1InspectConfig((prev) => (isSameConfig(prev, next) ? prev : next))
  }, [])

  useEffect(() => {
    if (viewMode === 'inspect' || viewMode === 'pseudo-3d') loadInspectConfig()
  }, [viewMode, loadInspectConfig])

  const shapeRows3D = useMemo(() => {
    const shapes = applyShapeEdits(page1InspectConfig.customShapes ?? [], page1InspectConfig.shapeEdits)
    const hiddenShapeSet = resolveEffectiveHiddenShapeSet(
      shapes.map((s) => s.id),
      page1InspectConfig.hiddenShapeIds,
      page1InspectConfig.shapeStatus,
    )
    const layers = page1InspectConfig.shapeLayers ?? []
    const layerById = new Map(layers.map((l) => [l.id, l]))
    const uniqueBaseZ = [...new Set(
      layers
        .map((l) => (Number.isFinite(l.baseZ) ? l.baseZ : 0))
        .sort((a, b) => a - b),
    )]
    const inferredHeightByLayerId = new Map(
      layers.map((layer) => {
        const z = Number.isFinite(layer.baseZ) ? layer.baseZ : 0
        const next = uniqueBaseZ.find((v) => v > z)
        const inferredHeight = next != null ? Math.max(1, next - z) : DEFAULT_LAYER_HEIGHT
        return [layer.id, inferredHeight]
      }),
    )
    const defaultLayerId = page1InspectConfig.shapeLayers?.[0]?.id ?? 'layer-ground'
    const placements = page1InspectConfig.shapePlacements ?? {}
    const deletedPathSet = new Set(
      Object.entries(page1InspectConfig.pathStatus ?? {})
        .filter(([, status]) => status === 'deleted')
        .map(([k]) => Number(k)),
    )
    return shapes
      .filter((s) => !hiddenShapeSet.has(s.id))
      .filter((s) => (page1InspectConfig.shapeStatus?.[s.id] ?? 'incomplete') !== 'deleted')
      .map((s) => {
        const pathIndices = s.pathIndices.filter((pid) => !deletedPathSet.has(pid))
        if (pathIndices.length === 0) return null
        const explicitPlacement = placements[s.id]
        const placement = explicitPlacement ?? {
          shapeId: s.id,
          layerId: defaultLayerId,
          height: page1InspectConfig.shapeHeights?.[s.id] ?? 0,
        }
        const layer = layerById.get(placement.layerId)
        if (layer == null) return null
        const layerSpan = inferredHeightByLayerId.get(placement.layerId) ?? DEFAULT_LAYER_HEIGHT
        const requestedHeight = placement.height > 0 ? placement.height : layerSpan
        const resolvedHeight = Math.max(1, Math.min(requestedHeight, layerSpan))
        return {
          shapeId: s.id,
          layerId: placement.layerId,
          pathIndices,
          baseZ: layer.baseZ,
          height: resolvedHeight,
          color: layer.color ?? '#22c55e',
        }
      })
      .filter((s): s is {
        shapeId: string
        layerId: string
        pathIndices: number[]
        baseZ: number
        height: number
        color: string
      } => s != null)
      .filter((s) => s.height > 0)

  }, [page1InspectConfig])

  const shapeFaces = useMemo(() => {
    // 3D side input is layer-based: one floor plane per layer.
    const byLayer = new Map<string, { baseZ: number; color: string; pathSet: Set<number>; minHeight: number }>()
    for (const row of shapeRows3D) {
      if (hiddenLayerIds3D.has(row.layerId)) continue
      if (hiddenShapeIds3D.has(row.shapeId)) continue
      const existing = byLayer.get(row.layerId) ?? {
        baseZ: row.baseZ,
        color: row.color,
        pathSet: new Set<number>(),
        minHeight: row.height,
      }
      for (const pid of row.pathIndices) existing.pathSet.add(pid)
      existing.minHeight = Math.min(existing.minHeight, row.height)
      byLayer.set(row.layerId, existing)
    }

    return Array.from(byLayer.entries()).map(([layerId, g]) => ({
      id: layerId,
      pathIndices: Array.from(g.pathSet).sort((a, b) => a - b),
      baseZ: g.baseZ,
      height: g.minHeight,
      color: g.color,
    }))
  }, [shapeRows3D, hiddenLayerIds3D, hiddenShapeIds3D])

  const shapeIdsByPathIndex3D = useMemo(() => {
    const rowsSorted = [...shapeRows3D]
      .filter((r) => !hiddenLayerIds3D.has(r.layerId) && !hiddenShapeIds3D.has(r.shapeId))
      .sort((a, b) => b.baseZ - a.baseZ)
    const out = new Map<number, string[]>()
    for (const row of rowsSorted) {
      for (const pid of row.pathIndices) {
        const arr = out.get(pid) ?? []
        arr.push(row.shapeId)
        out.set(pid, arr)
      }
    }
    return out
  }, [shapeRows3D, hiddenLayerIds3D, hiddenShapeIds3D])

  const selectedShapeRow3D = useMemo(
    () => shapeRows3D.find((r) => r.shapeId === selectedShapeId3D) ?? null,
    [shapeRows3D, selectedShapeId3D],
  )
  const selectedShapeRows3D = useMemo(
    () => shapeRows3D.filter((r) => selectedShapeIds3D.has(r.shapeId)),
    [shapeRows3D, selectedShapeIds3D],
  )

  const handlePathSelect3D = useCallback((pathIndex: number, options?: { additive: boolean; toggle: boolean }) => {
    const ids = shapeIdsByPathIndex3D.get(pathIndex) ?? []
    if (ids.length === 0) return
    setSelectedShapeId3D((prev) => {
      if (prev == null) return ids[0] ?? null
      const idx = ids.indexOf(prev)
      if (idx < 0) return ids[0] ?? null
      return ids[(idx + 1) % ids.length] ?? null
    })
    setSelectedShapeIds3D((prevSet) => {
      const next = new Set(prevSet)
      const currentPrimary = selectedShapeId3D
      const currentIdx = currentPrimary == null ? -1 : ids.indexOf(currentPrimary)
      const clickedId = currentIdx < 0 ? (ids[0] ?? null) : (ids[(currentIdx + 1) % ids.length] ?? null)
      if (clickedId == null) return next
      if (options?.additive) {
        if (options.toggle && next.has(clickedId)) next.delete(clickedId)
        else next.add(clickedId)
        return next
      }
      next.clear()
      next.add(clickedId)
      return next
    })
  }, [shapeIdsByPathIndex3D, selectedShapeId3D])

  const updateSelectedShapePlacement3D = useCallback((patch: Partial<{ layerId: string; height: number }>) => {
    if (selectedShapeRow3D == null) return
    const shapeId = selectedShapeRow3D.shapeId
    setPage1InspectConfig((prev) => {
      const defaultLayerId = prev.shapeLayers?.[0]?.id ?? 'layer-ground'
      const existing = prev.shapePlacements?.[shapeId] ?? {
        shapeId,
        layerId: defaultLayerId,
        height: prev.shapeHeights?.[shapeId] ?? 0,
      }
      const nextPlacement = {
        ...existing,
        ...(patch.layerId != null ? { layerId: patch.layerId } : {}),
        ...(patch.height != null ? { height: Math.max(0, patch.height) } : {}),
      }
      return {
        ...prev,
        shapePlacements: {
          ...(prev.shapePlacements ?? {}),
          [shapeId]: nextPlacement,
        },
      }
    })
  }, [selectedShapeRow3D])

  const updateShapesPlacement3D = useCallback((shapeIds: string[], patch: Partial<{ layerId: string; height: number }>) => {
    if (shapeIds.length === 0) return
    setPage1InspectConfig((prev) => {
      const defaultLayerId = prev.shapeLayers?.[0]?.id ?? 'layer-ground'
      const nextPlacements = { ...(prev.shapePlacements ?? {}) }
      for (const shapeId of shapeIds) {
        const existing = nextPlacements[shapeId] ?? {
          shapeId,
          layerId: defaultLayerId,
          height: prev.shapeHeights?.[shapeId] ?? 0,
        }
        nextPlacements[shapeId] = {
          ...existing,
          ...(patch.layerId != null ? { layerId: patch.layerId } : {}),
          ...(patch.height != null ? { height: Math.max(0, patch.height) } : {}),
        }
      }
      return { ...prev, shapePlacements: nextPlacements }
    })
  }, [])

  const applyPathStatus3D = useCallback((pathIndices: number[], status: 'deleted' | 'incomplete') => {
    if (pathIndices.length === 0) return
    setPage1InspectConfig((prev) => {
      const nextPathStatus = { ...(prev.pathStatus ?? {}) }
      for (const pid of pathIndices) {
        if (status === 'incomplete') delete nextPathStatus[String(pid)]
        else nextPathStatus[String(pid)] = 'deleted'
      }
      return { ...prev, pathStatus: nextPathStatus }
    })
  }, [])

  const updateSingleShapePaths3D = useCallback((shapeId: string, updater: (current: number[]) => number[]) => {
    setPage1InspectConfig((prev) => {
      const customShapes = [...(prev.customShapes ?? [])]
      const idx = customShapes.findIndex((s) => s.id === shapeId)
      if (idx < 0) return prev
      const target = customShapes[idx]
      if (!target) return prev
      const nextPaths = uniqueSorted(updater(target.pathIndices ?? []))
      customShapes[idx] = { ...target, pathIndices: nextPaths }
      return { ...prev, customShapes }
    })
  }, [])

  const createShapeFromPaths3D = useCallback((pathIndices: number[]) => {
    if (pathIndices.length === 0) return
    setPage1InspectConfig((prev) => {
      const id = `cs-${Date.now()}`
      const shape = {
        id,
        pathIndices: uniqueSorted(pathIndices),
        isClosed: true,
        hasFill: true,
      }
      const layerId = newShapeLayerId3D || (prev.shapeLayers?.[0]?.id ?? 'layer-ground')
      const nextPlacements = {
        ...(prev.shapePlacements ?? {}),
        [id]: { shapeId: id, layerId, height: Math.max(0, newShapeHeight3D) },
      }
      return {
        ...prev,
        customShapes: [...(prev.customShapes ?? []), shape],
        shapePlacements: nextPlacements,
      }
    })
  }, [newShapeLayerId3D, newShapeHeight3D])

  const shapeTransitions3D = useMemo(() => {
    const layerById = new Map((page1InspectConfig.shapeLayers ?? []).map((l) => [l.id, l]))
    return (page1InspectConfig.shapeTransitions ?? []).map((tr) => ({
      id: tr.id,
      kind: tr.kind,
      fromZ: layerById.get(tr.fromLayerId)?.baseZ ?? 0,
      toZ: layerById.get(tr.toLayerId)?.baseZ ?? 0,
      lowerPathIndices: tr.lowerEdgePathIndices,
      upperPathIndices: tr.upperEdgePathIndices,
      stepCount: tr.stepCount,
    }))
  }, [page1InspectConfig])

  const visiblePathIndices = useMemo(() => {
    const out = new Set<number>()
    for (const row of shapeRows3D) {
      if (hiddenLayerIds3D.has(row.layerId)) continue
      if (hiddenShapeIds3D.has(row.shapeId)) continue
      for (const pid of row.pathIndices) out.add(pid)
    }
    return Array.from(out).sort((a, b) => a - b)
  }, [shapeRows3D, hiddenLayerIds3D, hiddenShapeIds3D])
  const selectedPathIndices3D = useMemo(() => {
    const out = new Set<number>()
    for (const row of selectedShapeRows3D) {
      for (const pid of row.pathIndices) out.add(pid)
    }
    return Array.from(out)
  }, [selectedShapeRows3D])

  const gridLevels3D = useMemo(() => (
    (page1InspectConfig.shapeLayers ?? [])
      .filter((l) => !hiddenLayerIds3D.has(l.id))
      .map((l) => l.baseZ)
  ), [page1InspectConfig.shapeLayers, hiddenLayerIds3D])

  useEffect(() => {
    if (selectedShapeId3D == null) return
    const stillExists = shapeRows3D.some((r) => r.shapeId === selectedShapeId3D)
    if (!stillExists) setSelectedShapeId3D(null)
  }, [shapeRows3D, selectedShapeId3D])
  useEffect(() => {
    setSelectedShapeIds3D((prev) => {
      if (prev.size === 0) return prev
      const exists = new Set(shapeRows3D.map((r) => r.shapeId))
      const next = new Set(Array.from(prev).filter((id) => exists.has(id)))
      return next
    })
  }, [shapeRows3D])
  useEffect(() => {
    if (batchLayerId3D !== '') return
    const first = page1InspectConfig.shapeLayers?.[0]?.id
    if (first != null) setBatchLayerId3D(first)
  }, [batchLayerId3D, page1InspectConfig.shapeLayers])
  useEffect(() => {
    if (newShapeLayerId3D !== '') return
    const first = page1InspectConfig.shapeLayers?.[0]?.id
    if (first != null) setNewShapeLayerId3D(first)
  }, [newShapeLayerId3D, page1InspectConfig.shapeLayers])

  const profile = PROFILES[profileIndex] ?? PROFILE_DEFAULT

  // ── A* routing ─────────────────────────────────────────────────────────────

  const routeResult = useMemo(() => {
    if (!startNodeId || !goalNodeId) return null
    return findRoute(graph, startNodeId, goalNodeId, profile, DEFAULT_CONTEXT, { k: 3 })
  }, [graph, startNodeId, goalNodeId, profile])

  const route: Route | null =
    routeResult?.ok ? (routeResult.routes[0] ?? null) : null
  const alternatives: Route[] =
    routeResult?.ok ? routeResult.routes.slice(1) : []

  const floors = Object.values(graph.floors)

  // ── Node picking: first click = start, second = goal, third = reset ────────

  const pickNode = useCallback((nodeId: NodeId) => {
    if (!startNodeId) {
      setStartNodeId(nodeId)
    } else if (!goalNodeId) {
      setGoalNodeId(nodeId)
    } else {
      setStartNodeId(nodeId)
      setGoalNodeId(null)
    }
  }, [startNodeId, goalNodeId])

  const handleSearchSelect = useCallback((id: string, kind: 'node' | 'space') => {
    if (kind !== 'node') return
    pickNode(id as NodeId)
  }, [pickNode])

  const handleNodeClick = useCallback((id: string) => {
    pickNode(id as NodeId)
  }, [pickNode])

  const clearRoute = useCallback(() => {
    setStartNodeId(null)
    setGoalNodeId(null)
  }, [])

  // ── Map area: switches on viewMode ─────────────────────────────────────────

  const mapArea = (() => {
    if (viewMode === 'inspect') {
      return (
        <ShapeLayerEditor
          rawSvg={page1SvgRaw}
          initialConfig={page1InspectConfig}
          configFileName="page1-inspect-config.json"
          onConfigChange={handleInspectConfigChange}
        />
      )
    }
    if (viewMode === 'cross-section') {
      return (
        <CrossSectionView
          graph={graph}
          direction="south"
          width={800}
          height={400}
        />
      )
    }
    if (viewMode === 'pseudo-3d') {
      return (
        <StructuralSvgPseudo3D
          rawSvg={page1SvgRaw}
          mode="3d"
          hideNonBuildingSymbols={hideNonBuildingSymbols}
          showWalls={renderSolid3D}
          zScale={zScale3D}
          renderAsLayerFloors={!renderSolid3D}
          onPathSelect={handlePathSelect3D}
          selectedPathIndices={selectedPathIndices3D}
          showGrid={showGrid3D}
          gridSpacing={gridSpacing3D}
          gridLevels={gridLevels3D}
          showLayerToggles
          shapeFaces={shapeFaces}
          shapeTransitions={shapeTransitions3D}
          visiblePathIndices={visiblePathIndices}
        />
      )
    }
    return (
      <StructuralSvgPseudo3D
        rawSvg={page1SvgRaw}
        mode="flat"
        hideNonBuildingSymbols={hideNonBuildingSymbols}
      />
    )
  })()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="campus-viewer"
      style={{
        display: 'flex', width: '100%', height: '100%',
        background: 'var(--bg-1)', color: 'var(--text-1)',
        overflow: 'hidden',
      }}
    >
      {/* ── Left: floor selector + layer control ─────────────────────────── */}
      <div style={{
        width: 152, flexShrink: 0,
        borderRight: '1px solid var(--border-1)',
        background: 'var(--bg-2)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div className="panel-label">フロア</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <FloorSelector
            floors={floors}
            activeFloorId={activeFloorId}
            onFloorChange={setActiveFloorId}
          />
        </div>
        <div style={{ borderTop: '1px solid var(--border-1)' }}>
          <div className="panel-label">レイヤー</div>
          <LayerControl
            visibility={visibility}
            onChange={setVisibility}
          />
        </div>
      </div>

      {/* ── Center: view mode toolbar + map ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* View controls bar */}
        <div style={{
          height: 38, flexShrink: 0,
          background: 'var(--bg-2)', borderBottom: '1px solid var(--border-1)',
          display: 'flex', alignItems: 'center', padding: '0 10px', gap: 10,
        }}>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <button
            onClick={() => setHideNonBuildingSymbols((v) => !v)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.05em',
              padding: '2px 8px',
              borderRadius: 2,
              border: '1px solid',
              borderColor: hideNonBuildingSymbols ? 'var(--accent)' : 'var(--border-2)',
              background: hideNonBuildingSymbols ? 'var(--accent-bg)' : 'transparent',
              color: hideNonBuildingSymbols ? 'var(--accent)' : 'var(--text-3)',
              cursor: 'pointer',
            }}
            aria-label="non-building symbol toggle"
          >
            記号非表示
          </button>
          {viewMode === 'pseudo-3d' && (
            <div
              data-3d-edit-panel="true"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)' }}>
                {selectedShapeRow3D ? `選択: ${selectedShapeRow3D.shapeId}` : 'シェイプ未選択'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                {selectedShapeIds3D.size}選択
              </span>
              <select
                aria-label="3d shape layer"
                disabled={selectedShapeRow3D == null}
                value={selectedShapeRow3D?.layerId ?? ''}
                onChange={(e) => updateSelectedShapePlacement3D({ layerId: e.target.value })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
              >
                {(page1InspectConfig.shapeLayers ?? [])
                  .slice()
                  .sort((a, b) => a.baseZ - b.baseZ)
                  .map((layer) => (
                    <option key={layer.id} value={layer.id}>
                      {layer.name} (z:{layer.baseZ})
                    </option>
                  ))}
              </select>
              <input
                aria-label="3d shape height"
                type="number"
                min={0}
                disabled={selectedShapeRow3D == null}
                value={selectedShapeRow3D?.height ?? 0}
                onChange={(e) => updateSelectedShapePlacement3D({ height: Number(e.target.value) || 0 })}
                style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 9 }}
              />
              <button
                type="button"
                onClick={() => { setSelectedShapeIds3D(new Set()); setSelectedShapeId3D(null) }}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
              >
                選択クリア
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                <input type="checkbox" checked={renderSolid3D} onChange={(e) => setRenderSolid3D(e.target.checked)} />
                立体描画
              </label>
            </div>
          )}
          {/* Profile selector */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            {PROFILES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setProfileIndex(i)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9, letterSpacing: '0.05em',
                  padding: '2px 8px', borderRadius: 2,
                  border: '1px solid',
                  borderColor: i === profileIndex ? 'var(--accent)' : 'var(--border-2)',
                  background: i === profileIndex ? 'var(--accent-bg)' : 'transparent',
                  color: i === profileIndex ? 'var(--accent)' : 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                {PROFILE_LABELS[p.id] ?? p.id}
              </button>
            ))}
          </div>
        </div>

        {/* Map area */}
        <div className="canvas-grid" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {mapArea}
          {viewMode === 'pseudo-3d' && (
            <div style={{ position: 'absolute', right: 8, top: 8, width: 300, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '86%', overflow: 'auto' }}>
              <div
                style={{
                  background: 'rgba(15,23,42,0.78)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: 6,
                  padding: 8,
                  color: '#e2e8f0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                }}
              >
                <div style={{ marginBottom: 6 }}>View / Grid</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span>Z</span>
                  <input aria-label="3d z scale" type="range" min={1} max={30} step={1} value={zScale3D} onChange={(e) => setZScale3D(Number(e.target.value))} />
                  <span>{zScale3D}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={showGrid3D} onChange={(e) => setShowGrid3D(e.target.checked)} />
                    Grid
                  </label>
                  <input
                    aria-label="3d grid spacing"
                    type="number"
                    min={20}
                    step={10}
                    value={gridSpacing3D}
                    onChange={(e) => setGridSpacing3D(Math.max(20, Number(e.target.value) || 120))}
                    style={{ width: 72, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15,23,42,0.78)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: 6,
                  padding: 8,
                  color: '#e2e8f0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                }}
              >
                <div style={{ marginBottom: 6 }}>Layer Visible</div>
                {(page1InspectConfig.shapeLayers ?? [])
                  .slice()
                  .sort((a, b) => b.baseZ - a.baseZ)
                  .map((layer) => {
                    const checked = !hiddenLayerIds3D.has(layer.id)
                    return (
                      <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setHiddenLayerIds3D((prev) => {
                            const next = new Set(prev)
                            if (next.has(layer.id)) next.delete(layer.id)
                            else next.add(layer.id)
                            return next
                          })}
                        />
                        <span>{layer.name} (z:{layer.baseZ})</span>
                      </label>
                    )
                  })}
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={() => setHiddenLayerIds3D(new Set())} style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    レイヤー全表示
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15,23,42,0.78)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: 6,
                  padding: 8,
                  color: '#e2e8f0',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                }}
              >
                <div style={{ marginBottom: 6 }}>Shape / Path Editor</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input
                    aria-label="3d shape filter"
                    value={shapeFilter3D}
                    onChange={(e) => setShapeFilter3D(e.target.value)}
                    placeholder="shape filter"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                  <button
                    type="button"
                    disabled={selectedShapeIds3D.size === 0}
                    onClick={() => setHiddenShapeIds3D((prev) => {
                      const next = new Set(prev)
                      for (const id of selectedShapeIds3D) next.add(id)
                      return next
                    })}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    選択非表示
                  </button>
                </div>
                <div style={{ marginBottom: 6 }}>Path Edit</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    aria-label="3d delete paths"
                    value={pathDeleteRaw3D}
                    onChange={(e) => setPathDeleteRaw3D(e.target.value)}
                    placeholder="delete: 1,2,3"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                  <button type="button" onClick={() => applyPathStatus3D(parsePathIndexList(pathDeleteRaw3D), 'deleted')} style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    削除
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input
                    aria-label="3d restore paths"
                    value={pathRestoreRaw3D}
                    onChange={(e) => setPathRestoreRaw3D(e.target.value)}
                    placeholder="restore: 1,2,3"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                  <button type="button" onClick={() => applyPathStatus3D(parsePathIndexList(pathRestoreRaw3D), 'incomplete')} style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    復元
                  </button>
                </div>
                <div style={{ marginBottom: 6 }}>Shape Path Edit</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    aria-label="3d shape path edit"
                    value={shapePathRaw3D}
                    onChange={(e) => setShapePathRaw3D(e.target.value)}
                    placeholder="paths: 10,11"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                  <button
                    type="button"
                    disabled={selectedShapeRow3D == null}
                    onClick={() => {
                      if (selectedShapeRow3D == null) return
                      const list = parsePathIndexList(shapePathRaw3D)
                      updateSingleShapePaths3D(selectedShapeRow3D.shapeId, (cur) => [...cur, ...list])
                    }}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    disabled={selectedShapeRow3D == null}
                    onClick={() => {
                      if (selectedShapeRow3D == null) return
                      const removeSet = new Set(parsePathIndexList(shapePathRaw3D))
                      updateSingleShapePaths3D(selectedShapeRow3D.shapeId, (cur) => cur.filter((pid) => !removeSet.has(pid)))
                    }}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    除去
                  </button>
                </div>
                <div style={{ marginBottom: 6 }}>New Shape</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    aria-label="3d new shape paths"
                    value={newShapePathsRaw3D}
                    onChange={(e) => setNewShapePathsRaw3D(e.target.value)}
                    placeholder="new shape paths"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <select
                    aria-label="3d new shape layer"
                    value={newShapeLayerId3D}
                    onChange={(e) => setNewShapeLayerId3D(e.target.value)}
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    {(page1InspectConfig.shapeLayers ?? []).map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                  <input
                    aria-label="3d new shape height"
                    type="number"
                    min={0}
                    value={newShapeHeight3D}
                    onChange={(e) => setNewShapeHeight3D(Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: 64, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                  <button type="button" onClick={() => createShapeFromPaths3D(parsePathIndexList(newShapePathsRaw3D))} style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    生成
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <select
                    aria-label="3d batch layer"
                    value={batchLayerId3D}
                    onChange={(e) => setBatchLayerId3D(e.target.value)}
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    {(page1InspectConfig.shapeLayers ?? []).map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={selectedShapeIds3D.size === 0}
                    onClick={() => updateShapesPlacement3D(Array.from(selectedShapeIds3D), { layerId: batchLayerId3D })}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    一括Layer
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input
                    aria-label="3d batch height"
                    type="number"
                    min={0}
                    value={batchHeight3D}
                    onChange={(e) => setBatchHeight3D(Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: 72, fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  />
                  <button
                    type="button"
                    disabled={selectedShapeIds3D.size === 0}
                    onClick={() => updateShapesPlacement3D(Array.from(selectedShapeIds3D), { height: batchHeight3D })}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}
                  >
                    一括Height
                  </button>
                </div>
                {shapeRows3D
                  .slice()
                  .filter((row) => (
                    shapeFilter3D.trim() === ''
                    || row.shapeId.toLowerCase().includes(shapeFilter3D.trim().toLowerCase())
                    || row.layerId.toLowerCase().includes(shapeFilter3D.trim().toLowerCase())
                  ))
                  .sort((a, b) => a.shapeId.localeCompare(b.shapeId))
                  .map((row) => {
                    const checked = !hiddenShapeIds3D.has(row.shapeId)
                    const selected = selectedShapeIds3D.has(row.shapeId)
                    return (
                      <label key={row.shapeId} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, background: selected ? 'rgba(56,189,248,0.22)' : 'transparent' }}>
                        <input
                          aria-label={`3d shape select ${row.shapeId}`}
                          type="checkbox"
                          checked={selected}
                          onChange={() => setSelectedShapeIds3D((prev) => {
                            const next = new Set(prev)
                            if (next.has(row.shapeId)) next.delete(row.shapeId)
                            else next.add(row.shapeId)
                            return next
                          })}
                        />
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setHiddenShapeIds3D((prev) => {
                            const next = new Set(prev)
                            if (next.has(row.shapeId)) next.delete(row.shapeId)
                            else next.add(row.shapeId)
                            return next
                          })}
                        />
                        <span>{row.shapeId} [{row.layerId}]</span>
                      </label>
                    )
                  })}
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setHiddenShapeIds3D(new Set())} style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    シェイプ全表示
                  </button>
                  <button type="button" onClick={() => { setHiddenLayerIds3D(new Set()); setHiddenShapeIds3D(new Set()) }} style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    全表示に戻す
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: search + routing ───────────────────────────────────────── */}
      <div style={{
        width: 256, flexShrink: 0,
        borderLeft: '1px solid var(--border-1)',
        background: 'var(--bg-2)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--border-1)' }}>
          <div className="panel-label" style={{ padding: '0 0 4px' }}>施設検索</div>
          <SearchPanel graph={graph} onSelect={handleSearchSelect} />
        </div>

        {/* Route endpoints */}
        <div style={{
          padding: '8px 10px',
          borderBottom: '1px solid var(--border-1)',
          flexShrink: 0,
        }}>
          <div className="panel-label" style={{ padding: '0 0 6px' }}>経路</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: startNodeId ? 'var(--green)' : 'var(--text-3)' }}>
                {startNodeId ? startNodeId.slice(0, 14) + '…' : '出発地を選択'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: goalNodeId ? 'var(--orange)' : 'var(--text-3)' }}>
                {goalNodeId ? goalNodeId.slice(0, 14) + '…' : '目的地を選択'}
              </span>
            </div>
          </div>
          {(startNodeId || goalNodeId) && (
            <button
              onClick={clearRoute}
              style={{
                marginTop: 6,
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.05em',
                padding: '2px 8px', borderRadius: 2,
                border: '1px solid var(--border-2)',
                background: 'transparent', color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Route result */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <RoutePanel
            route={route}
            alternatives={alternatives}
          />
        </div>
      </div>
    </div>
  )
}
