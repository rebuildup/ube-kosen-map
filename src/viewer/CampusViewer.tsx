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

import React, { useState, useCallback, useMemo } from 'react'
import type { CampusGraph, NodeId } from '../core/schema'
import type { RoutingProfile } from '../core/routing/cost'
import type { Route } from '../core/routing'
import type { ViewMode } from '../components/ViewModeToggle/ViewModeToggle'
import { StructuralSvgPseudo3D } from '../components/CampusMap'
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
