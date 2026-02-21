import { describe, it, expect } from 'vitest'
import { searchNodes } from './index'
import type { Node } from '../types'

describe('searchNodes', () => {
  const nodes: Node[] = [
    { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, name: 'Lecture Hall A', tags: ['lecture', 'projector'], data: { capacity: 100 } },
    { id: 'n2', type: 'room', position: { x: 100, y: 0 }, floor: 1, name: 'Lab 101', tags: ['lab', 'pc'], data: { capacity: 30 } },
    { id: 'n3', type: 'room', position: { x: 0, y: 100 }, floor: 2, name: 'Office 201', tags: ['office'], data: {} },
    { id: 'n4', type: 'corridor', position: { x: 50, y: 50 }, floor: 1, name: 'Main Hall', tags: ['covered'], data: {} },
  ]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  it('should filter by type', () => {
    const results = searchNodes(nodeMap, { type: 'room' })
    expect(results.length).toBe(3)
    expect(results.every(n => n.type === 'room')).toBe(true)
  })

  it('should filter by tags (AND)', () => {
    const results = searchNodes(nodeMap, { tags: ['lab'] })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('n2')
  })

  it('should filter by name (case insensitive)', () => {
    const results = searchNodes(nodeMap, { nameContains: 'lecture' })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('n1')
  })

  it('should filter by floor', () => {
    const results = searchNodes(nodeMap, { floor: 1 })
    expect(results.length).toBe(3)
  })

  it('should exclude tags', () => {
    const results = searchNodes(nodeMap, { type: 'room', excludeTags: ['lab'] })
    expect(results.length).toBe(2)
    expect(results.every(n => !n.tags.includes('lab'))).toBe(true)
  })

  it('should combine filters', () => {
    const results = searchNodes(nodeMap, { type: 'room', tags: ['projector'], floor: 1 })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('n1')
  })
})
