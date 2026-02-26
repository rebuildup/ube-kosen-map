/**
 * useEditorState — central state machine for the TraceEditor.
 *
 * Manages: active tool, graph state, drawing vertices, selected element,
 * active floor/building, and undo/redo history.
 *
 * [P-2] Constraint-Driven: tool switching cancels in-progress drawing.
 * [P-1] Topology First: all graph mutations go through applyGraphUpdate,
 *        which can be wired to the validated CRUD functions.
 */

import { useState, useCallback } from 'react'
import type { CampusGraph } from '../core/schema/types'
import type { Vec2 } from '../math'
import { createEmptyCampusGraph } from '../core/schema/graph'
import { loadCampusGraph } from '../core/graph/persistence'

export type EditorTool = 'select' | 'space' | 'node' | 'door'
export type SelectedKind = 'node' | 'edge' | 'space' | null

const MAX_UNDO = 50

export const useEditorState = () => {
  const [graph, setGraph] = useState<CampusGraph>(createEmptyCampusGraph)
  const [activeTool, setActiveToolState] = useState<EditorTool>('select')
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null)
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedKind, setSelectedKind] = useState<SelectedKind>(null)
  const [drawingVertices, setDrawingVertices] = useState<Vec2[]>([])
  const [undoStack, setUndoStack] = useState<CampusGraph[]>([])
  const [redoStack, setRedoStack] = useState<CampusGraph[]>([])

  const setTool = useCallback((tool: EditorTool) => {
    setActiveToolState(tool)
    setDrawingVertices([])
  }, [])

  const addDrawingVertex = useCallback((v: Vec2) => {
    setDrawingVertices(prev => [...prev, v])
  }, [])

  const cancelDrawing = useCallback(() => {
    setDrawingVertices([])
  }, [])

  const applyGraphUpdate = useCallback((newGraph: CampusGraph) => {
    setGraph(prev => {
      setUndoStack(stack => [...stack.slice(-MAX_UNDO), prev])
      setRedoStack([])
      return newGraph
    })
  }, [])

  const undo = useCallback(() => {
    setUndoStack(stack => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      setGraph(cur => {
        setRedoStack(r => [...r, cur])
        return prev
      })
      return stack.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setRedoStack(stack => {
      if (stack.length === 0) return stack
      const next = stack[stack.length - 1]
      setGraph(cur => {
        setUndoStack(u => [...u, cur])
        return next
      })
      return stack.slice(0, -1)
    })
  }, [])

  const selectElement = useCallback((id: string | null, kind: SelectedKind) => {
    setSelectedId(id)
    setSelectedKind(kind)
  }, [])

  const loadGraph = useCallback((json: string) => {
    applyGraphUpdate(loadCampusGraph(json))
  }, [applyGraphUpdate])

  return {
    graph,
    activeTool,
    activeFloorId,
    activeBuildingId,
    selectedId,
    selectedKind,
    drawingVertices,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    setTool,
    setActiveFloor: setActiveFloorId,
    setActiveBuilding: setActiveBuildingId,
    addDrawingVertex,
    cancelDrawing,
    applyGraphUpdate,
    selectElement,
    undo,
    redo,
    loadGraph,
  }
}
