import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TraceEditorCanvas } from './TraceEditorCanvas'
import { createEmptyCampusGraph } from '../core/schema/graph'
import { identity as identityFn } from '../math'
const identity = identityFn()

describe('TraceEditorCanvas', () => {
  it('renders a viewport div', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={createEmptyCampusGraph()} matrix={identity}
        activeTool="select" drawingVertices={[]}
        onVertexAdd={vi.fn()} onCancel={vi.fn()} onSelect={vi.fn()}
        onNodePlace={vi.fn()} onDoorPlace={vi.fn()}
        setMatrix={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-editor-canvas]')).not.toBeNull()
  })

  it('renders in-progress polygon lines when drawingVertices has >= 2 points', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={createEmptyCampusGraph()} matrix={identity}
        activeTool="space"
        drawingVertices={[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]}
        onVertexAdd={vi.fn()} onCancel={vi.fn()} onSelect={vi.fn()}
        onNodePlace={vi.fn()} onDoorPlace={vi.fn()}
        setMatrix={vi.fn()}
      />,
    )
    const lines = container.querySelectorAll('[data-drawing-line]')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('renders vertex circles for each drawing vertex', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={createEmptyCampusGraph()} matrix={identity}
        activeTool="space"
        drawingVertices={[{ x: 0, y: 0 }, { x: 100, y: 0 }]}
        onVertexAdd={vi.fn()} onCancel={vi.fn()} onSelect={vi.fn()}
        onNodePlace={vi.fn()} onDoorPlace={vi.fn()}
        setMatrix={vi.fn()}
      />,
    )
    const circles = container.querySelectorAll('[data-drawing-vertex]')
    expect(circles.length).toBe(2)
  })

  it('calls onCancel on right-click', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <TraceEditorCanvas
        graph={createEmptyCampusGraph()} matrix={identity}
        activeTool="space" drawingVertices={[]}
        onVertexAdd={vi.fn()} onCancel={onCancel} onSelect={vi.fn()}
        onNodePlace={vi.fn()} onDoorPlace={vi.fn()}
        setMatrix={vi.fn()}
      />,
    )
    fireEvent.contextMenu(container.querySelector('[data-editor-canvas]')!)
    expect(onCancel).toHaveBeenCalled()
  })
})
