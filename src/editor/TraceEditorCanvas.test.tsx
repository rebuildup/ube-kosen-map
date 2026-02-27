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

  it('renders reference image behind graph when dataUrl exists', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={createEmptyCampusGraph()} matrix={identity}
        activeTool="select" drawingVertices={[]}
        onVertexAdd={vi.fn()} onCancel={vi.fn()} onSelect={vi.fn()}
        onNodePlace={vi.fn()} onDoorPlace={vi.fn()}
        setMatrix={vi.fn()}
        referenceImages={[{
          dataUrl: 'data:image/png;base64,abc',
          opacity: 0.6,
          x: 10,
          y: 20,
          scale: 1.5,
          rotation: 15,
          naturalWidth: 1000,
          naturalHeight: 800,
          cropX: 100,
          cropY: 50,
          cropWidth: 600,
          cropHeight: 300,
          pageCount: 1,
          currentPage: 1,
        }]}
      />,
    )
    expect(container.querySelector('[data-reference-image]')).not.toBeNull()
  })

  it('renders multiple reference images', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={createEmptyCampusGraph()} matrix={identity}
        activeTool="select" drawingVertices={[]}
        onVertexAdd={vi.fn()} onCancel={vi.fn()} onSelect={vi.fn()}
        onNodePlace={vi.fn()} onDoorPlace={vi.fn()}
        setMatrix={vi.fn()}
        referenceImages={[
          {
            dataUrl: 'data:image/png;base64,abc',
            opacity: 0.6, x: 10, y: 20, scale: 1, rotation: 0,
            naturalWidth: 100, naturalHeight: 100,
            cropX: 0, cropY: 0, cropWidth: 100, cropHeight: 100,
            pageCount: 1, currentPage: 1,
          },
          {
            dataUrl: 'data:image/png;base64,def',
            opacity: 0.4, x: 40, y: 50, scale: 1, rotation: 0,
            naturalWidth: 80, naturalHeight: 60,
            cropX: 0, cropY: 0, cropWidth: 80, cropHeight: 60,
            pageCount: 1, currentPage: 1,
          },
        ]}
      />,
    )
    expect(container.querySelectorAll('[data-reference-image]').length).toBe(2)
  })
})
