import React, { useState } from 'react'
import { TraceEditor } from './editor'
import { CampusViewer } from './viewer'
import { createEmptyCampusGraph } from './core/schema/graph'

type AppMode = 'editor' | 'viewer'

const TOGGLE_BASE: React.CSSProperties = {
  fontSize: 11, padding: '3px 10px', borderRadius: 4,
  border: '1px solid #475569', cursor: 'pointer',
}

function App() {
  const [mode, setMode] = useState<AppMode>('editor')

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* Mode toggle — always on top-right */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 100,
        display: 'flex', gap: 4,
      }}>
        <button
          onClick={() => setMode('editor')}
          style={{
            ...TOGGLE_BASE,
            background: mode === 'editor' ? '#3b82f6' : 'rgba(30,41,59,0.85)',
            color: mode === 'editor' ? '#fff' : '#94a3b8',
          }}
        >
          エディター
        </button>
        <button
          onClick={() => setMode('viewer')}
          style={{
            ...TOGGLE_BASE,
            background: mode === 'viewer' ? '#3b82f6' : 'rgba(30,41,59,0.85)',
            color: mode === 'viewer' ? '#fff' : '#94a3b8',
          }}
        >
          ビューアー
        </button>
      </div>

      {mode === 'editor'
        ? <TraceEditor />
        : <CampusViewer graph={createEmptyCampusGraph()} />
      }
    </div>
  )
}

export default App
