export interface Point {
  x: number
  y: number
  z?: number
}

export interface Bounds {
  min: Point
  max: Point
}

export interface Node {
  id: string
  type: string
  position: Point
  floor: number
  name?: string
  tags: string[]
  data: Record<string, unknown>
}

export interface EdgeConstraints {
  max?: {
    width?: number
    height?: number
    weight?: number
  }
  requires?: string[]
  blocked?: {
    from?: string
    to?: string
  }
}

export interface Edge {
  id: string
  from: string
  to: string
  bidirectional: boolean
  distance: number
  estimatedTime?: number
  constraints: EdgeConstraints
  tags: string[]
  data: Record<string, unknown>
}

export interface Building {
  id: string
  name: string
  bounds: Bounds
  floors: number[]
  nodeIds: string[]
  tags: string[]
  data: Record<string, unknown>
}

export interface UserLocation {
  nodeId: string
  position: Point
  floor: number
}

export interface Route {
  nodeIds: string[]
  edges: string[]
  distance: number
}

export interface UserConstraints {
  max?: {
    width?: number
    height?: number
    weight?: number
  }
  requires?: string[]
}

export interface MapState {
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  buildings: Map<string, Building>
  center: Point
  zoom: number
  activeFloor: number
  viewMode: 'top_down' | 'section'
  userLocation: UserLocation | null
  destination: string | null
  route: Route | null
  searchQuery: string | null
  searchResults: string[]
  userConstraints: UserConstraints
}

export type MapAction =
  | { type: 'SET_NODES'; payload: Node[] }
  | { type: 'SET_EDGES'; payload: Edge[] }
  | { type: 'SET_BUILDINGS'; payload: Building[] }
  | { type: 'SET_CENTER'; payload: Point }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_ACTIVE_FLOOR'; payload: number }
  | { type: 'SET_VIEW_MODE'; payload: MapState['viewMode'] }
  | { type: 'SET_USER_LOCATION'; payload: UserLocation | null }
  | { type: 'SET_DESTINATION'; payload: string | null }
  | { type: 'SET_ROUTE'; payload: Route | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string | null }
  | { type: 'SET_SEARCH_RESULTS'; payload: string[] }
  | { type: 'SET_USER_CONSTRAINTS'; payload: UserConstraints }

export interface SearchRequest {
  tags?: string[]
  excludeTags?: string[]
  type?: string
  nameContains?: string
  maxDistance?: number
  floor?: number
}

export interface RouteRequest {
  from: string
  to: string
  avoid?: string[]
  optimizeBy?: 'distance' | 'time'
  constraints?: UserConstraints
}
