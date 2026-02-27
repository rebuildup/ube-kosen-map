import { describe, expect, it } from 'vitest'
import { buildGraphFromSvg } from './buildGraphFromSvg'

describe('buildGraphFromSvg', () => {
  it('builds a non-empty graph from a simple corridor polyline', () => {
    const svg = '<svg><path d="M 0 0 L 10 0 L 10 10" style="fill:none;stroke-width:0.27;stroke:#000;"/></svg>'
    const graph = buildGraphFromSvg(svg, { buildingName: 'B1', floorLevel: 1 })
    expect(Object.keys(graph.nodes)).toHaveLength(3)
    expect(Object.keys(graph.edges)).toHaveLength(2)
    expect(Object.keys(graph.buildings)).toHaveLength(1)
    expect(Object.keys(graph.floors)).toHaveLength(1)
  })
})
