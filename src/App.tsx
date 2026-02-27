import React, { useState } from 'react'
import { TraceEditor } from './editor'
import { CampusViewer } from './viewer'
import { createEmptyCampusGraph } from './core/schema/graph'

type AppMode = 'editor' | 'viewer'

const MODES: { key: AppMode; label: string; tag: string }[] = [
  { key: 'editor', label: 'エディター', tag: 'EDITOR' },
  { key: 'viewer', label: 'ビューアー', tag: 'VIEWER' },
]

function App() {
  const [mode, setMode] = useState<AppMode>('editor')

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
          {MODES.map(({ key, label, tag }) => (
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
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: mode === 'editor' ? 'var(--amber)' : 'var(--green)',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em',
          }}>
            {mode === 'editor' ? 'EDIT MODE' : 'VIEW MODE'}
          </span>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {mode === 'editor'
          ? <TraceEditor />
          : <CampusViewer graph={createEmptyCampusGraph()} />
        }
      </div>
    </div>
  )
}

export default App
