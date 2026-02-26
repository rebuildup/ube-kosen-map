/**
 * @module core/routing
 * Routing engine: cost functions, A* pathfinding, and pre-defined profiles.
 */

export type {
  WeatherCondition,
  RoutingContext,
  EdgeCondition,
  CostModifier,
  RoutingProfile,
  CostFunction,
} from './cost'

export {
  computeCost,
  createProfile,
  PROFILE_DEFAULT,
  PROFILE_CART,
  PROFILE_RAIN,
  PROFILE_ACCESSIBLE,
  DEFAULT_CONTEXT,
  BUILT_IN_PROFILES,
} from './cost'

export type { Route, RouteResult, FloorTransition, FindRouteOptions } from './astar'
export { findRoute } from './astar'
