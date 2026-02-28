// src/importer/svg/classifyFeatures.test.ts
import { describe, expect, it } from 'vitest'
import { classifySegments } from './classifyFeatures'
import type { Segment } from './parseSvgSegments'

const seg = (overrides: Partial<Segment> = {}): Segment => ({
  a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, ...overrides,
})

describe('classifySegments', () => {
  it('classifies by data-kind attribute (highest priority)', () => {
    const svgEl = '<svg><path id="x" data-kind="road" d="M0 0 L10 0" stroke="#000" /></svg>'
    const segs = [seg({ featureId: 'x' })]
    const result = classifySegments(segs, svgEl)
    expect(result[0]?.kind).toBe('road')
  })

  it('classifies by id prefix "B" as building', () => {
    const segs = [seg({ featureId: 'B001' })]
    const result = classifySegments(segs, '<svg/>')
    expect(result[0]?.kind).toBe('building')
  })

  it('classifies by id prefix "R" as road', () => {
    const segs = [seg({ featureId: 'R001' })]
    const result = classifySegments(segs, '<svg/>')
    expect(result[0]?.kind).toBe('road')
  })

  it('classifies by id prefix "D" as door', () => {
    const segs = [seg({ featureId: 'D001' })]
    const result = classifySegments(segs, '<svg/>')
    expect(result[0]?.kind).toBe('door')
  })

  it('classifies by id prefix "BA" as balcony', () => {
    const segs = [seg({ featureId: 'BA01' })]
    const result = classifySegments(segs, '<svg/>')
    expect(result[0]?.kind).toBe('balcony')
  })

  it('falls back to "other" when no rule matches', () => {
    const segs = [seg({ featureId: 'X999' })]
    const result = classifySegments(segs, '<svg/>')
    expect(result[0]?.kind).toBe('other')
  })

  it('segment without featureId falls back to "other"', () => {
    const segs = [seg()]
    const result = classifySegments(segs, '<svg/>')
    expect(result[0]?.kind).toBe('other')
  })
})
