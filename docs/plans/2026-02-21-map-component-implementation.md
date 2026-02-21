# Map Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a graph-based campus navigation map component with route finding and search.

**Architecture:** Graph data model (nodes/edges) with constraint-based route finding. React Context for state, SVG for rendering, vitest for testing.

**Tech Stack:** React 19, TypeScript, tsup, vitest, biome

---

## Task 1: Project Setup

**Files:**
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Modify: `package.json`

**Step 1: Add tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Update package.json for vitest and build**

Add to package.json scripts and dependencies:

```json
{
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "biome check src",
    "format": "biome format --write src"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "tsup": "^8.5.1"
  }
}
```

**Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

**Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
```

**Step 5: Create src/index.ts (empty export placeholder)**

```typescript
// Map component exports will go here
export {}
```

**Step 6: Install dependencies**

Run: `pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom`
Expected: Dependencies installed successfully

**Step 7: Commit**

```bash
git add .
git commit -m "chore: setup project with tsconfig, vitest, tsup"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`
- Test: `src/types/index.test.ts`

**Step 1: Write the type tests**

```typescript
// src/types/index.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type { Node, Edge, Building, Point, MapState } from './index'

describe('Types', () => {
  it('Node should accept minimal fields', () => {
    const node: Node = {
      id: 'n1',
      type: 'room',
      position: { x: 0, y: 0 },
      floor: 1,
      tags: [],
      data: {},
    }
    expectTypeOf(node).toMatchTypeOf<Node>()
  })

  it('Node should accept optional fields', () => {
    const node: Node = {
      id: 'n2',
      type: 'corridor',
      position: { x: 100, y: 200, z: 0 },
      floor: 2,
      name: 'Main Hallway',
      tags: ['covered'],
      data: { width: 3.5 },
    }
    expectTypeOf(node).toMatchTypeOf<Node>()
  })

  it('Edge should have constraints', () => {
    const edge: Edge = {
      id: 'e1',
      from: 'n1',
      to: 'n2',
      bidirectional: true,
      distance: 10,
      constraints: {
        max: { width: 1.5, height: 2.2, weight: 100 },
        requires: ['keycard'],
      },
      tags: [],
      data: {},
    }
    expectTypeOf(edge).toMatchTypeOf<Edge>()
  })

  it('MapState should have all required fields', () => {
    const state: MapState = {
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
    expectTypeOf(state).toMatchTypeOf<MapState>()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/types/index.test.ts`
Expected: FAIL with "Cannot find module './index'"

**Step 3: Write the type definitions**

```typescript
// src/types/index.ts
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/types/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add type definitions for map data model"
```

---

## Task 3: Map Reducer

**Files:**
- Create: `src/state/reducer.ts`
- Test: `src/state/reducer.test.ts`

**Step 1: Write the reducer tests**

```typescript
// src/state/reducer.test.ts
import { describe, it, expect } from 'vitest'
import { mapReducer, createInitialState } from './reducer'
import type { MapState, MapAction, Node, Edge } from '../types'

describe('mapReducer', () => {
  it('should create initial state', () => {
    const state = createInitialState()
    expect(state.nodes.size).toBe(0)
    expect(state.edges.size).toBe(0)
    expect(state.zoom).toBe(1)
    expect(state.activeFloor).toBe(1)
  })

  it('should set nodes', () => {
    const state = createInitialState()
    const nodes: Node[] = [
      { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    ]
    const newState = mapReducer(state, { type: 'SET_NODES', payload: nodes })
    expect(newState.nodes.size).toBe(1)
    expect(newState.nodes.get('n1')?.type).toBe('room')
  })

  it('should set edges', () => {
    const state = createInitialState()
    const edges: Edge[] = [
      { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    ]
    const newState = mapReducer(state, { type: 'SET_EDGES', payload: edges })
    expect(newState.edges.size).toBe(1)
  })

  it('should set active floor', () => {
    const state = createInitialState()
    const newState = mapReducer(state, { type: 'SET_ACTIVE_FLOOR', payload: 2 })
    expect(newState.activeFloor).toBe(2)
  })

  it('should set destination', () => {
    const state = createInitialState()
    const newState = mapReducer(state, { type: 'SET_DESTINATION', payload: 'room-101' })
    expect(newState.destination).toBe('room-101')
  })

  it('should set route', () => {
    const state = createInitialState()
    const route = { nodeIds: ['n1', 'n2'], edges: ['e1'], distance: 10 }
    const newState = mapReducer(state, { type: 'SET_ROUTE', payload: route })
    expect(newState.route?.nodeIds).toEqual(['n1', 'n2'])
  })

  it('should set user constraints', () => {
    const state = createInitialState()
    const constraints = { max: { width: 1.0 } }
    const newState = mapReducer(state, { type: 'SET_USER_CONSTRAINTS', payload: constraints })
    expect(newState.userConstraints.max?.width).toBe(1.0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/state/reducer.test.ts`
Expected: FAIL with "Cannot find module './reducer'"

**Step 3: Write the reducer implementation**

```typescript
// src/state/reducer.ts
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
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/state/reducer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/state/
git commit -m "feat: add map state reducer"
```

---

## Task 4: Search Functions

**Files:**
- Create: `src/search/index.ts`
- Test: `src/search/index.test.ts`

**Step 1: Write the search tests**

```typescript
// src/search/index.test.ts
import { describe, it, expect } from 'vitest'
import { searchNodes } from './index'
import type { Node } from '../types'

describe('searchNodes', () => {
  const nodes: Node[] = [
    { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, name: 'Lecture Hall A', tags: ['lecture', 'projector'], data: { capacity: 100 } },
    { id: 'n2', type: 'room', position: { x: 100, y: 0 }, floor: 1, name: 'Lab 101', tags: ['lab', 'pc'], data: { capacity: 30 } },
    { id: 'n3', type: 'room', position: { x: 0, y: 100 }, floor: 2, name: 'Office 201', tags: ['office'], data: {} },
    { id: 'n4', type: 'corridor', position: { x: 50, y: 50 }, floor: 1, name: 'Main Hall', tags: ['covered'], data: {} },
  ]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  it('should filter by type', () => {
    const results = searchNodes(nodeMap, { type: 'room' })
    expect(results.length).toBe(3)
    expect(results.every(n => n.type === 'room')).toBe(true)
  })

  it('should filter by tags (AND)', () => {
    const results = searchNodes(nodeMap, { tags: ['lab'] })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('n2')
  })

  it('should filter by name (case insensitive)', () => {
    const results = searchNodes(nodeMap, { nameContains: 'lecture' })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('n1')
  })

  it('should filter by floor', () => {
    const results = searchNodes(nodeMap, { floor: 1 })
    expect(results.length).toBe(3)
  })

  it('should exclude tags', () => {
    const results = searchNodes(nodeMap, { type: 'room', excludeTags: ['lab'] })
    expect(results.length).toBe(2)
    expect(results.every(n => !n.tags.includes('lab'))).toBe(true)
  })

  it('should combine filters', () => {
    const results = searchNodes(nodeMap, { type: 'room', tags: ['projector'], floor: 1 })
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('n1')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/search/index.test.ts`
Expected: FAIL with "Cannot find module './index'"

**Step 3: Write the search implementation**

```typescript
// src/search/index.ts
import type { Node, SearchRequest } from '../types'

export function searchNodes(
  nodes: Map<string, Node>,
  query: SearchRequest
): Node[] {
  const results: Node[] = []

  for (const node of nodes.values()) {
    if (query.type && node.type !== query.type) continue
    if (query.floor !== undefined && node.floor !== query.floor) continue

    if (query.tags && !query.tags.every(t => node.tags.includes(t))) continue
    if (query.excludeTags && query.excludeTags.some(t => node.tags.includes(t))) continue

    if (query.nameContains) {
      const name = node.name?.toLowerCase() ?? ''
      if (!name.includes(query.nameContains.toLowerCase())) continue
    }

    results.push(node)
  }

  return results
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/search/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/search/
git commit -m "feat: add search functionality"
```

---

## Task 5: Route Finding Functions

**Files:**
- Create: `src/route/index.ts`
- Test: `src/route/index.test.ts`

**Step 1: Write the route tests**

```typescript
// src/route/index.test.ts
import { describe, it, expect } from 'vitest'
import { findRoute, filterEdgesByConstraints } from './index'
import type { Node, Edge } from '../types'

describe('filterEdgesByConstraints', () => {
  const edges: Edge[] = [
    { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    { id: 'e2', from: 'n2', to: 'n3', bidirectional: true, distance: 10, constraints: { max: { width: 1.0 } }, tags: [], data: {} },
    { id: 'e3', from: 'n3', to: 'n4', bidirectional: true, distance: 10, constraints: { requires: ['keycard'] }, tags: [], data: {} },
  ]
  const edgeMap = new Map(edges.map(e => [e.id, e]))

  it('should return all edges when no constraints', () => {
    const filtered = filterEdgesByConstraints(edgeMap, {})
    expect(filtered.length).toBe(3)
  })

  it('should filter by max width', () => {
    const filtered = filterEdgesByConstraints(edgeMap, { max: { width: 0.8 } })
    expect(filtered.length).toBe(2) // e2 is excluded
    expect(filtered.find(e => e.id === 'e2')).toBeUndefined()
  })

  it('should filter by max width (passes)', () => {
    const filtered = filterEdgesByConstraints(edgeMap, { max: { width: 1.2 } })
    expect(filtered.length).toBe(3) // all pass
  })

  it('should filter by requires', () => {
    const filtered = filterEdgesByConstraints(edgeMap, { requires: ['keycard'] })
    expect(filtered.length).toBe(1) // only e3 has keycard requirement
  })
})

describe('findRoute', () => {
  const nodes: Node[] = [
    { id: 'A', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'B', type: 'corridor', position: { x: 10, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'C', type: 'corridor', position: { x: 20, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'D', type: 'room', position: { x: 30, y: 0 }, floor: 1, tags: [], data: {} },
  ]
  const edges: Edge[] = [
    { id: 'AB', from: 'A', to: 'B', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    { id: 'BC', from: 'B', to: 'C', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
    { id: 'CD', from: 'C', to: 'D', bidirectional: true, distance: 10, constraints: {}, tags: [], data: {} },
  ]
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edgeMap = new Map(edges.map(e => [e.id, e]))

  it('should find direct path', () => {
    const route = findRoute(nodeMap, edgeMap, { from: 'A', to: 'D' })
    expect(route).not.toBeNull()
    expect(route?.nodeIds).toEqual(['A', 'B', 'C', 'D'])
    expect(route?.distance).toBe(30)
  })

  it('should return null for unreachable nodes', () => {
    const extraNode: Node = { id: 'X', type: 'room', position: { x: 100, y: 100 }, floor: 2, tags: [], data: {} }
    const extraNodeMap = new Map(nodeMap).set('X', extraNode)
    const route = findRoute(extraNodeMap, edgeMap, { from: 'A', to: 'X' })
    expect(route).toBeNull()
  })

  it('should return same node for same start/end', () => {
    const route = findRoute(nodeMap, edgeMap, { from: 'A', to: 'A' })
    expect(route?.nodeIds).toEqual(['A'])
    expect(route?.distance).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/route/index.test.ts`
Expected: FAIL with "Cannot find module './index'"

**Step 3: Write the route implementation**

```typescript
// src/route/index.ts
import type { Node, Edge, RouteRequest, UserConstraints, Route } from '../types'

export function filterEdgesByConstraints(
  edges: Map<string, Edge>,
  constraints: UserConstraints
): Edge[] {
  const { max, requires } = constraints

  return [...edges.values()].filter(edge => {
    const ec = edge.constraints

    // Size/weight limit check
    if (max?.width !== undefined && ec.max?.width !== undefined) {
      if (max.width > ec.max.width) return false
    }
    if (max?.height !== undefined && ec.max?.height !== undefined) {
      if (max.height > ec.max.height) return false
    }
    if (max?.weight !== undefined && ec.max?.weight !== undefined) {
      if (max.weight > ec.max.weight) return false
    }

    // Requirement check - user must have all required permissions
    if (requires && ec.requires) {
      if (!requires.every(r => ec.requires!.includes(r))) return false
    }

    // Blocked check
    if (ec.blocked) {
      // Simple check - if blocked has any value, skip for now
      if (ec.blocked.from || ec.blocked.to) return false
    }

    return true
  })
}

interface DijkstraNode {
  id: string
  distance: number
  previous: string | null
  edgeId: string | null
}

export function findRoute(
  nodes: Map<string, Node>,
  edges: Map<string, Edge>,
  request: RouteRequest
): Route | null {
  const { from, to, avoid = [], constraints = {}, optimizeBy = 'distance' } = request

  // Same node
  if (from === to) {
    return { nodeIds: [from], edges: [], distance: 0 }
  }

  // Filter edges by constraints
  const validEdges = filterEdgesByConstraints(edges, constraints)
    .filter(e => !avoid.includes(e.id) && !avoid.includes(e.from) && !avoid.includes(e.to))

  // Build adjacency list
  const adjacency = new Map<string, Array<{ to: string; edge: Edge }>>()
  for (const node of nodes.keys()) {
    adjacency.set(node, [])
  }

  for (const edge of validEdges) {
    const cost = optimizeBy === 'time' ? (edge.estimatedTime ?? edge.distance) : edge.distance
    adjacency.get(edge.from)?.push({ to: edge.to, edge: { ...edge, distance: cost } })
    if (edge.bidirectional) {
      adjacency.get(edge.to)?.push({ to: edge.from, edge: { ...edge, distance: cost } })
    }
  }

  // Dijkstra's algorithm
  const distances = new Map<string, DijkstraNode>()
  for (const nodeId of nodes.keys()) {
    distances.set(nodeId, { id: nodeId, distance: Infinity, previous: null, edgeId: null })
  }
  distances.set(from, { id: from, distance: 0, previous: null, edgeId: null })

  const visited = new Set<string>()
  const queue = [from]

  while (queue.length > 0) {
    // Get node with minimum distance
    queue.sort((a, b) => (distances.get(a)?.distance ?? Infinity) - (distances.get(b)?.distance ?? Infinity))
    const current = queue.shift()!

    if (visited.has(current)) continue
    visited.add(current)

    if (current === to) break

    const neighbors = adjacency.get(current) ?? []
    for (const { to: neighbor, edge } of neighbors) {
      if (visited.has(neighbor)) continue

      const currentDist = distances.get(current)?.distance ?? Infinity
      const neighborDist = distances.get(neighbor)?.distance ?? Infinity
      const newDist = currentDist + edge.distance

      if (newDist < neighborDist) {
        distances.set(neighbor, {
          id: neighbor,
          distance: newDist,
          previous: current,
          edgeId: edge.id,
        })
        queue.push(neighbor)
      }
    }
  }

  // Reconstruct path
  const endNode = distances.get(to)
  if (!endNode || endNode.distance === Infinity) {
    return null
  }

  const nodeIds: string[] = []
  const edgeIds: string[] = []
  let current: string | null = to

  while (current !== null) {
    nodeIds.unshift(current)
    const node = distances.get(current)
    if (node?.edgeId) {
      edgeIds.unshift(node.edgeId)
    }
    current = node?.previous ?? null
  }

  // Get original edges for correct distance
  const originalEdges = new Map(edges.values().map(e => [e.id, e]))
  let totalDistance = 0
  for (const edgeId of edgeIds) {
    totalDistance += originalEdges.get(edgeId)?.distance ?? 0
  }

  return { nodeIds, edges: edgeIds, distance: totalDistance }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/route/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/route/
git commit -m "feat: add route finding with Dijkstra algorithm"
```

---

## Task 6: Map Context Provider

**Files:**
- Create: `src/context/MapContext.tsx`
- Test: `src/context/MapContext.test.tsx`

**Step 1: Write the context tests**

```typescript
// src/context/MapContext.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MapProvider, useMap } from './MapContext'
import type { Node } from '../types'

function TestComponent({ callback }: { callback: (map: ReturnType<typeof useMap>) => void }) {
  const map = useMap()
  callback(map)
  return <div>Test</div>
}

describe('MapProvider', () => {
  it('should provide initial state', () => {
    let mapState: ReturnType<typeof useMap> | null = null
    render(
      <MapProvider>
        <TestComponent callback={(map) => { mapState = map }} />
      </MapProvider>
    )

    expect(mapState?.nodes.size).toBe(0)
    expect(mapState?.activeFloor).toBe(1)
  })

  it('should dispatch SET_NODES action', async () => {
    let mapState: ReturnType<typeof useMap> | null = null
    render(
      <MapProvider>
        <TestComponent callback={(map) => { mapState = map }} />
      </MapProvider>
    )

    const nodes: Node[] = [
      { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    ]

    await act(async () => {
      mapState?.dispatch({ type: 'SET_NODES', payload: nodes })
    })

    expect(mapState?.nodes.size).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/context/MapContext.test.tsx`
Expected: FAIL with "Cannot find module './MapContext'"

**Step 3: Write the context implementation**

```typescript
// src/context/MapContext.tsx
import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react'
import type { MapState, MapAction } from '../types'
import { mapReducer, createInitialState } from '../state/reducer'

interface MapContextValue extends MapState {
  dispatch: React.Dispatch<MapAction>
}

const MapContext = createContext<MapContextValue | null>(null)

interface MapProviderProps {
  children: ReactNode
  initialState?: Partial<MapState>
}

export function MapProvider({ children, initialState }: MapProviderProps) {
  const [state, dispatch] = useReducer(mapReducer, {
    ...createInitialState(),
    ...initialState,
  })

  const value = useMemo(() => ({
    ...state,
    dispatch,
  }), [state])

  return (
    <MapContext.Provider value={value}>
      {children}
    </MapContext.Provider>
  )
}

export function useMap(): MapContextValue {
  const context = useContext(MapContext)
  if (!context) {
    throw new Error('useMap must be used within a MapProvider')
  }
  return context
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/context/MapContext.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/context/
git commit -m "feat: add MapProvider context"
```

---

## Task 7: NodeRenderer Component

**Files:**
- Create: `src/components/NodeRenderer.tsx`
- Test: `src/components/NodeRenderer.test.tsx`

**Step 1: Write the NodeRenderer tests**

```typescript
// src/components/NodeRenderer.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeRenderer } from './NodeRenderer'
import type { Node } from '../types'

describe('NodeRenderer', () => {
  const node: Node = {
    id: 'n1',
    type: 'room',
    position: { x: 100, y: 200 },
    floor: 1,
    name: 'Room 101',
    tags: ['lecture'],
    data: { width: 50, height: 30 },
  }

  it('should render a rect for room type', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={1} />
      </svg>
    )

    const rect = container.querySelector('rect')
    expect(rect).toBeInTheDocument()
  })

  it('should render a circle for stairs type', () => {
    const stairsNode: Node = { ...node, id: 'n2', type: 'stairs' }
    const { container } = render(
      <svg>
        <NodeRenderer node={stairsNode} scale={1} />
      </svg>
    )

    const circle = container.querySelector('circle')
    expect(circle).toBeInTheDocument()
  })

  it('should position element at correct coordinates', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={2} />
      </svg>
    )

    const element = container.querySelector('rect')
    expect(element?.getAttribute('x')).toBe('200') // 100 * 2
    expect(element?.getAttribute('y')).toBe('400') // 200 * 2
  })

  it('should highlight selected node', () => {
    const { container } = render(
      <svg>
        <NodeRenderer node={node} scale={1} isSelected={true} />
      </svg>
    )

    const element = container.querySelector('rect')
    expect(element?.getAttribute('stroke')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/NodeRenderer.test.tsx`
Expected: FAIL with "Cannot find module './NodeRenderer'"

**Step 3: Write the NodeRenderer implementation**

```typescript
// src/components/NodeRenderer.tsx
import type { Node } from '../types'

interface NodeRendererProps {
  node: Node
  scale: number
  isSelected?: boolean
  onClick?: (node: Node) => void
}

export function NodeRenderer({ node, scale, isSelected, onClick }: NodeRendererProps) {
  const x = node.position.x * scale
  const y = node.position.y * scale
  const width = (node.data.width as number ?? 20) * scale
  const height = (node.data.height as number ?? 20) * scale

  const fillColor = getFillColor(node.type)
  const strokeColor = isSelected ? '#ff6600' : '#333'
  const strokeWidth = isSelected ? 3 : 1

  const handleClick = () => {
    onClick?.(node)
  }

  if (node.type === 'stairs' || node.type === 'elevator') {
    return (
      <circle
        cx={x}
        cy={y}
        r={width / 2}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        onClick={handleClick}
        data-testid={`node-${node.id}`}
      />
    )
  }

  return (
    <rect
      x={x - width / 2}
      y={y - height / 2}
      width={width}
      height={height}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      onClick={handleClick}
      data-testid={`node-${node.id}`}
    />
  )
}

function getFillColor(type: string): string {
  const colors: Record<string, string> = {
    room: '#4a90d9',
    corridor: '#8bc34a',
    stairs: '#ff9800',
    elevator: '#9c27b0',
    entrance: '#f44336',
    office: '#2196f3',
  }
  return colors[type] ?? '#888'
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/components/NodeRenderer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add NodeRenderer component"
```

---

## Task 8: EdgeRenderer Component

**Files:**
- Create: `src/components/EdgeRenderer.tsx`
- Test: `src/components/EdgeRenderer.test.tsx`

**Step 1: Write the EdgeRenderer tests**

```typescript
// src/components/EdgeRenderer.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EdgeRenderer } from './EdgeRenderer'
import type { Node, Edge } from '../types'

describe('EdgeRenderer', () => {
  const nodes: Node[] = [
    { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, tags: [], data: {} },
    { id: 'n2', type: 'room', position: { x: 100, y: 100 }, floor: 1, tags: [], data: {} },
  ]
  const edge: Edge = {
    id: 'e1',
    from: 'n1',
    to: 'n2',
    bidirectional: true,
    distance: 141,
    constraints: {},
    tags: [],
    data: {},
  }
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  it('should render a line between nodes', () => {
    const { container } = render(
      <svg>
        <EdgeRenderer edge={edge} nodes={nodeMap} scale={1} />
      </svg>
    )

    const line = container.querySelector('line')
    expect(line).toBeInTheDocument()
    expect(line?.getAttribute('x1')).toBe('0')
    expect(line?.getAttribute('y1')).toBe('0')
    expect(line?.getAttribute('x2')).toBe('100')
    expect(line?.getAttribute('y2')).toBe('100')
  })

  it('should render nothing if nodes not found', () => {
    const emptyMap = new Map<string, Node>()
    const { container } = render(
      <svg>
        <EdgeRenderer edge={edge} nodes={emptyMap} scale={1} />
      </svg>
    )

    const line = container.querySelector('line')
    expect(line).not.toBeInTheDocument()
  })

  it('should highlight route edge', () => {
    const { container } = render(
      <svg>
        <EdgeRenderer edge={edge} nodes={nodeMap} scale={1} isOnRoute={true} />
      </svg>
    )

    const line = container.querySelector('line')
    expect(line?.getAttribute('stroke')).toBe('#ff6600')
    expect(line?.getAttribute('stroke-width')).toBe('4')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/EdgeRenderer.test.tsx`
Expected: FAIL with "Cannot find module './EdgeRenderer'"

**Step 3: Write the EdgeRenderer implementation**

```typescript
// src/components/EdgeRenderer.tsx
import type { Node, Edge } from '../types'

interface EdgeRendererProps {
  edge: Edge
  nodes: Map<string, Node>
  scale: number
  isOnRoute?: boolean
  onClick?: (edge: Edge) => void
}

export function EdgeRenderer({ edge, nodes, scale, isOnRoute, onClick }: EdgeRendererProps) {
  const fromNode = nodes.get(edge.from)
  const toNode = nodes.get(edge.to)

  if (!fromNode || !toNode) return null

  const x1 = fromNode.position.x * scale
  const y1 = fromNode.position.y * scale
  const x2 = toNode.position.x * scale
  const y2 = toNode.position.y * scale

  const stroke = isOnRoute ? '#ff6600' : '#aaa'
  const strokeWidth = isOnRoute ? 4 : 2

  const handleClick = () => {
    onClick?.(edge)
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      onClick={handleClick}
      data-testid={`edge-${edge.id}`}
    />
  )
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/components/EdgeRenderer.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/EdgeRenderer.tsx src/components/EdgeRenderer.test.tsx
git commit -m "feat: add EdgeRenderer component"
```

---

## Task 9: MapCanvas Component

**Files:**
- Create: `src/components/MapCanvas.tsx`
- Test: `src/components/MapCanvas.test.tsx`

**Step 1: Write the MapCanvas tests**

```typescript
// src/components/MapCanvas.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapCanvas } from './MapCanvas'
import { MapProvider } from '../context/MapContext'
import type { Node, Edge } from '../types'

describe('MapCanvas', () => {
  const nodes: Node[] = [
    { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, name: 'Room A', tags: [], data: {} },
    { id: 'n2', type: 'room', position: { x: 100, y: 0 }, floor: 1, name: 'Room B', tags: [], data: {} },
  ]
  const edges: Edge[] = [
    { id: 'e1', from: 'n1', to: 'n2', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  ]

  it('should render SVG container', () => {
    render(
      <MapProvider initialState={{ nodes: new Map(), edges: new Map() }}>
        <MapCanvas width={800} height={600} />
      </MapProvider>
    )

    const svg = screen.getByRole('img', { hidden: true })
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('should render nodes for active floor', () => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const edgeMap = new Map(edges.map(e => [e.id, e]))

    render(
      <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, activeFloor: 1 }}>
        <MapCanvas width={800} height={600} />
      </MapProvider>
    )

    const rects = document.querySelectorAll('rect')
    expect(rects.length).toBe(2)
  })

  it('should not render nodes on different floor', () => {
    const floor2Nodes = nodes.map(n => ({ ...n, floor: 2 }))
    const nodeMap = new Map(floor2Nodes.map(n => [n.id, n]))
    const edgeMap = new Map(edges.map(e => [e.id, e]))

    render(
      <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, activeFloor: 1 }}>
        <MapCanvas width={800} height={600} />
      </MapProvider>
    )

    const rects = document.querySelectorAll('rect')
    expect(rects.length).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/MapCanvas.test.tsx`
Expected: FAIL with "Cannot find module './MapCanvas'"

**Step 3: Write the MapCanvas implementation**

```typescript
// src/components/MapCanvas.tsx
import { useMap } from '../context/MapContext'
import { NodeRenderer } from './NodeRenderer'
import { EdgeRenderer } from './EdgeRenderer'

interface MapCanvasProps {
  width: number
  height: number
  scale?: number
  onNodeClick?: (nodeId: string) => void
}

export function MapCanvas({ width, height, scale = 1, onNodeClick }: MapCanvasProps) {
  const { nodes, edges, activeFloor, route, center } = useMap()

  const routeEdgeSet = new Set(route?.edges ?? [])

  // Filter nodes/edges by active floor
  const floorNodes = [...nodes.values()].filter(n => n.floor === activeFloor)
  const floorEdges = [...edges.values()].filter(e => {
    const fromNode = nodes.get(e.from)
    const toNode = nodes.get(e.to)
    return fromNode?.floor === activeFloor && toNode?.floor === activeFloor
  })

  // Calculate viewBox for panning
  const viewBoxX = center.x - width / (2 * scale)
  const viewBoxY = center.y - height / (2 * scale)
  const viewBoxWidth = width / scale
  const viewBoxHeight = height / scale

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label="Campus map"
    >
      {/* Render edges first (below nodes) */}
      {floorEdges.map(edge => (
        <EdgeRenderer
          key={edge.id}
          edge={edge}
          nodes={nodes}
          scale={1}
          isOnRoute={routeEdgeSet.has(edge.id)}
        />
      ))}

      {/* Render nodes on top */}
      {floorNodes.map(node => (
        <NodeRenderer
          key={node.id}
          node={node}
          scale={1}
          isSelected={route?.nodeIds.includes(node.id) ?? false}
          onClick={(n) => onNodeClick?.(n.id)}
        />
      ))}
    </svg>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/components/MapCanvas.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/MapCanvas.tsx src/components/MapCanvas.test.tsx
git commit -m "feat: add MapCanvas component"
```

---

## Task 10: Export Public API

**Files:**
- Modify: `src/index.ts`
- Create: `src/components/index.ts`
- Create: `src/hooks/index.ts`
- Test: `src/index.test.ts`

**Step 1: Write the export tests**

```typescript
// src/index.test.ts
import { describe, it, expect } from 'vitest'
import * as exports from './index'

describe('Public API exports', () => {
  it('should export types', () => {
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/index.test.ts`
Expected: FAIL with undefined exports

**Step 3: Create component index**

```typescript
// src/components/index.ts
export { NodeRenderer } from './NodeRenderer'
export { EdgeRenderer } from './EdgeRenderer'
export { MapCanvas } from './MapCanvas'
```

**Step 4: Create hooks index**

```typescript
// src/hooks/index.ts
export { useMap } from '../context/MapContext'
```

**Step 5: Update main index**

```typescript
// src/index.ts
// Components
export { MapProvider, useMap } from './context/MapContext'
export { MapCanvas } from './components/MapCanvas'
export { NodeRenderer } from './components/NodeRenderer'
export { EdgeRenderer } from './components/EdgeRenderer'

// State
export { mapReducer, createInitialState } from './state/reducer'

// Search
export { searchNodes } from './search'

// Route
export { findRoute, filterEdgesByConstraints } from './route'

// Types
export type {
  Point,
  Bounds,
  Node,
  Edge,
  EdgeConstraints,
  Building,
  UserLocation,
  Route,
  UserConstraints,
  MapState,
  MapAction,
  SearchRequest,
  RouteRequest,
} from './types'
```

**Step 6: Run test to verify it passes**

Run: `pnpm test:run src/index.test.ts`
Expected: PASS

**Step 7: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 8: Commit**

```bash
git add .
git commit -m "feat: export public API"
```

---

## Task 11: Build Verification

**Files:**
- Modify: `package.json` (if needed)

**Step 1: Run build**

Run: `pnpm build`
Expected: Build completes successfully, dist/ folder created

**Step 2: Verify dist contents**

Run: `ls dist/`
Expected: index.js, index.mjs, index.d.ts files present

**Step 3: Final commit**

```bash
git add .
git commit -m "chore: verify build"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Project Setup | tsconfig.json, vitest.config.ts, tsup.config.ts |
| 2 | Type Definitions | src/types/index.ts |
| 3 | Map Reducer | src/state/reducer.ts |
| 4 | Search Functions | src/search/index.ts |
| 5 | Route Finding | src/route/index.ts |
| 6 | Map Context Provider | src/context/MapContext.tsx |
| 7 | NodeRenderer Component | src/components/NodeRenderer.tsx |
| 8 | EdgeRenderer Component | src/components/EdgeRenderer.tsx |
| 9 | MapCanvas Component | src/components/MapCanvas.tsx |
| 10 | Export Public API | src/index.ts |
| 11 | Build Verification | - |
