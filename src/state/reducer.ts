import type { MapState, MapAction } from '../types'

export function createInitialState(): MapState {
  return {
    nodes: new Map(),
    edges: new Map(),
    buildings: new Map(),
    center: { x: 0, y: 0 },
    zoom: 1,
    activeFloor: 1,
    viewMode: 'top_down',
    userLocation: null,
    destination: null,
    route: null,
    searchQuery: null,
    searchResults: [],
    userConstraints: {},
  }
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'SET_NODES': {
      const nodes = new Map(action.payload.map(n => [n.id, n]))
      return { ...state, nodes }
    }
    case 'SET_EDGES': {
      const edges = new Map(action.payload.map(e => [e.id, e]))
      return { ...state, edges }
    }
    case 'SET_BUILDINGS': {
      const buildings = new Map(action.payload.map(b => [b.id, b]))
      return { ...state, buildings }
    }
    case 'SET_CENTER':
      return { ...state, center: action.payload }
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload }
    case 'SET_ACTIVE_FLOOR':
      return { ...state, activeFloor: action.payload }
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload }
    case 'SET_USER_LOCATION':
      return { ...state, userLocation: action.payload }
    case 'SET_DESTINATION':
      return { ...state, destination: action.payload }
    case 'SET_ROUTE':
      return { ...state, route: action.payload }
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload }
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload }
    case 'SET_USER_CONSTRAINTS':
      return { ...state, userConstraints: action.payload }
    default:
      return state
  }
}
