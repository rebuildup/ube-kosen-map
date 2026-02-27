import { describe, expect, it } from 'vitest'
import { validate } from '../../core/graph/validate'
import type { CampusGraph } from '../../core/schema'
import { buildGraphFromSvg } from './buildGraphFromSvg'
import page1Graph from '../../../data/derived/page_1.graph.json'
import pageSvgRaw from '../../../docs/reference/page_1.svg?raw'

describe('page_1 derived graph', () => {
  it('is loadable and has no validation errors', () => {
    const report = validate(page1Graph as unknown as CampusGraph)
    expect(report.isValid).toBe(true)
    expect(report.summary.errors).toBe(0)
  })

  it('can generate non-empty graph from docs/reference/page_1.svg', () => {
    const graph = buildGraphFromSvg(pageSvgRaw, { buildingName: 'page-1', floorLevel: 1 })
    expect(Object.keys(graph.nodes).length).toBeGreaterThan(500)
    expect(Object.keys(graph.edges).length).toBeGreaterThan(500)
  })
})
