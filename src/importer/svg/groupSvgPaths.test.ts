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
})
