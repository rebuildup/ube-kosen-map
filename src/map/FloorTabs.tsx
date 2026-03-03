// src/map/FloorTabs.tsx
import type React from 'react'
import type { CSSProperties } from 'react'
import type { MapLayer } from './types'

export interface FloorTabsProps {
  layers: MapLayer[]
  visibleLayers: string[]
  onVisibleLayersChange: (ids: string[]) => void
}

const containerStyle: CSSProperties = {
  position: 'absolute',
  left: 16,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 10,
}

const panelStyle: CSSProperties = {
  background: 'var(--map-ctrl-bg)',
  border: '1px solid var(--map-ctrl-border)',
  borderRadius: 8,
  padding: 8,
  maxHeight: '60vh',
  overflowY: 'auto',
}

const headerStyle: CSSProperties = {
  fontVariant: 'small-caps',
  color: 'var(--map-ctrl-text)',
  marginBottom: 8,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
}

const quickRowStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  marginTop: 8,
}

const quickBtnStyle: CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  fontSize: 11,
  background: 'var(--map-ctrl-hover)',
  color: 'var(--map-ctrl-text)',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
}

function layerBtnStyle(active: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 10px',
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--map-accent, #3b82f6)' : 'transparent',
    color: active ? 'white' : 'var(--map-ctrl-text)',
  }
}

const FloorTabs: React.FC<FloorTabsProps> = ({ layers, visibleLayers, onVisibleLayersChange }) => {
  const toggle = (id: string) => {
    if (visibleLayers.includes(id)) {
      onVisibleLayersChange(visibleLayers.filter((v) => v !== id))
    } else {
      onVisibleLayersChange([...visibleLayers, id])
    }
  }

  const showAll = () => onVisibleLayersChange(layers.map((l) => l.id))
  const hideAll = () => onVisibleLayersChange([])

  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>フロア / レイヤー</div>
        {layers.map((layer) => {
          const active = visibleLayers.includes(layer.id)
          return (
            <button
              key={layer.id}
              type="button"
              style={layerBtnStyle(active)}
              onClick={() => toggle(layer.id)}
            >
              {layer.label}
            </button>
          )
        })}
        <div style={quickRowStyle}>
          <button type="button" style={quickBtnStyle} onClick={showAll}>
            全表示
          </button>
          <button type="button" style={quickBtnStyle} onClick={hideAll}>
            全非表示
          </button>
        </div>
      </div>
    </div>
  )
}

export default FloorTabs
