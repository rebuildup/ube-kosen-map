// src/importer/svg/parseSvgSegments.test.ts
import { describe, expect, it } from 'vitest'
import { parseSvgSegments } from './parseSvgSegments'

describe('parseSvgSegments', () => {
  it('extracts segments from a path element', () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M10 20 L30 40 L50 20" style="stroke:#000;" /></svg>'
    const segs = parseSvgSegments(svg)
    expect(segs.length).toBe(2)
    expect(segs[0]).toMatchObject({ a: { x: 10, y: 20 }, b: { x: 30, y: 40 } })
    expect(segs[1]).toMatchObject({ a: { x: 30, y: 40 }, b: { x: 50, y: 20 } })
  })

  it('extracts segments from a line element', () => {
    const svg = '<svg viewBox="0 0 100 100"><line x1="0" y1="0" x2="50" y2="50" stroke="#000" /></svg>'
    const segs = parseSvgSegments(svg)
    expect(segs.length).toBe(1)
    expect(segs[0]).toMatchObject({ a: { x: 0, y: 0 }, b: { x: 50, y: 50 } })
  })

  it('extracts segments from a polyline element', () => {
    const svg = '<svg viewBox="0 0 100 100"><polyline points="0,0 10,10 20,0" stroke="#000" /></svg>'
    const segs = parseSvgSegments(svg)
    expect(segs.length).toBe(2)
  })

  it('extracts segments from a polygon and closes the loop', () => {
    const svg = '<svg viewBox="0 0 100 100"><polygon points="0,0 10,0 10,10" stroke="#000" /></svg>'
    const segs = parseSvgSegments(svg)
    // 3 edges: 0→1, 1→2, 2→0
    expect(segs.length).toBe(3)
  })

  it('ignores zero-length segments', () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M10 10 L10 10 L20 20" stroke="#000" /></svg>'
    const segs = parseSvgSegments(svg)
    expect(segs.length).toBe(1)
  })

  it('attaches featureId from element id attribute', () => {
    const svg = '<svg viewBox="0 0 100 100"><path id="B001" d="M0 0 L10 0" stroke="#000" /></svg>'
    const segs = parseSvgSegments(svg)
    expect(segs[0]?.featureId).toBe('B001')
  })

  it('skips elements inside defs', () => {
    const svg = '<svg viewBox="0 0 100 100"><defs><path id="x" d="M0 0 L10 0" stroke="#000" /></defs></svg>'
    const segs = parseSvgSegments(svg)
    expect(segs.length).toBe(0)
  })
})
