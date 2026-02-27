import { describe, expect, it } from 'vitest'
import { exportGraphJson } from './exportGraphJson'

describe('exportGraphJson', () => {
  it('exports graph JSON for valid inputs', () => {
    const raw = '<svg><path d="M 0 0 L 10 0" style="fill:none;stroke-width:0.27;stroke:#000;"/></svg>'
    const result = exportGraphJson(raw)
    expect(result.ok).toBe(true)
    expect(result.report.isValid).toBe(true)
    expect(result.json.length).toBeGreaterThan(0)
  })
})
