# ube-kosen-map

React campus navigation map component library with route finding and search.

## Features

- **Graph-based data model** - Flexible node/edge structure for buildings, rooms, corridors
- **Constraint-based routing** - Size, weight, and permission-based path finding
- **Search functionality** - Filter by tags, type, name, floor
- **SVG rendering** - Scalable map visualization
- **TypeScript support** - Full type definitions included

## Installation

```bash
pnpm add ube-kosen-map
```

## Quick Start

```tsx
import { MapProvider, MapCanvas, useMap, searchNodes, findRoute } from 'ube-kosen-map'

function App() {
  return (
    <MapProvider initialState={{ nodes: myNodes, edges: myEdges }}>
      <MapCanvas width={800} height={600} />
    </MapProvider>
  )
}
```

## Usage

### Define Map Data

```typescript
import type { Node, Edge } from 'ube-kosen-map'

const nodes: Node[] = [
  {
    id: 'room-101',
    type: 'room',
    position: { x: 0, y: 0 },
    floor: 1,
    name: 'Lecture Hall A',
    tags: ['lecture', 'projector'],
    data: { capacity: 100, width: 50, height: 30 },
  },
  {
    id: 'corridor-1',
    type: 'corridor',
    position: { x: 100, y: 0 },
    floor: 1,
    tags: ['covered'],
    data: { width: 20, height: 5 },
  },
]

const edges: Edge[] = [
  {
    id: 'e1',
    from: 'room-101',
    to: 'corridor-1',
    bidirectional: true,
    distance: 10,
    constraints: { max: { width: 2.0, height: 2.5 } },
    tags: [],
    data: {},
  },
]
```

### Search Nodes

```typescript
import { useMap, searchNodes } from 'ube-kosen-map'

function SearchPanel() {
  const { nodes } = useMap()

  const results = searchNodes(nodes, {
    type: 'room',
    tags: ['lecture'],
    floor: 1,
  })

  return (
    <ul>
      {results.map(node => (
        <li key={node.id}>{node.name}</li>
      ))}
    </ul>
  )
}
```

### Find Route with Constraints

```typescript
import { useMap, findRoute } from 'ube-kosen-map'

function Navigation() {
  const { nodes, edges, dispatch } = useMap()

  const handleNavigate = (from: string, to: string) => {
    const route = findRoute(nodes, edges, {
      from,
      to,
      constraints: {
        max: { width: 1.0, height: 1.8 }, // Wheelchair constraints
      },
      optimizeBy: 'distance',
    })

    if (route) {
      dispatch({ type: 'SET_ROUTE', payload: route })
    }
  }

  return <button onClick={() => handleNavigate('entrance', 'room-101')}>Navigate</button>
}
```

## API Reference

### Components

| Component | Description |
|-----------|-------------|
| `MapProvider` | Context provider for map state |
| `MapCanvas` | Main SVG container for rendering |
| `NodeRenderer` | Renders individual nodes |
| `EdgeRenderer` | Renders edges between nodes |

### Hooks

| Hook | Description |
|------|-------------|
| `useMap()` | Access map state and dispatch |

### Functions

| Function | Description |
|----------|-------------|
| `searchNodes(nodes, query)` | Search nodes with filters |
| `findRoute(nodes, edges, request)` | Find shortest path with constraints |
| `filterEdgesByConstraints(edges, constraints)` | Filter edges by user constraints |
| `createInitialState()` | Create initial map state |
| `mapReducer(state, action)` | Reducer for state updates |

### Types

All types are exported:

```typescript
import type {
  Node,
  Edge,
  Building,
  Point,
  Bounds,
  MapState,
  MapAction,
  SearchRequest,
  RouteRequest,
  Route,
  UserConstraints,
  UserLocation,
  EdgeConstraints,
} from 'ube-kosen-map'
```

## Data Model

### Node

```typescript
interface Node {
  id: string
  type: string              // 'room', 'corridor', 'stairs', 'elevator', etc.
  position: Point
  floor: number
  name?: string
  tags: string[]            // ['wheelchair', 'quiet', 'has-wifi']
  data: Record<string, unknown>  // Custom properties
}
```

### Edge

```typescript
interface Edge {
  id: string
  from: string              // Node ID
  to: string                // Node ID
  bidirectional: boolean
  distance: number          // meters
  estimatedTime?: number    // seconds
  constraints: EdgeConstraints
  tags: string[]
  data: Record<string, unknown>
}
```

### EdgeConstraints

```typescript
interface EdgeConstraints {
  max?: {
    width?: number   // meters
    height?: number  // meters
    weight?: number  // kg
  }
  requires?: string[]  // ['keycard', 'wheelchair']
  blocked?: { from?: string; to?: string }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Lint
pnpm lint
```

## License

MIT
