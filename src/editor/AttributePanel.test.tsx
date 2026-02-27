import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AttributePanel } from './AttributePanel'
import { createEmptyCampusGraph } from '../core/schema/graph'
import { createNodeId, createSpaceId } from '../core/schema/ids'
import type { CampusGraph } from '../core/schema/types'

function makeGraph(): CampusGraph {
  const g = createEmptyCampusGraph()
  const nid = createNodeId()
  const sid = createSpaceId()
  return {
    ...g,
    nodes: { [nid]: { id: nid, type: 'room', label: 'Test Room', position: { x: 0, y: 0 } } },
    spaces: { [sid]: { id: sid, name: '実験室', type: 'lab' } },
  }
}

describe('AttributePanel', () => {
  it('shows "選択なし" when selectedId is null', () => {
    const { container } = render(
      <AttributePanel graph={makeGraph()} selectedId={null} selectedKind={null} onUpdate={vi.fn()} />,
    )
    expect(container.textContent).toContain('選択なし')
  })

  it('renders node attributes when a node is selected', () => {
    const graph = makeGraph()
    const nodeId = Object.keys(graph.nodes)[0]!  // noUncheckedIndexedAccess: we know graph has a node
    const { container } = render(
      <AttributePanel graph={graph} selectedId={nodeId} selectedKind="node" onUpdate={vi.fn()} />,
    )
    expect(container.querySelector('[data-field="type"]')).not.toBeNull()
    expect(container.querySelector('[data-field="label"]')).not.toBeNull()
  })

  it('renders space attributes when a space is selected', () => {
    const graph = makeGraph()
    const spaceId = Object.keys(graph.spaces)[0]!  // noUncheckedIndexedAccess: we know graph has a space
    const { container } = render(
      <AttributePanel graph={graph} selectedId={spaceId} selectedKind="space" onUpdate={vi.fn()} />,
    )
    expect(container.querySelector('[data-field="name"]')).not.toBeNull()
    expect(container.querySelector('[data-field="type"]')).not.toBeNull()
  })

  it('calls onUpdate with patched node when label changes', () => {
    const graph = makeGraph()
    const nodeId = Object.keys(graph.nodes)[0]!  // noUncheckedIndexedAccess: we know graph has a node
    const onUpdate = vi.fn()
    const { container } = render(
      <AttributePanel graph={graph} selectedId={nodeId} selectedKind="node" onUpdate={onUpdate} />,
    )
    const input = container.querySelector('[data-field="label"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'New Label' } })
    expect(onUpdate).toHaveBeenCalled()
    const arg = onUpdate.mock.calls[0]![0] as CampusGraph  // calls[0]! guarded by toHaveBeenCalled
    expect(arg.nodes[nodeId]!.label).toBe('New Label')  // nodeId exists in graph
  })
})
