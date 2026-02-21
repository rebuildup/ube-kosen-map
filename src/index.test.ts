import { describe, it, expect } from 'vitest'
import * as exports from './index'

describe('Public API exports', () => {
  it('should export components and functions', () => {
    expect(exports.MapProvider).toBeDefined()
    expect(exports.useMap).toBeDefined()
    expect(exports.MapCanvas).toBeDefined()
    expect(exports.NodeRenderer).toBeDefined()
    expect(exports.EdgeRenderer).toBeDefined()
    expect(exports.searchNodes).toBeDefined()
    expect(exports.findRoute).toBeDefined()
    expect(exports.filterEdgesByConstraints).toBeDefined()
  })
})
