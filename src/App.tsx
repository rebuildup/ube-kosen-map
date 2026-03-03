import React, { useState, useMemo } from 'react'
import { TraceEditor } from './editor'
import { CampusViewer } from './viewer'
import type { CampusGraph } from './core/schema'
import page1GraphJson from '../data/derived/page_1.graph.json'
import { CampusMap, FloorTabs, parseLayers } from './map'
import type { ParsedMap } from './map'
import './map/theme.css'
import page1SvgRaw from '../docs/reference/page_1.svg?raw'

type AppMode = 'editor' | 'viewer' | 'map'

const MODES: { key: AppMode; label: string; tag: string }[] = [
  { key: 'editor', label: 'エディター', tag: 'EDITOR' },
  { key: 'viewer', label: 'ビューアー', tag: 'VIEWER' },
  { key: 'map', label: 'マップ v2', tag: 'MAP-V2' },
]

// ---- MapDemo ----

const MapDemo: React.FC = () => {
  const parsedMap = useMemo<ParsedMap>(() => {
    try {
      return parseLayers(page1SvgRaw)
    } catch (err) {
      // Fallback: wrap raw SVG content in a single layer
      console.error('parseLayers failed:', err)
      return {
        viewBox: { x: 0, y: 0, width: 595.276, height: 841.89 },
        styles: '',
        layers: [{ id: 'surface1', index: 0, label: 'Page 1', svgContent: '' }],
      }
    }
  }, [])

  const [visibleLayers, setVisibleLayers] = useState<string[]>(() =>
    parsedMap.layers.map((l) => l.id),
  )

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <CampusMap
        parsedMap={parsedMap}
        visibleLayers={visibleLayers}
        height="100%"
        showControls
        enableFullscreen
      />
      <FloorTabs
        layers={parsedMap.layers}
        visibleLayers={visibleLayers}
        onVisibleLayersChange={setVisibleLayers}
      />
    </div>
  )
}

// ---- App ----

function App() {
  const [mode, setMode] = useState<AppMode>('viewer')
  const page1Graph = page1GraphJson as unknown as CampusGraph

  const statusLabel =
    mode === 'editor' ? 'EDIT MODE' : mode === 'map' ? 'MAP-V2' : 'VIEW MODE'
  const statusColor =
    mode === 'editor' ? 'var(--amber)' : mode === 'map' ? 'var(--accent)' : 'var(--green)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-1)' }}>

      {/* ── Global app bar ─────────────────────────────────────────────────── */}
      <div style={{
        height: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 16,
        background: 'var(--bg-2)',
        borderBottom: '1px solid var(--border-1)',
      }}>
        {/* Logo */}
        <span className="app-brand">UBE-KOSEN MAP</span>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: 'var(--border-2)' }} />

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 2 }}>
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10, letterSpacing: '0.08em',
                padding: '3px 12px', borderRadius: 2,
                border: '1px solid',
                borderColor: mode === key ? 'var(--accent)' : 'var(--border-2)',
                background: mode === key ? 'var(--accent-bg)' : 'transparent',
                color: mode === key ? 'var(--accent)' : 'var(--text-2)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              title={label}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em',
          }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {mode === 'editor' && <TraceEditor />}
        {mode === 'viewer' && <CampusViewer graph={page1Graph} />}
        {mode === 'map' && <MapDemo />}
      </div>
    </div>
  )
}

export default App
