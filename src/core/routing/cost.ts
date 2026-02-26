/**
 * @module core/routing/cost
 * Cost function framework for pluggable, profile-based edge cost calculation.
 *
 * [P-3] Context-Aware Dynamics: costs vary by profile and environmental context.
 * [P-5] Data Normalization: profiles are declaratively defined as JSON-compatible objects.
 */

import type { GraphEdge, ProfileId } from '../schema'
import { createProfileId } from '../schema'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WeatherCondition = 'clear' | 'rain' | 'snow'

export interface RoutingContext {
  weather: WeatherCondition
  timeOfDay?: Date
  customFlags?: Record<string, boolean>
}

/** A condition that tests a boolean or numeric field on GraphEdge */
export interface EdgeCondition {
  field: keyof GraphEdge
  operator: '===' | '!==' | '<' | '>' | '<=' | '>='
  value: unknown
}

/** A single cost modification rule */
export interface CostModifier {
  condition: EdgeCondition
  /** Multiplicative factor. Infinity = edge is impassable */
  multiplier: number
  /** Additive penalty applied after multiplication */
  additive: number
  description: string
}

export interface RoutingProfile {
  id: ProfileId
  name: string
  description: string
  costModifiers: CostModifier[]
}

/** Signature of a cost function */
export type CostFunction = (
  edge: GraphEdge,
  profile: RoutingProfile,
  context: RoutingContext,
) => number

// ── Condition evaluator ───────────────────────────────────────────────────────

const evalCondition = (edge: GraphEdge, cond: EdgeCondition): boolean => {
  const fieldVal = edge[cond.field]
  switch (cond.operator) {
    case '===': return fieldVal === cond.value
    case '!==': return fieldVal !== cond.value
    case '<':   return typeof fieldVal === 'number' && fieldVal < (cond.value as number)
    case '>':   return typeof fieldVal === 'number' && fieldVal > (cond.value as number)
    case '<=':  return typeof fieldVal === 'number' && fieldVal <= (cond.value as number)
    case '>=':  return typeof fieldVal === 'number' && fieldVal >= (cond.value as number)
    default:    return false
  }
}

// ── Context-level cost adjustment ─────────────────────────────────────────────

const RAIN_OUTDOOR_MULTIPLIER = 3.0
const SNOW_OUTDOOR_MULTIPLIER = 8.0

const applyContext = (cost: number, edge: GraphEdge, ctx: RoutingContext): number => {
  if (cost === Infinity) return Infinity
  if (!edge.isOutdoor) return cost
  if (ctx.weather === 'rain')  return cost * RAIN_OUTDOOR_MULTIPLIER
  if (ctx.weather === 'snow')  return cost * SNOW_OUTDOOR_MULTIPLIER
  return cost
}

// ── Main cost function ────────────────────────────────────────────────────────

/**
 * Compute the traversal cost for an edge under a given profile and context.
 *
 * Pipeline:
 *   1. Base cost = edge.distance (default 1.0 if undefined)
 *   2. Apply profile cost modifiers in order
 *   3. Apply context adjustments (weather)
 *   4. Clamp to [0, Infinity]
 */
export const computeCost: CostFunction = (edge, profile, context) => {
  let cost = edge.distance ?? 1.0

  // Step 2: profile modifiers
  for (const mod of profile.costModifiers) {
    if (!evalCondition(edge, mod.condition)) continue
    if (mod.multiplier === Infinity) return Infinity
    cost = cost * mod.multiplier + mod.additive
  }

  // Step 3: context adjustments
  cost = applyContext(cost, edge, context)

  return Math.max(0, cost)
}

// ── Profile factory ───────────────────────────────────────────────────────────

export const createProfile = (
  id: string,
  name: string,
  description: string,
  costModifiers: CostModifier[],
): RoutingProfile => ({
  id: id as ProfileId,
  name,
  description,
  costModifiers,
})

// ── Pre-defined profiles ──────────────────────────────────────────────────────

/** Standard route: distance-based cost only */
export const PROFILE_DEFAULT: RoutingProfile = createProfile(
  'default', '通常', '距離ベースの標準経路', [],
)

/** Cart mode: avoids steps; penalizes narrow passages */
export const PROFILE_CART: RoutingProfile = createProfile(
  'cart', '台車モード', '段差のない経路を優先', [
    {
      condition: { field: 'hasSteps', operator: '===', value: true },
      multiplier: Infinity,
      additive: 0,
      description: '段差あり → 通行不可',
    },
    {
      condition: { field: 'width', operator: '<', value: 1.2 },
      multiplier: 10,
      additive: 0,
      description: '幅 < 1.2m → コスト×10',
    },
  ],
)

/** Rain mode: strongly penalizes outdoor segments */
export const PROFILE_RAIN: RoutingProfile = createProfile(
  'rain', '雨天モード', '屋外を避ける経路', [
    {
      condition: { field: 'isOutdoor', operator: '===', value: true },
      multiplier: 5,
      additive: 0,
      description: '屋外 → コスト×5',
    },
  ],
)

/** Barrier-free: no steps, elevator preferred */
export const PROFILE_ACCESSIBLE: RoutingProfile = createProfile(
  'accessible', 'バリアフリー', '段差なし + エレベーター優先', [
    {
      condition: { field: 'hasSteps', operator: '===', value: true },
      multiplier: Infinity,
      additive: 0,
      description: '段差あり → 通行不可',
    },
    {
      condition: { field: 'isVertical', operator: '===', value: true },
      multiplier: 0.5,
      additive: 0,
      description: '垂直接続（エレベーター等） → コスト×0.5',
    },
  ],
)

// ── Default context ───────────────────────────────────────────────────────────

export const DEFAULT_CONTEXT: RoutingContext = {
  weather: 'clear',
}

// ── Pre-defined profile registry ──────────────────────────────────────────────

export const BUILT_IN_PROFILES: readonly RoutingProfile[] = [
  PROFILE_DEFAULT,
  PROFILE_CART,
  PROFILE_RAIN,
  PROFILE_ACCESSIBLE,
] as const
