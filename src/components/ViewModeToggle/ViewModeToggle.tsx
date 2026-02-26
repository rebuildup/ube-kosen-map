/**
 * ViewModeToggle — switches between map view modes.
 * [P-4] Semantic Zoom: aerial/floor modes adapt display density.
 * [P-6] Mathematical Abstraction: pseudo-3d mode uses CSS 3D transforms.
 */

import React from 'react'

export type ViewMode = 'aerial' | 'floor' | 'cross-section' | 'pseudo-3d' | 'building'

export const VIEW_MODES: ViewMode[] = ['aerial', 'floor', 'cross-section', 'pseudo-3d', 'building']

const MODE_LABELS: Record<ViewMode, string> = {
  'aerial':       '上空',
  'floor':        'フロア',
  'cross-section':'断面',
  'pseudo-3d':    '立体',
  'building':     '建物',
}

export interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ mode, onChange }) => (
  <div
    aria-label="view mode toggle"
    style={{ display: 'flex', gap: 4, padding: 6, background: 'rgba(255,255,255,0.9)', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
  >
    {VIEW_MODES.map(m => (
      <button
        key={m}
        data-mode={m}
        aria-pressed={m === mode}
        onClick={() => { if (m !== mode) onChange(m) }}
        style={{
          padding: '4px 8px',
          fontSize: 12,
          borderRadius: 4,
          border: '1px solid',
          cursor: m === mode ? 'default' : 'pointer',
          fontWeight: m === mode ? 700 : 400,
          background: m === mode ? '#2563eb' : 'transparent',
          color: m === mode ? '#fff' : '#374151',
          borderColor: m === mode ? '#2563eb' : '#d1d5db',
        }}
      >
        {MODE_LABELS[m]}
      </button>
    ))}
  </div>
)
