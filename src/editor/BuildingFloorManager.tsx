/**
 * BuildingFloorManager — building and floor creation/selection sidebar panel.
 *
 * Displays existing buildings + floors, and provides forms to add new ones.
 * [P-5] Data Normalization: building/floor IDs are generated via createBuildingId/createFloorId.
 * [P-1] Topology First: floor selection drives which nodes/spaces are editable.
 */

import React, { useState } from 'react'
import type { CampusGraph } from '../core/schema/types'
import { createBuildingId, createFloorId } from '../core/schema/ids'

export interface BuildingFloorManagerProps {
  graph: CampusGraph
  activeFloorId: string | null
  onGraphUpdate: (g: CampusGraph) => void
  onFloorSelect: (floorId: string) => void
}

const levelToName = (level: number): string =>
  level > 0 ? `${level}F` : level === 0 ? '1F' : `B${-level}`

export const BuildingFloorManager: React.FC<BuildingFloorManagerProps> = ({
  graph, activeFloorId, onGraphUpdate, onFloorSelect,
}) => {
  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [newBuildingName, setNewBuildingName] = useState('')
  const [showAddFloor, setShowAddFloor] = useState(false)
  const [newFloorLevel, setNewFloorLevel] = useState(1)
  const [newFloorBuildingId, setNewFloorBuildingId] = useState('')

  const buildings = Object.values(graph.buildings)
  const floors = Object.values(graph.floors).sort((a, b) => (b.level ?? 0) - (a.level ?? 0))

  const addBuilding = () => {
    if (!newBuildingName.trim()) return
    const id = createBuildingId()
    onGraphUpdate({
      ...graph,
      buildings: { ...graph.buildings, [id]: { id, name: newBuildingName.trim() } },
    })
    setNewBuildingName('')
    setShowAddBuilding(false)
  }

  const addFloor = () => {
    const bid = (newFloorBuildingId || buildings[0]?.id) as any
    if (!bid) return
    const id = createFloorId()
    const level = newFloorLevel
    const name = levelToName(level)
    onGraphUpdate({
      ...graph,
      floors: { ...graph.floors, [id]: { id, buildingId: bid, level, name } },
    })
    setShowAddFloor(false)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 3, fontFamily: 'var(--font-mono)',
  }
  const inputStyle: React.CSSProperties = {
    padding: '4px 7px', fontSize: 11, borderRadius: 3,
    border: '1px solid var(--border-2)', background: 'var(--bg-1)', color: 'var(--text-1)',
    width: '100%', boxSizing: 'border-box', outline: 'none',
  }
  const btnStyle: React.CSSProperties = {
    padding: '3px 9px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
    border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-2)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
  }

  return (
    <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-1)' }}>
      {/* Building + floor list */}
      {buildings.map(b => (
        <div key={b.id} style={{ marginBottom: 8, paddingLeft: 6, borderLeft: '2px solid var(--border-2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', paddingBottom: 3, letterSpacing: '0.04em' }}>
            {b.name ?? b.id}
          </div>
          {floors
            .filter(f => f.buildingId === b.id)
            .map(f => (
              <button
                key={f.id}
                onClick={() => onFloorSelect(f.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '3px 8px', fontSize: 10, border: '1px solid',
                  borderColor: f.id === activeFloorId ? 'var(--accent)' : 'transparent',
                  borderRadius: 2, cursor: 'pointer', marginTop: 2,
                  background: f.id === activeFloorId ? 'var(--accent-bg)' : 'transparent',
                  color: f.id === activeFloorId ? 'var(--accent)' : 'var(--text-2)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                }}
              >
                {f.name ?? levelToName(f.level ?? 0)}
              </button>
            ))}
        </div>
      ))}

      {/* Add building form */}
      {showAddBuilding ? (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={labelStyle}>建物名</div>
          <input
            data-field="building-name"
            style={inputStyle}
            value={newBuildingName}
            onChange={e => setNewBuildingName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBuilding()}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button data-action="confirm-add-building" onClick={addBuilding}
              style={{ ...btnStyle, borderColor: '#10b981', color: '#34d399' }}>追加</button>
            <button onClick={() => setShowAddBuilding(false)} style={btnStyle}>キャンセル</button>
          </div>
        </div>
      ) : (
        <button
          data-action="add-building"
          onClick={() => setShowAddBuilding(true)}
          style={{ ...btnStyle, marginTop: 8, width: '100%' }}
        >+ 建物を追加</button>
      )}

      {/* Add floor form — only visible when at least one building exists */}
      {buildings.length > 0 && (
        showAddFloor ? (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={labelStyle}>建物</div>
            <select style={inputStyle} value={newFloorBuildingId}
              onChange={e => setNewFloorBuildingId(e.target.value)}>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name ?? b.id}</option>
              ))}
            </select>
            <div style={labelStyle}>階数 (1=1F, -1=B1)</div>
            <input
              data-field="floor-level"
              type="number"
              style={inputStyle}
              value={newFloorLevel}
              onChange={e => setNewFloorLevel(Number(e.target.value))}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button data-action="confirm-add-floor" onClick={addFloor}
                style={{ ...btnStyle, borderColor: '#10b981', color: '#34d399' }}>追加</button>
              <button onClick={() => setShowAddFloor(false)} style={btnStyle}>キャンセル</button>
            </div>
          </div>
        ) : (
          <button
            data-action="add-floor"
            onClick={() => setShowAddFloor(true)}
            style={{ ...btnStyle, marginTop: 4, width: '100%' }}
          >+ フロアを追加</button>
        )
      )}
    </div>
  )
}
