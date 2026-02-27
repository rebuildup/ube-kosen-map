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
import { CampusMap } from '../components/CampusMap'
import { FloorSelector } from '../components/FloorSelector/FloorSelector'
import { LayerControl } from '../components/LayerControl/LayerControl'
import { SearchPanel } from '../components/SearchPanel/SearchPanel'
import { RoutePanel } from '../components/RoutePanel/RoutePanel'
import { ViewModeToggle } from '../components/ViewModeToggle/ViewModeToggle'
import { CrossSectionView } from '../components/CrossSectionView/CrossSectionView'
import { Pseudo3DView } from '../components/Pseudo3DView/Pseudo3DView'
import { findRoute } from '../core/routing/astar'
import {
  PROFILE_DEFAULT, PROFILE_CART, PROFILE_RAIN, PROFILE_ACCESSIBLE,
  DEFAULT_CONTEXT,
} from '../core/routing/cost'
import { getLayerVisibility } from '../core/zoom'

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
        <Pseudo3DView
          graph={graph}
          floorSpacing={80}
        />
      )
    }
    // aerial / floor / building → CampusMap (same component, different zoom context)
    return (
      <CampusMap
        graph={graph}
        selectedNodeId={startNodeId ?? undefined}
        onNodeClick={handleNodeClick}
      />
    )
  })()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="campus-viewer"
      style={{
        display: 'flex', width: '100vw', height: '100vh',
        background: '#0f172a', color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── Left: floor selector + layer control ─────────────────────────── */}
      <div style={{
        width: 160, flexShrink: 0,
        borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 8px 4px',
          fontSize: 11, fontWeight: 700,
          color: '#94a3b8', letterSpacing: '0.05em',
          borderBottom: '1px solid #334155',
        }}>
          フロア
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <FloorSelector
            floors={floors}
            activeFloorId={activeFloorId}
            onFloorChange={setActiveFloorId}
          />
        </div>
        <div style={{ borderTop: '1px solid #334155' }}>
          <LayerControl
            visibility={visibility}
            onChange={setVisibility}
          />
        </div>
      </div>

      {/* ── Center: mode toggle + map ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          height: 48, flexShrink: 0,
          background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12,
        }}>
          <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: 13 }}>CampusViewer</span>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          {/* Profile selector */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {PROFILES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setProfileIndex(i)}
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #475569',
                  background: i === profileIndex ? '#3b82f6' : 'transparent',
                  color: i === profileIndex ? '#fff' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {PROFILE_LABELS[p.id] ?? p.id}
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {mapArea}
        </div>
      </div>

      {/* ── Right: search + routing ───────────────────────────────────────── */}
      <div style={{
        width: 240, flexShrink: 0,
        borderLeft: '1px solid #334155',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: 8, borderBottom: '1px solid #334155' }}>
          <SearchPanel graph={graph} onSelect={handleSearchSelect} />
        </div>

        {/* Route status */}
        <div style={{
          padding: '6px 8px',
          background: '#1e293b',
          borderBottom: '1px solid #334155',
          fontSize: 11, flexShrink: 0,
        }}>
          <div style={{ color: '#10b981', marginBottom: 2 }}>
            出発: {startNodeId ? startNodeId.slice(0, 12) + '…' : '—（ノードを選択）'}
          </div>
          <div style={{ color: '#f97316', marginBottom: 4 }}>
            目的: {goalNodeId ? goalNodeId.slice(0, 12) + '…' : '—（ノードを選択）'}
          </div>
          {(startNodeId || goalNodeId) && (
            <button
              onClick={clearRoute}
              style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                border: '1px solid #475569',
                background: 'transparent', color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              クリア
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
