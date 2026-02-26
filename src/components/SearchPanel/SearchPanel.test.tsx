import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SearchPanel, searchNodes } from './SearchPanel'
import { createEmptyCampusGraph, createNodeId, createSpaceId } from '../../core/schema'
import type { CampusGraph } from '../../core/schema'

const makeSearchableGraph = (): CampusGraph => {
  const g = createEmptyCampusGraph()
  const n1 = createNodeId()
  const n2 = createNodeId()
  const s1 = createSpaceId()
  g.nodes[n1] = { id: n1, label: '会議室 A', type: 'room' }
  g.nodes[n2] = { id: n2, label: '職員室', type: 'office' }
  g.spaces[s1] = { id: s1, name: '第一実験室', type: 'lab', tags: ['実験'] }
  return g
}

describe('searchNodes', () => {
  it('finds nodes by label partial match', () => {
    const g = makeSearchableGraph()
    const results = searchNodes(g, '会議室')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].label).toContain('会議室')
  })

  it('finds spaces by name', () => {
    const g = makeSearchableGraph()
    const results = searchNodes(g, '実験室')
    expect(results.some(r => r.label?.includes('実験室'))).toBe(true)
  })

  it('returns empty array for no match', () => {
    const g = makeSearchableGraph()
    expect(searchNodes(g, 'zzz_nonexistent')).toHaveLength(0)
  })

  it('is case-insensitive for ASCII', () => {
    const g = createEmptyCampusGraph()
    const nid = createNodeId()
    g.nodes[nid] = { id: nid, label: 'Office Room' }
    expect(searchNodes(g, 'office').length).toBeGreaterThan(0)
  })
})

describe('SearchPanel', () => {
  it('renders a search input', () => {
    const { container } = render(
      <SearchPanel graph={makeSearchableGraph()} onSelect={vi.fn()} />,
    )
    expect(container.querySelector('input')).toBeTruthy()
  })

  it('shows results when query matches', () => {
    const { container, getByRole } = render(
      <SearchPanel graph={makeSearchableGraph()} onSelect={vi.fn()} />,
    )
    const input = getByRole('textbox')
    fireEvent.change(input, { target: { value: '会議室' } })
    const results = container.querySelectorAll('[data-search-result]')
    expect(results.length).toBeGreaterThan(0)
  })

  it('calls onSelect with the entity id when a result is clicked', () => {
    const g = makeSearchableGraph()
    const onSelect = vi.fn()
    const { container, getByRole } = render(<SearchPanel graph={g} onSelect={onSelect} />)
    fireEvent.change(getByRole('textbox'), { target: { value: '職員室' } })
    const result = container.querySelector('[data-search-result]')!
    fireEvent.click(result)
    expect(onSelect).toHaveBeenCalledTimes(1)
    const [id] = onSelect.mock.calls[0]
    expect(typeof id).toBe('string')
  })
})
