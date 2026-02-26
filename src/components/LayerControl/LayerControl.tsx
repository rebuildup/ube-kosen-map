/**
 * LayerControl — Checkbox UI for toggling map layer visibility.
 *
 * [P-4] Semantic Zoom: layer visibility adapts to zoom level.
 * [P-2] Constraint-Driven: validation layer cannot be hidden in editor mode.
 */

import React from 'react'
import type { LayerVisibility } from '../../core/zoom'

export interface LayerControlProps {
  visibility: LayerVisibility
  onChange: (updated: LayerVisibility) => void
  /** If true, the validation layer cannot be disabled (P-2 enforcement) */
  isEditorMode?: boolean
}

const LAYER_LABELS: Record<keyof LayerVisibility, string> = {
  buildingOutlines: '建物外形',
  spaces:           'スペース',
  nodes:            'ノード',
  edges:            'エッジ',
  labels:           'ラベル',
  metadata:         'メタデータ',
  validation:       'バリデーション',
}

export const LayerControl: React.FC<LayerControlProps> = ({
  visibility,
  onChange,
  isEditorMode = false,
}) => {
  const toggle = (key: keyof LayerVisibility) => {
    onChange({ ...visibility, [key]: !visibility[key] })
  }

  const keys = Object.keys(visibility) as (keyof LayerVisibility)[]

  return (
    <div
      aria-label="layer control"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 8,
        background: 'rgba(255,255,255,0.9)',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 2 }}>
        レイヤー
      </div>
      {keys.map(key => {
        const isDisabled = isEditorMode && key === 'validation'
        return (
          <label
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              data-layer={key}
              checked={visibility[key]}
              disabled={isDisabled}
              onChange={() => toggle(key)}
              style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
            />
            {LAYER_LABELS[key]}
          </label>
        )
      })}
    </div>
  )
}
