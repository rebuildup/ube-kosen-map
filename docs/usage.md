# ube-kosen-map 利用ガイド

React DOMベースのキャンパスナビゲーションコンポーネントライブラリ

---

## 1. クイックスタート

### インストール

```bash
pnpm add ube-kosen-map
```

### 基本的なセットアップ

```tsx
import { MapProvider, MapCanvas, SearchPanel, RoutePanel } from 'ube-kosen-map'
import 'ube-kosen-map/styles.css'

// Sample map data
const initialData = {
  nodes: [
    { id: 'entrance-1', type: 'entrance', position: { x: 0, y: 0 }, floor: 1, name: 'Main Entrance', tags: ['wheelchair'] },
    { id: 'room-101', type: 'room', position: { x: 50, y: 30 }, floor: 1, name: 'Lecture Room 101', tags: ['lecture-room', 'has-wifi'] },
  ],
  edges: [
    { id: 'edge-1', from: 'entrance-1', to: 'room-101', bidirectional: true, distance: 60, constraints: {}, tags: [] },
  ],
  buildings: [
    { id: 'building-a', name: 'Building A', bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }, floors: [1, 2, 3], nodeIds: ['entrance-1', 'room-101'], tags: [] },
  ],
}

function App() {
  return (
    <MapProvider initialData={initialData}>
      <div className="map-container">
        <MapCanvas />
        <SearchPanel />
        <RoutePanel />
      </div>
    </MapProvider>
  )
}
```

---

## 2. 基本的な使用例

### 地図の表示のみ

```tsx
import { MapProvider, MapCanvas } from 'ube-kosen-map'

function SimpleMap() {
  return (
    <MapProvider initialData={mapData}>
      <MapCanvas width={800} height={600} />
    </MapProvider>
  )
}
```

### フロア選択付き

```tsx
import { MapProvider, MapCanvas, FloorSelector } from 'ube-kosen-map'

function MapWithFloorSelector() {
  return (
    <MapProvider initialData={mapData}>
      <MapCanvas />
      <FloorSelector />
    </MapProvider>
  )
}
```

### 経路案内付き

```tsx
import { MapProvider, MapCanvas, RoutePanel, useMap } from 'ube-kosen-map'

function NavigationApp() {
  return (
    <MapProvider initialData={mapData}>
      <MapCanvas />
      <RoutePanel />
    </MapProvider>
  )
}
```

---

## 3. データフォーマット

### Node（ノード）

全ての「場所」はノードとして定義されます

```typescript
interface Node {
  id: string                    // Unique identifier
  type: string                  // Node type (see below)
  position: Point               // Coordinates
  floor: number                 // Floor number
  name?: string                 // Display name
  tags: string[]                // Search/filter tags
  data: Record<string, unknown> // Custom extension data
}

interface Point {
  x: number
  y: number
  z?: number  // Height for section view
}
```

#### ノードタイプ一覧

| Type | 説明 | Example |
|------|------|---------|
| `room` | 部屋 | 講義室, 事務室 |
| `corridor` | 廊下 | 通路 |
| `stairs` | 階段 | 通常階段 |
| `elevator` | エレベータ | 車椅子対応 |
| `entrance` | 入口 | 正面玄関 |
| `restroom` | トイレ | 多目的トイレ |

#### サンプルノード

```typescript
const nodes: Node[] = [
  // Entrance node
  {
    id: 'entrance-main',
    type: 'entrance',
    position: { x: 0, y: 0 },
    floor: 1,
    name: 'Main Entrance',
    tags: ['wheelchair', 'main'],
    data: {
      hours: '6:00-22:00',
      hasSecurity: true,
    },
  },

  // Lecture room
  {
    id: 'room-201',
    type: 'room',
    position: { x: 100, y: 50 },
    floor: 2,
    name: 'Lecture Room 201',
    tags: ['lecture-room', 'has-wifi', 'has-projector'],
    data: {
      capacity: 80,
      facilities: ['projector', 'whiteboard', 'microphone'],
    },
  },

  // Elevator
  {
    id: 'elevator-1',
    type: 'elevator',
    position: { x: 50, y: 100 },
    floor: 1,
    name: 'Main Elevator',
    tags: ['wheelchair', 'public'],
    data: {
      maxCapacity: 12,
      floors: [1, 2, 3, 4, 5],
    },
  },

  // Stairs
  {
    id: 'stairs-west',
    type: 'stairs',
    position: { x: 0, y: 100 },
    floor: 1,
    name: 'West Stairs',
    tags: [],
    data: {
      steps: 24,
      hasHandrail: true,
    },
  },

  // Corridor junction
  {
    id: 'corridor-j1',
    type: 'corridor',
    position: { x: 50, y: 50 },
    floor: 1,
    tags: [],
    data: {},
  },
]
```

### Edge（エッジ）

ノード間の接続と移動制約を定義します

```typescript
interface Edge {
  id: string
  from: string              // Source Node.id
  to: string                // Target Node.id
  bidirectional: boolean    // Two-way connection
  distance: number          // Distance in meters
  estimatedTime?: number    // Estimated travel time in seconds
  constraints: {
    max?: { width?: number; height?: number; weight?: number }
    requires?: string[]     // Required capabilities/access
    blocked?: { from?: string; to?: string }  // Time-based blocking
  }
  tags: string[]
  data: Record<string, unknown>
}
```

#### サンプルエッジ

```typescript
const edges: Edge[] = [
  // Standard corridor
  {
    id: 'edge-corridor-1',
    from: 'entrance-main',
    to: 'corridor-j1',
    bidirectional: true,
    distance: 50,
    estimatedTime: 40,
    constraints: {},
    tags: ['indoor'],
    data: {},
  },

  // Narrow passage with size limit
  {
    id: 'edge-narrow-1',
    from: 'corridor-j1',
    to: 'room-storage',
    bidirectional: true,
    distance: 10,
    constraints: {
      max: { width: 80, height: 200 },  // cm
    },
    tags: ['narrow'],
    data: {},
  },

  // Restricted access
  {
    id: 'edge-restricted-1',
    from: 'corridor-j1',
    to: 'room-server',
    bidirectional: false,
    distance: 15,
    constraints: {
      requires: ['keycard', 'staff-only'],
    },
    tags: ['restricted'],
    data: {},
  },

  // Elevator connection
  {
    id: 'edge-elevator-1f-2f',
    from: 'elevator-1-floor1',
    to: 'elevator-1-floor2',
    bidirectional: true,
    distance: 0,  // Vertical distance handled separately
    estimatedTime: 15,
    constraints: {
      max: { weight: 1000 },  // kg
    },
    tags: ['elevator', 'wheelchair'],
    data: {},
  },

  // Stairs connection
  {
    id: 'edge-stairs-1f-2f',
    from: 'stairs-west-floor1',
    to: 'stairs-west-floor2',
    bidirectional: true,
    distance: 15,
    estimatedTime: 30,
    constraints: {},  // No wheelchair access
    tags: ['stairs'],
    data: {},
  },
]
```

### Building（建物）

ノードを建物単位でグループ化します

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

#### サンプル建物

```typescript
const buildings: Building[] = [
  {
    id: 'building-main',
    name: 'Main Building',
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: 200, y: 150 },
    },
    floors: [1, 2, 3, 4, 5],
    nodeIds: [
      'entrance-main',
      'corridor-j1',
      'room-201',
      'elevator-1',
      'stairs-west',
    ],
    tags: ['main', 'public'],
    data: {
      address: '2-2-11 Tsushimiya, Ube, Yamaguchi',
      yearBuilt: 1995,
    },
  },

  {
    id: 'building-library',
    name: 'Library',
    bounds: {
      min: { x: 200, y: 0 },
      max: { x: 300, y: 100 },
    },
    floors: [1, 2],
    nodeIds: ['library-entrance', 'library-reading-room'],
    tags: ['quiet-zone', 'study'],
    data: {
      openHours: '9:00-21:00',
      hasWifi: true,
    },
  },
]
```

---

## 4. API リファレンス

### useMap Hook

メインの状態管理フックです

```typescript
interface UseMapReturn {
  // State
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  buildings: Map<string, Building>

  // View state
  center: Point
  zoom: number
  activeFloor: number
  viewMode: 'top_down' | 'section'

  // User state
  userLocation: UserLocation | null
  destination: string | null
  route: Route | null

  // Search
  searchQuery: string | null
  searchResults: string[]

  // User constraints
  userConstraints: UserConstraints

  // Actions
  setActiveFloor: (floor: number) => void
  setViewMode: (mode: 'top_down' | 'section') => void
  setZoom: (zoom: number) => void
  setCenter: (center: Point) => void

  setUserLocation: (location: UserLocation | null) => void
  setDestination: (nodeId: string | null) => void

  findRoute: (request: RouteRequest) => RouteResult | null
  search: (query: SearchRequest) => string[]
  clearRoute: () => void

  setUserConstraints: (constraints: UserConstraints) => void

  // Data operations
  addNode: (node: Node) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  removeNode: (id: string) => void

  addEdge: (edge: Edge) => void
  updateEdge: (id: string, updates: Partial<Edge>) => void
  removeEdge: (id: string) => void
}
```

#### 使用例

```tsx
import { useMap } from 'ube-kosen-map'

function MapControls() {
  const {
    activeFloor,
    setActiveFloor,
    viewMode,
    setViewMode,
    userLocation,
    setUserLocation,
    destination,
    setDestination,
    route,
    findRoute,
    search,
  } = useMap()

  const handleNavigate = () => {
    if (userLocation && destination) {
      const result = findRoute({
        from: userLocation.nodeId,
        to: destination,
        optimizeBy: 'distance',
      })
      console.log('Route:', result)
    }
  }

  return (
    <div>
      <button onClick={() => setActiveFloor(activeFloor - 1)}>
        Floor Down
      </button>
      <button onClick={() => setActiveFloor(activeFloor + 1)}>
        Floor Up
      </button>
      <button onClick={() => setViewMode(viewMode === 'top_down' ? 'section' : 'top_down')}>
        Toggle View
      </button>
      <button onClick={handleNavigate}>
        Navigate
      </button>
    </div>
  )
}
```

### RouteRequest

```typescript
interface RouteRequest {
  from: string                    // Source node ID
  to: string                      // Target node ID
  avoid?: string[]                // Node IDs to avoid
  optimizeBy?: 'distance' | 'time'
  constraints?: UserConstraints
}
```

### UserConstraints

```typescript
interface UserConstraints {
  max?: {
    width?: number   // cm
    height?: number  // cm
    weight?: number  // kg
  }
  requires?: string[]  // Required capabilities (e.g., ['wheelchair'])
}
```

### RouteResult

```typescript
interface RouteResult {
  nodeIds: string[]    // Ordered path of node IDs
  edges: string[]      // Edge IDs along the path
  distance: number     // Total distance in meters
  estimatedTime?: number  // Estimated time in seconds
}
```

---

## 5. 検索と経路探索

### 検索機能

#### タグによる検索

```tsx
import { useMap } from 'ube-kosen-map'

function SearchByTag() {
  const { search } = useMap()

  // Find all wheelchair accessible locations
  const accessibleNodes = search({
    tags: ['wheelchair'],
  })

  // Find lecture rooms with WiFi
  const studyRooms = search({
    tags: ['lecture-room', 'has-wifi'],
  })

  return (
    <ul>
      {accessibleNodes.map(nodeId => (
        <li key={nodeId}>{nodeId}</li>
      ))}
    </ul>
  )
}
```

#### タイプによる検索

```tsx
function SearchByType() {
  const { search, nodes } = useMap()

  // Find all elevators
  const elevatorIds = search({ type: 'elevator' })

  // Find all rooms
  const roomIds = search({ type: 'room' })

  return (
    <div>
      <h3>Elevators</h3>
      {elevatorIds.map(id => {
        const node = nodes.get(id)
        return <div key={id}>{node?.name}</div>
      })}
    </div>
  )
}
```

#### 名前による検索

```tsx
function SearchByName() {
  const { search, nodes } = useMap()

  const [query, setQuery] = useState('')

  const results = search({
    nameContains: query,
  })

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name..."
      />
      <ul>
        {results.map(id => {
          const node = nodes.get(id)
          return <li key={id}>{node?.name}</li>
        })}
      </ul>
    </div>
  )
}
```

#### 複合条件検索

```tsx
function AdvancedSearch() {
  const { search, userLocation } = useMap()

  // Find quiet study spots with WiFi, excluding lecture rooms
  const quietSpots = search({
    tags: ['has-wifi'],
    excludeTags: ['lecture-room', 'crowded'],
    type: 'room',
    nameContains: 'study',
  })

  // Find accessible restrooms on current floor
  const accessibleRestrooms = search({
    tags: ['wheelchair'],
    type: 'restroom',
    // Note: floor filtering should be done separately
  })

  return <div>{/* Render results */}</div>
}
```

### 経路探索

#### 基本的な経路探索

```tsx
function BasicNavigation() {
  const { findRoute, userLocation, setDestination, route } = useMap()

  const navigateToRoom = (roomId: string) => {
    if (userLocation) {
      const result = findRoute({
        from: userLocation.nodeId,
        to: roomId,
      })

      if (result) {
        console.log(`Distance: ${result.distance}m`)
        console.log(`Time: ${result.estimatedTime}s`)
        console.log(`Path: ${result.nodeIds.join(' -> ')}`)
      }
    }
  }

  return (
    <button onClick={() => navigateToRoom('room-201')}>
      Navigate to Room 201
    </button>
  )
}
```

#### 制約付き経路探索

```tsx
function AccessibleNavigation() {
  const { findRoute, setUserConstraints } = useMap()

  // Set wheelchair constraints
  useEffect(() => {
    setUserConstraints({
      requires: ['wheelchair'],
    })
  }, [])

  const navigate = (from: string, to: string) => {
    const result = findRoute({
      from,
      to,
      constraints: {
        requires: ['wheelchair'],
      },
    })

    // This route will avoid stairs and narrow passages
    return result
  }

  return <div>{/* UI */}</div>
}
```

#### サイズ制約付き経路探索

```tsx
function LargeItemTransport() {
  const { findRoute } = useMap()

  const transportLargeEquipment = (from: string, to: string) => {
    // Find route for large equipment
    const result = findRoute({
      from,
      to,
      constraints: {
        max: {
          width: 150,  // cm
          height: 200, // cm
          weight: 500, // kg
        },
      },
    })

    if (!result) {
      alert('No accessible route for this size')
    }

    return result
  }

  return <div>{/* UI */}</div>
}
```

#### 特定ノードを回避する経路

```tsx
function AvoidConstruction() {
  const { findRoute } = useMap()

  const constructionAreaIds = ['corridor-b2', 'stairs-east']

  const navigateAvoidingConstruction = (from: string, to: string) => {
    return findRoute({
      from,
      to,
      avoid: constructionAreaIds,
    })
  }

  return <div>{/* UI */}</div>
}
```

---

## 6. カスタムノードタイプとタグの追加

### カスタムノードタイプの定義

```typescript
// Extend the type definition
type CustomNodeType =
  | 'room'
  | 'corridor'
  | 'stairs'
  | 'elevator'
  | 'entrance'
  | 'restroom'
  | 'vending-machine'      // Custom
  | 'study-pod'            // Custom
  | 'printer-area'         // Custom
  | 'locker'               // Custom

// Create a node with custom type
const customNode: Node = {
  id: 'vending-1',
  type: 'vending-machine',
  position: { x: 75, y: 50 },
  floor: 1,
  name: 'Vending Machine Area',
  tags: ['drinks', 'snacks'],
  data: {
    items: ['coffee', 'water', 'juice', 'chips'],
    acceptsICCard: true,
  },
}
```

### カスタムタグの設計

#### タグカテゴリの例

```typescript
// Accessibility tags
const accessibilityTags = [
  'wheelchair',      // Wheelchair accessible
  'barrier-free',    // Barrier-free design
  'audio-guide',     // Audio guidance available
  'braille',         // Braille signage
]

// Facility tags
const facilityTags = [
  'has-wifi',
  'has-projector',
  'has-whiteboard',
  'has-microphone',
  'has-outlets',
  'has-water-fountain',
]

// Environment tags
const environmentTags = [
  'quiet-zone',
  'study-zone',
  'social-zone',
  'eating-allowed',
  'shoes-off',
]

// Access tags
const accessTags = [
  'public',
  'staff-only',
  'student-only',
  'keycard-required',
  'reservation-required',
]
```

### カスタムノードの実装例

```tsx
import { useMap, Node } from 'ube-kosen-map'

// Define study pod nodes
const studyPodNodes: Node[] = [
  {
    id: 'study-pod-1',
    type: 'study-pod',
    position: { x: 120, y: 80 },
    floor: 2,
    name: 'Study Pod A',
    tags: ['quiet-zone', 'has-outlets', 'reservation-required'],
    data: {
      capacity: 4,
      hasDisplay: true,
      hasWhiteboard: true,
      reservable: true,
      maxReservationHours: 2,
    },
  },
  {
    id: 'study-pod-2',
    type: 'study-pod',
    position: { x: 150, y: 80 },
    floor: 2,
    name: 'Study Pod B',
    tags: ['quiet-zone', 'has-outlets'],
    data: {
      capacity: 2,
      hasDisplay: false,
      hasWhiteboard: false,
      reservable: false,  // First come, first served
    },
  },
]

// Add nodes to map
function StudyPodManager() {
  const { addNode, search } = useMap()

  const initializeStudyPods = () => {
    studyPodNodes.forEach(node => addNode(node))
  }

  const findAvailablePods = () => {
    return search({
      type: 'study-pod',
      tags: ['has-outlets'],
    })
  }

  const findReservablePods = () => {
    return search({
      type: 'study-pod',
      tags: ['reservation-required'],
    })
  }

  return (
    <div>
      <button onClick={initializeStudyPods}>
        Initialize Study Pods
      </button>
      <button onClick={findAvailablePods}>
        Find Study Pods
      </button>
    </div>
  )
}
```

### カスタムレンダリング

```tsx
import { NodeRenderer, Node } from 'ube-kosen-map'

// Custom node renderer for specific types
function CustomNodeRenderer({ node }: { node: Node }) {
  switch (node.type) {
    case 'vending-machine':
      return (
        <g className="node vending-machine">
          <rect
            x={node.position.x - 10}
            y={node.position.y - 15}
            width={20}
            height={30}
            fill="#4CAF50"
            rx={4}
          />
          <text
            x={node.position.x}
            y={node.position.y}
            textAnchor="middle"
            fill="white"
            fontSize={10}
          >
            V
          </text>
        </g>
      )

    case 'study-pod':
      return (
        <g className="node study-pod">
          <rect
            x={node.position.x - 20}
            y={node.position.y - 15}
            width={40}
            height={30}
            fill="#2196F3"
            rx={8}
          />
          <text
            x={node.position.x}
            y={node.position.y}
            textAnchor="middle"
            fill="white"
            fontSize={8}
          >
            {node.name}
          </text>
        </g>
      )

    case 'printer-area':
      return (
        <g className="node printer-area">
          <circle
            cx={node.position.x}
            cy={node.position.y}
            r={12}
            fill="#FF9800"
          />
          <text
            x={node.position.x}
            y={node.position.y + 4}
            textAnchor="middle"
            fill="white"
            fontSize={12}
          >
            P
          </text>
        </g>
      )

    default:
      return <DefaultNodeRenderer node={node} />
  }
}
```

### タグベースのフィルタリングUI

```tsx
function TagFilterUI() {
  const { search } = useMap()

  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [excludedTags, setExcludedTags] = useState<string[]>([])

  const availableTags = [
    'wheelchair', 'has-wifi', 'quiet-zone', 'has-outlets',
    'has-projector', 'eating-allowed', 'public',
  ]

  const handleSearch = () => {
    const results = search({
      tags: selectedTags,
      excludeTags: excludedTags,
    })
    console.log('Results:', results)
  }

  const toggleTag = (tag: string, isExcluded: boolean) => {
    if (isExcluded) {
      setExcludedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      )
    } else {
      setSelectedTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      )
    }
  }

  return (
    <div className="tag-filter">
      <h3>Filter by Tags</h3>

      <div className="tag-list">
        {availableTags.map(tag => (
          <div key={tag} className="tag-row">
            <label>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag, false)}
              />
              Include: {tag}
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludedTags.includes(tag)}
                onChange={() => toggleTag(tag, true)}
              />
              Exclude: {tag}
            </label>
          </div>
        ))}
      </div>

      <button onClick={handleSearch}>Search</button>
    </div>
  )
}
```

---

## 7. ビューモード

### Top-down View（俯瞰図）

```tsx
import { MapProvider, MapCanvas } from 'ube-kosen-map'

function TopDownView() {
  return (
    <MapProvider
      initialData={mapData}
      initialViewMode="top_down"
    >
      <MapCanvas />
    </MapProvider>
  )
}
```

### Section View（断面図）

高さ情報を使った側面図表示です

```tsx
import { useMap, MapCanvas } from 'ube-kosen-map'

function SectionViewMap() {
  const { viewMode, setViewMode } = useMap()

  return (
    <div>
      <button onClick={() => setViewMode('section')}>
        Section View
      </button>
      <button onClick={() => setViewMode('top_down')}>
        Top-down View
      </button>
      <MapCanvas />
    </div>
  )
}
```

### ビューモードの切り替え

```tsx
import { ViewModeToggle, useMap } from 'ube-kosen-map'

function MapWithViewToggle() {
  const { viewMode } = useMap()

  return (
    <div>
      <ViewModeToggle />
      <p>Current mode: {viewMode}</p>
      <MapCanvas />
    </div>
  )
}
```

---

## 8. 完全な例

### キャンパスナビゲーションアプリ

```tsx
import {
  MapProvider,
  MapCanvas,
  SearchPanel,
  RoutePanel,
  FloorSelector,
  ViewModeToggle,
  ZoomControl,
  useMap,
} from 'ube-kosen-map'
import 'ube-kosen-map/styles.css'

const campusData = {
  nodes: [
    { id: 'entrance-main', type: 'entrance', position: { x: 100, y: 200 }, floor: 1, name: 'Main Gate', tags: ['main'] },
    { id: 'building-a-1f', type: 'corridor', position: { x: 150, y: 200 }, floor: 1, name: 'Building A 1F', tags: [] },
    { id: 'building-a-2f', type: 'corridor', position: { x: 150, y: 200 }, floor: 2, name: 'Building A 2F', tags: [] },
    { id: 'room-101', type: 'room', position: { x: 180, y: 180 }, floor: 1, name: 'Room 101', tags: ['lecture-room'] },
    { id: 'room-201', type: 'room', position: { x: 180, y: 180 }, floor: 2, name: 'Room 201', tags: ['lecture-room', 'has-projector'] },
    { id: 'elevator-a', type: 'elevator', position: { x: 150, y: 220 }, floor: 1, name: 'Elevator A', tags: ['wheelchair'] },
    { id: 'stairs-a', type: 'stairs', position: { x: 120, y: 220 }, floor: 1, name: 'Stairs A', tags: [] },
  ],
  edges: [
    { id: 'e1', from: 'entrance-main', to: 'building-a-1f', bidirectional: true, distance: 50, constraints: {}, tags: [] },
    { id: 'e2', from: 'building-a-1f', to: 'room-101', bidirectional: true, distance: 30, constraints: {}, tags: [] },
    { id: 'e3', from: 'building-a-1f', to: 'elevator-a', bidirectional: true, distance: 20, constraints: { max: { weight: 1000 } }, tags: ['wheelchair'] },
    { id: 'e4', from: 'building-a-1f', to: 'stairs-a', bidirectional: true, distance: 30, constraints: {}, tags: [] },
    { id: 'e5', from: 'elevator-a', to: 'building-a-2f', bidirectional: true, distance: 0, constraints: {}, tags: ['elevator'] },
    { id: 'e6', from: 'stairs-a', to: 'building-a-2f', bidirectional: true, distance: 15, constraints: {}, tags: ['stairs'] },
    { id: 'e7', from: 'building-a-2f', to: 'room-201', bidirectional: true, distance: 30, constraints: {}, tags: [] },
  ],
  buildings: [
    { id: 'building-a', name: 'Building A', bounds: { min: { x: 100, y: 150 }, max: { x: 200, y: 250 } }, floors: [1, 2], nodeIds: ['building-a-1f', 'building-a-2f', 'room-101', 'room-201'], tags: [] },
  ],
}

function NavigationApp() {
  return (
    <MapProvider initialData={campusData}>
      <div className="app-container">
        <header>
          <h1>Campus Navigator</h1>
        </header>

        <main className="main-content">
          <aside className="sidebar">
            <SearchPanel />
            <FloorSelector />
            <ViewModeToggle />
            <AccessibilityOptions />
          </aside>

          <div className="map-area">
            <MapCanvas>
              <ZoomControl />
            </MapCanvas>
          </div>

          <aside className="route-panel">
            <RoutePanel />
          </aside>
        </main>
      </div>
    </MapProvider>
  )
}

function AccessibilityOptions() {
  const { setUserConstraints, userConstraints } = useMap()

  const toggleWheelchair = () => {
    const currentRequires = userConstraints?.requires || []
    const hasWheelchair = currentRequires.includes('wheelchair')

    setUserConstraints({
      ...userConstraints,
      requires: hasWheelchair
        ? currentRequires.filter(r => r !== 'wheelchair')
        : [...currentRequires, 'wheelchair'],
    })
  }

  return (
    <div className="accessibility-options">
      <label>
        <input
          type="checkbox"
          checked={userConstraints?.requires?.includes('wheelchair') || false}
          onChange={toggleWheelchair}
        />
        Wheelchair Accessible Routes
      </label>
    </div>
  )
}

export default NavigationApp
```

---

## License

MIT
