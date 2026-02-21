# Map Component Design

## Overview

React DOMベースのキャンパスナビゲーションコンポーネント。グラフ構造で建物・部屋・通路の接続を表現し、条件付き経路探索を提供する。

## Data Model

### Node（全ての「場所」はノード）

```typescript
interface Node {
  id: string
  type: string              // "room", "corridor", "stairs", "elevator", "entrance", etc.
  position: Point
  floor: number
  name?: string

  tags: string[]            // ["wheelchair", "quiet", "has-wifi", "lecture-room"]
  data: Record<string, unknown>  // 自由拡張: capacity, facilities, hours, etc.
}

interface Point {
  x: number
  y: number
  z?: number                // 高さ（断面図用）
}
```

### Edge（接続関係と移動制約）

```typescript
interface Edge {
  id: string
  from: string              // Node.id
  to: string                // Node.id
  bidirectional: boolean

  distance: number          // meters
  estimatedTime?: number    // seconds

  constraints: {
    max?: { width?: number; height?: number; weight?: number }
    requires?: string[]     // ["keycard", "wheelchair", "permission"]
    blocked?: { from?: string; to?: string }
  }

  tags: string[]
  data: Record<string, unknown>
}
```

### Building（グルーピング）

```typescript
interface Building {
  id: string
  name: string
  bounds: Bounds
  floors: number[]
  nodeIds: string[]
  tags: string[]
  data: Record<string, unknown>
}

interface Bounds {
  min: Point
  max: Point
}
```

### MapState（アプリケーション状態）

```typescript
interface MapState {
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  buildings: Map<string, Building>

  // View
  center: Point
  zoom: number
  activeFloor: number
  viewMode: 'top_down' | 'section'

  // User
  userLocation: { nodeId: string; position: Point; floor: number } | null
  destination: string | null
  route: { nodeIds: string[]; edges: string[] } | null

  // Search
  searchQuery: string | null
  searchResults: string[]

  // User constraints for routing
  userConstraints: {
    max?: { width?: number; height?: number; weight?: number }
    requires?: string[]
  }
}
```

## Component Architecture

```
<MapProvider>           {/* State management Context */}
  <MapCanvas>           {/* SVG/Canvas container */}
    <MapLayer>          {/* Current floor rendering */}
      <NodeRenderer />  {/* Node -> SVG element */}
      <EdgeRenderer />  {/* Edge -> SVG line */}
    </MapLayer>

    <OverlayLayer>      {/* UI overlays */}
      <UserMarker />    {/* Current location */}
      <RoutePath />     {/* Route display */}
      <SearchMarkers /> {/* Search results */}
    </OverlayLayer>

    <Controls>          {/* Zoom, floor selector */}
      <ZoomControl />
      <FloorSelector />
      <ViewModeToggle />
    </Controls>
  </MapCanvas>

  <SearchPanel />       {/* Search UI */}
  <RoutePanel />        {/* Route guidance */}
</MapProvider>
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| `MapProvider` | State management, route finding logic |
| `MapCanvas` | SVG coordinate system, event handling |
| `NodeRenderer` | Render nodes based on `type`/`tags` |
| `EdgeRenderer` | Render connections (width varies by constraints) |
| `RoutePath` | Highlight shortest path |

## Route Finding

### Algorithm

1. **Filter edges by constraints** - Remove edges that don't satisfy user constraints
2. **Build adjacency graph** - Create graph from valid edges
3. **Dijkstra/A*** - Find shortest path

```typescript
function findRoute(
  graph: { nodes: Map<string, Node>; edges: Map<string, Edge> },
  request: RouteRequest
): { nodeIds: string[]; edges: string[]; distance: number } | null {

  const validEdges = filterEdgesByConstraints(graph.edges, request.constraints)

  return dijkstra(graph.nodes, validEdges, request.from, request.to, {
    avoid: request.avoid,
    optimizeBy: request.optimizeBy ?? 'distance'
  })
}
```

### Constraint Filtering

```typescript
function filterEdgesByConstraints(
  edges: Map<string, Edge>,
  constraints?: { max?: {...}; requires?: string[] }
): Edge[] {
  if (!constraints) return [...edges.values()]

  return [...edges.values()].filter(edge => {
    const { max, requires } = constraints
    const ec = edge.constraints

    // Size/weight limit check
    if (max?.width && ec.max?.width && max.width > ec.max.width) return false
    if (max?.height && ec.max?.height && max.height > ec.max.height) return false
    if (max?.weight && ec.max?.weight && max.weight > ec.max.weight) return false

    // Requirement check
    if (requires && ec.requires) {
      if (!requires.every(r => ec.requires!.includes(r))) return false
    }

    return true
  })
}
```

## Search

```typescript
interface SearchRequest {
  tags?: string[]            // Must include all tags
  excludeTags?: string[]     // Must not include
  type?: string              // Node type
  nameContains?: string      // Name fuzzy match
  maxDistance?: number       // From current location
  custom?: Record<string, unknown>
}

function searchNodes(nodes: Map<string, Node>, query: SearchRequest): Node[] {
  return [...nodes.values()].filter(node => {
    if (query.type && node.type !== query.type) return false
    if (query.tags && !query.tags.every(t => node.tags.includes(t))) return false
    if (query.excludeTags && query.excludeTags.some(t => node.tags.includes(t))) return false
    if (query.nameContains && !node.name?.toLowerCase().includes(query.nameContains.toLowerCase())) return false

    return true
  })
}
```

## View Modes

### Top-down View
- Standard floor plan view
- Nodes rendered at `(x, y)` coordinates
- Multiple floors shown as layers

### Section View
- Side view showing height changes
- Uses `z` coordinate
- Useful for stairs/elevator visualization

## Implementation Notes

1. **SVG-based rendering** - Scalable, easy event handling
2. **Coordinate system** - Meters, origin at campus center
3. **Data loading** - JSON files, future: API endpoint
4. **State management** - React Context + useReducer
5. **Route caching** - Cache computed routes for common paths

## Future Extensions

- [ ] Real-time user location (WiFi triangulation)
- [ ] Indoor positioning
- [ ] 3D perspective view
- [ ] Voice navigation
- [ ] Multi-floor route visualization
- [ ] Calendar integration (room availability)
