/**
 * AttributePanel — metadata editing forms for selected graph elements (F2-2).
 *
 * Shows node / edge / space attributes in a sidebar panel.
 * Calls onUpdate with the mutated graph on every field change.
 *
 * [P-5] Data Normalization: edits are applied via CRUD functions that preserve
 *        the normalized structure and run autocomplete.
 * [P-2] Constraint-Driven: invalid type selections are not exposed in the UI.
 */

import React from 'react'
import type { CampusGraph, NodeType, SpaceType } from '../core/schema/types'
import { updateNode, updateEdge } from '../core/graph/manager'

const NODE_TYPES: NodeType[] = [
  'room', 'corridor_junction', 'staircase', 'elevator', 'entrance', 'outdoor_point', 'other',
]
const SPACE_TYPES: SpaceType[] = [
  'classroom', 'lab', 'office', 'corridor', 'stairwell', 'restroom', 'storage', 'common', 'outdoor', 'other',
]

export interface AttributePanelProps {
  graph: CampusGraph
  selectedId: string | null
  selectedKind: 'node' | 'edge' | 'space' | null
  onUpdate: (newGraph: CampusGraph) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 7px', fontSize: 11,
  borderRadius: 3, border: '1px solid var(--border-2)',
  background: 'var(--bg-1)', color: 'var(--text-1)', boxSizing: 'border-box', outline: 'none',
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 9 }}>
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)',
      marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {label}
    </div>
    {children}
  </div>
)

export const AttributePanel: React.FC<AttributePanelProps> = ({
  graph, selectedId, selectedKind, onUpdate,
}) => {
  // Nothing selected
  if (!selectedId || !selectedKind) {
    return (
      <div style={{ padding: '16px 12px', color: 'var(--text-3)', fontSize: 11 }}>
        <p>選択なし</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, marginTop: 6, letterSpacing: '0.04em' }}>ノード / エッジ / スペースをクリック</p>
      </div>
    )
  }

  // Node panel
  if (selectedKind === 'node') {
    const node = graph.nodes[selectedId]
    if (!node) return null
    const patch = (p: Parameters<typeof updateNode>[2]) => {
      const r = updateNode(graph, node.id, p)
      if (r.ok) onUpdate(r.value)
    }
    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>NODE</div>
        <Field label="種別">
          <select data-field="type" value={node.type ?? 'other'} onChange={e => patch({ type: e.target.value as NodeType })} style={inputStyle}>
            {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="ラベル">
          <input data-field="label" type="text" value={node.label ?? ''} onChange={e => patch({ label: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="位置 X / Y">
          <div style={{ display: 'flex', gap: 4 }}>
            <input data-field="x" type="number" value={node.position?.x ?? 0}
              onChange={e => patch({ position: { ...node.position, x: Number(e.target.value), y: node.position?.y ?? 0 } })}
              style={{ ...inputStyle, width: '50%' }} />
            <input data-field="y" type="number" value={node.position?.y ?? 0}
              onChange={e => patch({ position: { x: node.position?.x ?? 0, y: Number(e.target.value) } })}
              style={{ ...inputStyle, width: '50%' }} />
          </div>
        </Field>
      </div>
    )
  }

  // Space panel
  if (selectedKind === 'space') {
    const space = graph.spaces[selectedId]
    if (!space) return null
    const patch = (p: Partial<typeof space>) => {
      onUpdate({ ...graph, spaces: { ...graph.spaces, [selectedId]: { ...space, ...p } } })
    }
    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--green)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>SPACE</div>
        <Field label="名称">
          <input data-field="name" type="text" value={space.name ?? ''} onChange={e => patch({ name: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="種別">
          <select data-field="type" value={space.type ?? 'other'} onChange={e => patch({ type: e.target.value as SpaceType })} style={inputStyle}>
            {SPACE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="管理者">
          <input data-field="manager" type="text" value={space.manager ?? ''} onChange={e => patch({ manager: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="収容人数">
          <input data-field="capacity" type="number" value={space.capacity ?? ''} onChange={e => patch({ capacity: Number(e.target.value) })} style={inputStyle} />
        </Field>
        <Field label="タグ (カンマ区切り)">
          <input data-field="tags" type="text" value={(space.tags ?? []).join(', ')}
            onChange={e => patch({ tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            style={inputStyle} />
        </Field>
        <Field label="備考">
          <textarea data-field="notes" value={space.notes ?? ''} onChange={e => patch({ notes: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 48 }} />
        </Field>
      </div>
    )
  }

  // Edge panel
  if (selectedKind === 'edge') {
    const edge = graph.edges[selectedId]
    if (!edge) return null
    const patch = (p: Parameters<typeof updateEdge>[2]) => {
      const r = updateEdge(graph, edge.id, p)
      if (r.ok) onUpdate(r.value)
    }
    return (
      <div style={{ padding: 12, fontSize: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--orange)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>EDGE</div>
        <Field label="距離 (m)">
          <input data-field="distance" type="number" step="0.1" value={edge.distance ?? ''}
            onChange={e => patch({ distance: Number(e.target.value) })} style={inputStyle} />
        </Field>
        <Field label="通路幅 (m)">
          <input data-field="width" type="number" step="0.1" value={edge.width ?? 1.5}
            onChange={e => patch({ width: Number(e.target.value) })} style={inputStyle} />
        </Field>
        <Field label="段差あり">
          <input data-field="hasSteps" type="checkbox" checked={edge.hasSteps ?? false}
            onChange={e => patch({ hasSteps: e.target.checked })} />
        </Field>
        <Field label="屋外">
          <input data-field="isOutdoor" type="checkbox" checked={edge.isOutdoor ?? false}
            onChange={e => patch({ isOutdoor: e.target.checked })} />
        </Field>
        <Field label="方向">
          <select data-field="direction" value={edge.direction ?? 'bidirectional'}
            onChange={e => patch({ direction: e.target.value as 'bidirectional' | 'forward' | 'backward' })}
            style={inputStyle}>
            <option value="bidirectional">双方向</option>
            <option value="forward">順方向のみ</option>
            <option value="backward">逆方向のみ</option>
          </select>
        </Field>
      </div>
    )
  }

  return null
}
