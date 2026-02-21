import { useState } from 'react'
import {
  MapProvider,
  MapCanvas,
  useMap,
  searchNodes,
  findRoute,
  type Node,
  type Edge,
} from '../src'

// Sample campus data
const sampleNodes: Node[] = [
  { id: 'entrance', type: 'entrance', position: { x: 200, y: 50 }, floor: 1, name: 'Main Entrance', tags: [], data: { width: 30, height: 20 } },
  { id: 'corridor-1', type: 'corridor', position: { x: 200, y: 150 }, floor: 1, name: 'Main Corridor', tags: ['covered'], data: { width: 100, height: 10 } },
  { id: 'room-101', type: 'room', position: { x: 100, y: 200 }, floor: 1, name: 'Lecture Hall A', tags: ['lecture', 'projector'], data: { width: 60, height: 40, capacity: 100 } },
  { id: 'room-102', type: 'room', position: { x: 200, y: 250 }, floor: 1, name: 'Lab 102', tags: ['lab', 'pc'], data: { width: 50, height: 30, capacity: 30 } },
  { id: 'room-103', type: 'room', position: { x: 300, y: 200 }, floor: 1, name: 'Office 103', tags: ['office'], data: { width: 40, height: 30 } },
  { id: 'stairs-1', type: 'stairs', position: { x: 350, y: 150 }, floor: 1, name: 'Stairs', tags: [], data: { width: 20 } },
  { id: 'elevator-1', type: 'elevator', position: { x: 50, y: 150 }, floor: 1, name: 'Elevator', tags: ['wheelchair'], data: { width: 15 } },
  // Floor 2
  { id: 'room-201', type: 'room', position: { x: 100, y: 200 }, floor: 2, name: 'Library', tags: ['quiet', 'study'], data: { width: 80, height: 60 } },
  { id: 'room-202', type: 'room', position: { x: 250, y: 200 }, floor: 2, name: 'Meeting Room', tags: ['meeting'], data: { width: 40, height: 30 } },
]

const sampleEdges: Edge[] = [
  { id: 'e1', from: 'entrance', to: 'corridor-1', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  { id: 'e2', from: 'corridor-1', to: 'room-101', bidirectional: true, distance: 50, constraints: {}, tags: [], data: {} },
  { id: 'e3', from: 'corridor-1', to: 'room-102', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  { id: 'e4', from: 'corridor-1', to: 'room-103', bidirectional: true, distance: 50, constraints: { requires: ['keycard'] }, tags: [], data: {} },
  { id: 'e5', from: 'corridor-1', to: 'stairs-1', bidirectional: true, distance: 150, constraints: {}, tags: [], data: {} },
  { id: 'e6', from: 'corridor-1', to: 'elevator-1', bidirectional: true, distance: 150, constraints: {}, tags: [], data: {} },
  // Narrow corridor to Lab 102
  { id: 'e7', from: 'corridor-1', to: 'room-102', bidirectional: true, distance: 100, constraints: { max: { width: 0.8 } }, tags: ['narrow'], data: {} },
]

function Controls() {
  const { nodes, edges, activeFloor, dispatch, destination, route, userConstraints } = useMap()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Node[]>([])

  const handleSearch = () => {
    const found = searchNodes(nodes, {
      nameContains: searchQuery,
      floor: activeFloor,
    })
    setResults(found)
  }

  const handleNavigate = (targetId: string) => {
    const currentLocation = 'entrance' // Simplified: always start from entrance
    const result = findRoute(nodes, edges, {
      from: currentLocation,
      to: targetId,
      constraints: userConstraints,
    })
    if (result) {
      dispatch({ type: 'SET_ROUTE', payload: result })
      dispatch({ type: 'SET_DESTINATION', payload: targetId })
    } else {
      alert('No route found!')
    }
  }

  const toggleWheelchair = () => {
    dispatch({
      type: 'SET_USER_CONSTRAINTS',
      payload: userConstraints.requires?.includes('wheelchair')
        ? {}
        : { requires: ['wheelchair'] },
    })
  }

  return (
    <div style={{ padding: 16, borderBottom: '1px solid #ddd' }}>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>Floor:</label>
        <button onClick={() => dispatch({ type: 'SET_ACTIVE_FLOOR', payload: 1 })} style={{ fontWeight: activeFloor === 1 ? 'bold' : 'normal' }}>1F</button>
        <button onClick={() => dispatch({ type: 'SET_ACTIVE_FLOOR', payload: 2 })} style={{ fontWeight: activeFloor === 2 ? 'bold' : 'normal' }}>2F</button>

        <span style={{ marginLeft: 16 }}>
          <button onClick={toggleWheelchair} style={{ background: userConstraints.requires?.includes('wheelchair') ? '#4a90d9' : '#eee' }}>
            ♿ Wheelchair
          </button>
        </span>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <strong>Results:</strong>
          <ul style={{ listStyle: 'none', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {results.map((n) => (
              <li key={n.id}>
                <button onClick={() => handleNavigate(n.id)}>{n.name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {destination && route && (
        <div style={{ padding: 8, background: '#e8f5e9', borderRadius: 4 }}>
          <strong>Route to {nodes.get(destination)?.name}</strong>
          <br />
          Distance: {route.distance}m | {route.nodeIds.length} nodes
          <button style={{ marginLeft: 8 }} onClick={() => dispatch({ type: 'SET_ROUTE', payload: null })}>Clear</button>
        </div>
      )}
    </div>
  )
}

function Legend() {
  return (
    <div style={{ padding: 16, borderTop: '1px solid #ddd', fontSize: 12 }}>
      <strong>Legend:</strong>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, background: '#4a90d9', marginRight: 4 }}></span> Room</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, background: '#8bc34a', marginRight: 4 }}></span> Corridor</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, background: '#ff9800', borderRadius: '50%', marginRight: 4 }}></span> Stairs</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, background: '#9c27b0', borderRadius: '50%', marginRight: 4 }}></span> Elevator</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, background: '#f44336', marginRight: 4 }}></span> Entrance</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 4, background: '#ff6600', marginRight: 4 }}></span> Route</span>
      </div>
    </div>
  )
}

export function App() {
  const nodeMap = new Map(sampleNodes.map((n) => [n.id, n]))
  const edgeMap = new Map(sampleEdges.map((e) => [e.id, e]))

  return (
    <MapProvider initialState={{ nodes: nodeMap, edges: edgeMap, activeFloor: 1, center: { x: 200, y: 150 }, zoom: 1 }}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ padding: 16, background: '#333', color: '#fff' }}>ube-kosen-map Demo</h1>
        <Controls />
        <div style={{ flex: 1, background: '#f5f5f5', overflow: 'auto' }}>
          <MapCanvas width={800} height={500} />
        </div>
        <Legend />
      </div>
    </MapProvider>
  )
}
