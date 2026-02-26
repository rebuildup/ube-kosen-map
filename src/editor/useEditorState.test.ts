import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorState } from './useEditorState'
import { createEmptyCampusGraph } from '../core/schema/graph'

describe('useEditorState', () => {
  it('starts with select tool and empty graph', () => {
    const { result } = renderHook(() => useEditorState())
    expect(result.current.activeTool).toBe('select')
    expect(result.current.drawingVertices).toEqual([])
    expect(result.current.selectedId).toBeNull()
  })

  it('setTool switches tool and cancels drawing', () => {
    const { result } = renderHook(() => useEditorState())
    act(() => { result.current.addDrawingVertex({ x: 10, y: 10 }) })
    act(() => { result.current.setTool('node') })
    expect(result.current.activeTool).toBe('node')
    expect(result.current.drawingVertices).toEqual([])
  })

  it('addDrawingVertex accumulates vertices', () => {
    const { result } = renderHook(() => useEditorState())
    act(() => { result.current.setTool('space') })
    act(() => { result.current.addDrawingVertex({ x: 0, y: 0 }) })
    act(() => { result.current.addDrawingVertex({ x: 100, y: 0 }) })
    expect(result.current.drawingVertices).toHaveLength(2)
  })

  it('cancelDrawing clears vertices', () => {
    const { result } = renderHook(() => useEditorState())
    act(() => { result.current.addDrawingVertex({ x: 0, y: 0 }) })
    act(() => { result.current.cancelDrawing() })
    expect(result.current.drawingVertices).toEqual([])
  })

  it('applyGraphUpdate saves previous state for undo', () => {
    const { result } = renderHook(() => useEditorState())
    const g0 = result.current.graph
    act(() => { result.current.applyGraphUpdate(createEmptyCampusGraph()) })
    act(() => { result.current.undo() })
    expect(result.current.graph).toEqual(g0)
  })

  it('redo re-applies undone update', () => {
    const { result } = renderHook(() => useEditorState())
    const g1 = createEmptyCampusGraph()
    act(() => { result.current.applyGraphUpdate(g1) })
    act(() => { result.current.undo() })
    act(() => { result.current.redo() })
    expect(result.current.graph).toEqual(g1)
  })

  it('selectElement sets selectedId and selectedKind', () => {
    const { result } = renderHook(() => useEditorState())
    act(() => { result.current.selectElement('node-1', 'node') })
    expect(result.current.selectedId).toBe('node-1')
    expect(result.current.selectedKind).toBe('node')
  })
})
