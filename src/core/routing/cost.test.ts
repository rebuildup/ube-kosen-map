import { describe, it, expect } from 'vitest'
import {
  computeCost,
  PROFILE_DEFAULT,
  PROFILE_CART,
  PROFILE_RAIN,
  PROFILE_ACCESSIBLE,
  DEFAULT_CONTEXT,
  createProfile,
} from './cost'
import type { GraphEdge } from '../schema'
import { createEdgeId, createNodeId } from '../schema'

const makeEdge = (overrides: Partial<GraphEdge> = {}): GraphEdge => ({
  id: createEdgeId(),
  sourceNodeId: createNodeId(),
  targetNodeId: createNodeId(),
  distance: 10,
  hasSteps: false,
  isOutdoor: false,
  width: 2.0,
  isVertical: false,
  ...overrides,
})

// ── Default profile ───────────────────────────────────────────────────────────

describe('PROFILE_DEFAULT', () => {
  it('returns distance as base cost', () => {
    const edge = makeEdge({ distance: 15 })
    const cost = computeCost(edge, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(cost).toBeCloseTo(15)
  })

  it('uses 1.0 as fallback when distance is undefined', () => {
    const edge = makeEdge({ distance: undefined })
    const cost = computeCost(edge, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    expect(cost).toBeCloseTo(1.0)
  })
})

// ── Cart mode profile ─────────────────────────────────────────────────────────

describe('PROFILE_CART (台車モード)', () => {
  it('returns Infinity for edges with steps', () => {
    const edge = makeEdge({ hasSteps: true })
    const cost = computeCost(edge, PROFILE_CART, DEFAULT_CONTEXT)
    expect(cost).toBe(Infinity)
  })

  it('penalizes narrow edges (width < 1.2)', () => {
    const edge = makeEdge({ width: 1.0, distance: 10 })
    const cost = computeCost(edge, PROFILE_CART, DEFAULT_CONTEXT)
    expect(cost).toBeGreaterThan(10) // penalized
  })

  it('does not penalize wide edges', () => {
    const edge = makeEdge({ width: 2.0, distance: 10 })
    const cost = computeCost(edge, PROFILE_CART, DEFAULT_CONTEXT)
    expect(cost).toBeCloseTo(10)
  })
})

// ── Rain mode profile ─────────────────────────────────────────────────────────

describe('PROFILE_RAIN (雨天モード)', () => {
  it('penalizes outdoor edges ×5 in default clear context', () => {
    const edge = makeEdge({ isOutdoor: true, distance: 10 })
    const cost = computeCost(edge, PROFILE_RAIN, DEFAULT_CONTEXT)
    expect(cost).toBeCloseTo(50)
  })

  it('does not penalize indoor edges', () => {
    const edge = makeEdge({ isOutdoor: false, distance: 10 })
    const cost = computeCost(edge, PROFILE_RAIN, DEFAULT_CONTEXT)
    expect(cost).toBeCloseTo(10)
  })
})

// ── Accessible profile ────────────────────────────────────────────────────────

describe('PROFILE_ACCESSIBLE (バリアフリー)', () => {
  it('returns Infinity for edges with steps', () => {
    const edge = makeEdge({ hasSteps: true })
    const cost = computeCost(edge, PROFILE_ACCESSIBLE, DEFAULT_CONTEXT)
    expect(cost).toBe(Infinity)
  })

  it('reduces cost for vertical (elevator) edges', () => {
    const edge = makeEdge({ isVertical: true, distance: 10 })
    const normalCost = computeCost(edge, PROFILE_DEFAULT, DEFAULT_CONTEXT)
    const accessCost = computeCost(edge, PROFILE_ACCESSIBLE, DEFAULT_CONTEXT)
    expect(accessCost).toBeLessThan(normalCost)
  })
})

// ── Context: rain weather ─────────────────────────────────────────────────────

describe('context rain weather', () => {
  it('applies outdoor penalty when weather=rain', () => {
    const edge = makeEdge({ isOutdoor: true, distance: 10 })
    const dryCtx = { ...DEFAULT_CONTEXT, weather: 'clear' as const }
    const wetCtx = { ...DEFAULT_CONTEXT, weather: 'rain' as const }
    const dryCost = computeCost(edge, PROFILE_DEFAULT, dryCtx)
    const wetCost = computeCost(edge, PROFILE_DEFAULT, wetCtx)
    expect(wetCost).toBeGreaterThan(dryCost)
  })
})

// ── Custom profile ────────────────────────────────────────────────────────────

describe('createProfile', () => {
  it('creates a custom profile with given modifiers', () => {
    const profile = createProfile('test', 'Test Profile', 'Testing', [
      {
        condition: { field: 'isOutdoor', operator: '===', value: true },
        multiplier: 3,
        additive: 0,
        description: 'outdoor ×3',
      },
    ])
    const edge = makeEdge({ isOutdoor: true, distance: 10 })
    const cost = computeCost(edge, profile, DEFAULT_CONTEXT)
    expect(cost).toBeCloseTo(30)
  })

  it('custom profile does not mutate the edge modifiers', () => {
    const profile = createProfile('t', 'T', 'T', [])
    const edge = makeEdge({ distance: 5 })
    computeCost(edge, profile, DEFAULT_CONTEXT)
    expect(edge.distance).toBe(5) // unchanged
  })
})

// ── Infinity handling ─────────────────────────────────────────────────────────

describe('Infinity handling', () => {
  it('once Infinity, stays Infinity regardless of subsequent multipliers', () => {
    const profile = createProfile('inf-test', '', '', [
      {
        condition: { field: 'hasSteps', operator: '===', value: true },
        multiplier: Infinity,
        additive: 0,
        description: 'no steps',
      },
      {
        condition: { field: 'isOutdoor', operator: '===', value: false },
        multiplier: 0.5,
        additive: 0,
        description: 'indoor discount',
      },
    ])
    const edge = makeEdge({ hasSteps: true, isOutdoor: false, distance: 10 })
    expect(computeCost(edge, profile, DEFAULT_CONTEXT)).toBe(Infinity)
  })
})
