import React from 'react'
import type { ReferenceImageState } from './useReferenceImage'

export interface ReferenceListItem {
  id: string
  name: string
  ref: ReferenceImageState
}

export interface ActiveReferenceActions {
  setOpacity: (v: number) => void
  setX: (v: number) => void
  setY: (v: number) => void
  setScale: (v: number) => void
  setRotation: (v: number) => void
  setCrop: (cropX: number, cropY: number, cropWidth: number, cropHeight: number) => void
  setCurrentPage: (page: number) => void
}

export interface ReferencePanelProps {
  references: ReferenceListItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onRemoveActive: () => void
  actions: ActiveReferenceActions
}

const blockStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border-2)',
  background: 'var(--bg-1)',
  color: 'var(--text-1)',
  borderRadius: 3,
  padding: '4px 6px',
  fontSize: 11,
}
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
}

const parseNumber = (raw: string, fallback: number): number => {
  const next = Number(raw)
  return Number.isFinite(next) ? next : fallback
}

export const ReferencePanel: React.FC<ReferencePanelProps> = ({
  references,
  activeId,
  onSelect,
  onAdd,
  onRemoveActive,
  actions,
}) => {
  const active = references.find((item) => item.id === activeId) ?? null
  const ref = active?.ref ?? null

  return (
    <div style={{ padding: '6px 10px 10px' }}>
      <button
        type="button"
        data-ref-import="true"
        onClick={onAdd}
        style={{
          width: '100%',
          borderRadius: 3,
          border: '1px solid var(--border-2)',
          background: 'transparent',
          color: 'var(--text-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.06em',
          padding: '5px 8px',
          cursor: 'pointer',
        }}
      >
        ADD REFERENCE
      </button>

      {references.length > 0 && (
        <div style={blockStyle}>
          <label style={labelStyle}>References</label>
          <select
            data-ref-select="true"
            value={activeId ?? ''}
            onChange={(e) => { if (e.target.value) onSelect(e.target.value) }}
            style={inputStyle}
          >
            {references.map((item, index) => (
              <option key={item.id} value={item.id}>
                {index + 1}. {item.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {ref && (
        <>
          <div style={blockStyle}>
            <label style={labelStyle}>Opacity</label>
            <input
              data-ref-opacity="true"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={ref.opacity}
              onChange={(e) => actions.setOpacity(parseNumber(e.target.value, ref.opacity))}
            />
          </div>

          <div style={{ ...blockStyle, flexDirection: 'row', gap: 6 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Scale</label>
              <input
                data-ref-scale="true"
                type="number"
                step={0.05}
                value={ref.scale}
                style={inputStyle}
                onChange={(e) => actions.setScale(parseNumber(e.target.value, ref.scale))}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Rotation</label>
              <input
                data-ref-rotation="true"
                type="number"
                step={1}
                value={ref.rotation}
                style={inputStyle}
                onChange={(e) => actions.setRotation(parseNumber(e.target.value, ref.rotation))}
              />
            </div>
          </div>

          <div style={{ ...blockStyle, flexDirection: 'row', gap: 6 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>X</label>
              <input
                type="number"
                value={ref.x}
                style={inputStyle}
                onChange={(e) => actions.setX(parseNumber(e.target.value, ref.x))}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Y</label>
              <input
                type="number"
                value={ref.y}
                style={inputStyle}
                onChange={(e) => actions.setY(parseNumber(e.target.value, ref.y))}
              />
            </div>
          </div>

          <div style={{ ...blockStyle, flexDirection: 'row', gap: 6 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Crop X</label>
              <input
                type="number"
                value={ref.cropX}
                style={inputStyle}
                onChange={(e) => actions.setCrop(parseNumber(e.target.value, ref.cropX), ref.cropY, ref.cropWidth, ref.cropHeight)}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Crop Y</label>
              <input
                type="number"
                value={ref.cropY}
                style={inputStyle}
                onChange={(e) => actions.setCrop(ref.cropX, parseNumber(e.target.value, ref.cropY), ref.cropWidth, ref.cropHeight)}
              />
            </div>
          </div>

          <div style={{ ...blockStyle, flexDirection: 'row', gap: 6 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Crop W</label>
              <input
                data-ref-crop-width="true"
                type="number"
                min={1}
                value={ref.cropWidth}
                style={inputStyle}
                onChange={(e) => actions.setCrop(ref.cropX, ref.cropY, parseNumber(e.target.value, ref.cropWidth), ref.cropHeight)}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>Crop H</label>
              <input
                type="number"
                min={1}
                value={ref.cropHeight}
                style={inputStyle}
                onChange={(e) => actions.setCrop(ref.cropX, ref.cropY, ref.cropWidth, parseNumber(e.target.value, ref.cropHeight))}
              />
            </div>
          </div>

          {ref.pageCount > 1 && (
            <div style={blockStyle}>
              <label style={labelStyle}>PDF Page</label>
              <input
                type="number"
                min={1}
                max={ref.pageCount}
                value={ref.currentPage}
                style={inputStyle}
                onChange={(e) => actions.setCurrentPage(parseNumber(e.target.value, ref.currentPage))}
              />
            </div>
          )}

          <button
            type="button"
            data-ref-clear="true"
            onClick={onRemoveActive}
            style={{
              width: '100%',
              marginTop: 10,
              borderRadius: 3,
              border: '1px solid rgba(248,113,113,0.5)',
              background: 'rgba(248,113,113,0.08)',
              color: 'var(--red)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              padding: '5px 8px',
              cursor: 'pointer',
            }}
          >
            REMOVE ACTIVE
          </button>
        </>
      )}
    </div>
  )
}
