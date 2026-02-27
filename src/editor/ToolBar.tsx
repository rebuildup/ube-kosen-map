/**
 * ToolBar — vertical tool palette for the TraceEditor.
 * Tool selection + undo/redo + load/save actions.
 * [P-2] Constraint-Driven: active tool is always visible.
 */

import React from 'react'
import type { EditorTool } from './useEditorState'

const TOOLS: { tool: EditorTool; icon: string; label: string; shortcut: string }[] = [
  { tool: 'select', icon: '↖',  label: '選択',     shortcut: 'V' },
  { tool: 'space',  icon: '▢',  label: 'スペース', shortcut: 'S' },
  { tool: 'node',   icon: '◉',  label: 'ノード',   shortcut: 'N' },
  { tool: 'door',   icon: '⊡',  label: 'ドア',     shortcut: 'D' },
]

export interface ToolBarProps {
  activeTool: EditorTool
  onToolChange: (tool: EditorTool) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onSave?: () => void
  onLoad?: () => void
}

export const ToolBar: React.FC<ToolBarProps> = ({
  activeTool, onToolChange,
  canUndo = false, canRedo = false,
  onUndo, onRedo, onSave, onLoad,
}) => (
  <div
    style={{
      display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 6px',
      background: 'var(--bg-2)', borderRight: '1px solid var(--border-1)',
      width: 60, minHeight: '100%', alignItems: 'center', flexShrink: 0,
    }}
  >
    {/* Tool buttons */}
    {TOOLS.map(({ tool, icon, label, shortcut }) => {
      const active = activeTool === tool
      return (
        <button
          key={tool}
          data-tool={tool}
          aria-pressed={active}
          title={`${label} (${shortcut})`}
          onClick={() => onToolChange(tool)}
          style={{
            width: 44, height: 44, borderRadius: 4,
            border: '1px solid',
            borderColor: active ? 'var(--accent)' : 'var(--border-1)',
            background: active ? 'var(--accent-bg)' : 'transparent',
            color: active ? 'var(--accent)' : 'var(--text-2)',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
            transition: 'all 0.1s',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.04em', opacity: 0.7 }}>{shortcut}</span>
        </button>
      )
    })}

    <div style={{ width: 32, height: 1, background: 'var(--border-1)', margin: '6px 0' }} />

    {/* Undo */}
    <button
      data-action="undo"
      disabled={!canUndo}
      onClick={onUndo}
      title="元に戻す (Ctrl+Z)"
      style={{
        width: 44, height: 32, borderRadius: 3,
        border: '1px solid var(--border-1)',
        background: 'transparent',
        color: canUndo ? 'var(--text-2)' : 'var(--text-3)',
        cursor: canUndo ? 'pointer' : 'not-allowed',
        fontSize: 16,
      }}
    >↺</button>

    {/* Redo */}
    <button
      data-action="redo"
      disabled={!canRedo}
      onClick={onRedo}
      title="やり直し (Ctrl+Y)"
      style={{
        width: 44, height: 32, borderRadius: 3,
        border: '1px solid var(--border-1)',
        background: 'transparent',
        color: canRedo ? 'var(--text-2)' : 'var(--text-3)',
        cursor: canRedo ? 'pointer' : 'not-allowed',
        fontSize: 16,
      }}
    >↻</button>

    <div style={{ flex: 1 }} />

    {/* Load */}
    {onLoad && (
      <button
        data-action="load"
        onClick={onLoad}
        title="JSONファイルを読み込む"
        style={{
          width: 44, height: 28, borderRadius: 3,
          border: '1px solid var(--border-2)',
          background: 'transparent', color: 'var(--text-2)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
        }}
      >LOAD</button>
    )}

    {/* Save */}
    {onSave && (
      <button
        data-action="save"
        onClick={onSave}
        title="JSONとして保存"
        style={{
          width: 44, height: 28, borderRadius: 3,
          border: '1px solid var(--green)',
          background: 'rgba(16,185,129,0.08)', color: 'var(--green)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
        }}
      >SAVE</button>
    )}
  </div>
)
