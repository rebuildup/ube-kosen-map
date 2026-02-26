/**
 * ToolBar — vertical tool palette for the TraceEditor.
 * Tool selection + undo/redo + load/save actions.
 * [P-2] Constraint-Driven: active tool is always visible.
 */

import React from 'react'
import type { EditorTool } from './useEditorState'

const TOOLS: { tool: EditorTool; label: string; shortcut: string }[] = [
  { tool: 'select', label: '選択', shortcut: 'V' },
  { tool: 'space',  label: 'スペース', shortcut: 'S' },
  { tool: 'node',   label: 'ノード', shortcut: 'N' },
  { tool: 'door',   label: 'ドア', shortcut: 'D' },
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
      display: 'flex', flexDirection: 'column', gap: 4, padding: 8,
      background: '#1e293b', borderRight: '1px solid #334155',
      width: 72, minHeight: '100%', alignItems: 'center', flexShrink: 0,
    }}
  >
    {/* Tool buttons */}
    {TOOLS.map(({ tool, label, shortcut }) => (
      <button
        key={tool}
        data-tool={tool}
        aria-pressed={activeTool === tool}
        title={`${label} (${shortcut})`}
        onClick={() => onToolChange(tool)}
        style={{
          width: 56, height: 48, borderRadius: 6, border: '1.5px solid',
          cursor: 'pointer', fontSize: 11, fontWeight: 600,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 2,
          background: activeTool === tool ? '#3b82f6' : 'transparent',
          color: activeTool === tool ? '#fff' : '#94a3b8',
          borderColor: activeTool === tool ? '#3b82f6' : '#475569',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>{shortcut}</span>
      </button>
    ))}

    <div style={{ width: '100%', height: 1, background: '#334155', margin: '4px 0' }} />

    {/* Undo */}
    <button
      data-action="undo"
      disabled={!canUndo}
      onClick={onUndo}
      title="元に戻す (Ctrl+Z)"
      style={{
        width: 56, height: 32, borderRadius: 4, border: '1px solid #475569',
        background: 'transparent', color: canUndo ? '#94a3b8' : '#475569',
        cursor: canUndo ? 'pointer' : 'not-allowed', fontSize: 11,
      }}
    >↩ Undo</button>

    {/* Redo */}
    <button
      data-action="redo"
      disabled={!canRedo}
      onClick={onRedo}
      title="やり直し (Ctrl+Y)"
      style={{
        width: 56, height: 32, borderRadius: 4, border: '1px solid #475569',
        background: 'transparent', color: canRedo ? '#94a3b8' : '#475569',
        cursor: canRedo ? 'pointer' : 'not-allowed', fontSize: 11,
      }}
    >↪ Redo</button>

    <div style={{ flex: 1 }} />

    {/* Load */}
    {onLoad && (
      <button
        data-action="load"
        onClick={onLoad}
        title="JSONファイルを読み込む"
        style={{
          width: 56, height: 32, borderRadius: 4, border: '1px solid #475569',
          background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 10,
        }}
      >読込</button>
    )}

    {/* Save */}
    {onSave && (
      <button
        data-action="save"
        onClick={onSave}
        title="JSONとして保存"
        style={{
          width: 56, height: 32, borderRadius: 4, border: '1px solid #10b981',
          background: '#064e3b', color: '#34d399', cursor: 'pointer', fontSize: 10,
        }}
      >保存</button>
    )}
  </div>
)
