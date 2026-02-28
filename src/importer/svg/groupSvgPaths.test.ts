import { describe, expect, it } from 'vitest'
import { groupSvgPaths } from './groupSvgPaths'

const RAW = [
  '<svg viewBox="0 0 100 100">',
  '<path style="fill:none;stroke:#111;stroke-width:0.5;" d="M0 0 L10 10"/>',
  '<path style="fill:none;stroke:#111;stroke-width:0.5;" d="M10 10 L20 0"/>',
  '<path style="fill:none;stroke:#888;stroke-width:2;" d="M0 50 L100 50"/>',
  '<defs><symbol id="x"><path style="fill:none;stroke:#111;stroke-width:0.5;" d="M0 0"/></symbol></defs>',
  '</svg>',
].join('')

describe('groupSvgPaths', () => {
  it('groups paths by stroke style', () => {
    const { groups } = groupSvgPaths(RAW)
    expect(groups.length).toBe(2)
    expect(groups[0]!.count).toBe(2) // two #111 paths
    expect(groups[1]!.count).toBe(1) // one #888 path
  })

  it('excludes paths inside defs/symbol', () => {
    const { groups } = groupSvgPaths(RAW)
    const total = groups.reduce((s, g) => s + g.count, 0)
    expect(total).toBe(3) // not 4
  })

  it('returns viewBox', () => {
    const { viewBox } = groupSvgPaths(RAW)
    expect(viewBox).toBe('0 0 100 100')
  })

  it('adds data-sg attribute to svgInnerHTML', () => {
    const { svgInnerHTML } = groupSvgPaths(RAW)
    expect(svgInnerHTML).toContain('data-sg="0"')
    expect(svgInnerHTML).toContain('data-sg="1"')
  })

  it('assigns same group index to same-style paths', () => {
    const { svgInnerHTML, groups } = groupSvgPaths(RAW)
    const matches = svgInnerHTML.match(/data-sg="0"/g) ?? []
    expect(matches.length).toBe(groups[0]!.count)
  })

  it('each group has paths array with correct count', () => {
    const { groups } = groupSvgPaths(RAW)
    expect(groups[0]!.paths.length).toBe(groups[0]!.count)
    expect(groups[1]!.paths.length).toBe(groups[1]!.count)
  })

  it('adds data-sp attribute to each element', () => {
    const { svgInnerHTML } = groupSvgPaths(RAW)
    // 3 paths → data-sp="0", "1", "2"
    expect(svgInnerHTML).toContain('data-sp="0"')
    expect(svgInnerHTML).toContain('data-sp="1"')
    expect(svgInnerHTML).toContain('data-sp="2"')
  })

  // Shape grouping tests
  it('connected paths (sharing endpoint) are placed in the same ShapeGroup', () => {
    const { groups } = groupSvgPaths(RAW)
    // group 0 has path0 (M0 0 L10 10) and path1 (M10 10 L20 0), sharing (10,10)
    const g0 = groups[0]!
    expect(g0.shapes.length).toBe(1)
    expect(g0.shapes[0]!.paths.length).toBe(2)
  })

  it('disconnected path gets its own ShapeGroup', () => {
    const { groups } = groupSvgPaths(RAW)
    // group 1 has only path2 (M0 50 L100 50), no shared endpoints
    const g1 = groups[1]!
    expect(g1.shapes.length).toBe(1)
    expect(g1.shapes[0]!.paths.length).toBe(1)
  })

  it('data-ss attribute is assigned as "{groupIndex}-{shapeIndex}"', () => {
    const { svgInnerHTML } = groupSvgPaths(RAW)
    // Both paths in group 0 belong to shape 0 → data-ss="0-0"
    expect(svgInnerHTML).toContain('data-ss="0-0"')
    // Path in group 1 → data-ss="1-0"
    expect(svgInnerHTML).toContain('data-ss="1-0"')
  })

  it('ShapeGroup.paths contains correct pathIndex values', () => {
    const { groups } = groupSvgPaths(RAW)
    const g0 = groups[0]!
    const shape0 = g0.shapes[0]!
    const pathIndices = shape0.paths.map(p => p.pathIndex).sort((a, b) => a - b)
    // group 0 holds global path indices 0 and 1
    expect(pathIndices).toEqual([0, 1])
  })

  it('single polygon shape is isClosed', () => {
    const svg = '<svg viewBox="0 0 100 100"><polygon style="fill:none;stroke:#111;stroke-width:1;" points="0,0 10,0 10,10 0,10"/></svg>'
    const { groups } = groupSvgPaths(svg)
    expect(groups[0]!.shapes[0]!.isClosed).toBe(true)
  })
})
