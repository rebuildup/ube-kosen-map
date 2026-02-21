import { useState } from 'react'
import {
  MapProvider,
  MapCanvas,
  useMap,
  UserMarker,
  FloorSelector,
  ZoomControl,
  ViewModeToggle,
  SearchPanel,
  RoutePanel,
  findRoute,
  type Node,
  type Edge,
} from '../src'

// Sample campus data
const sampleNodes: Node[] = [
  { id: 'entrance', type: 'entrance', position: { x: 400, y: 100 }, floor: 1, name: 'Main Entrance', tags: [], data: { width: 40, height: 25 } },
  { id: 'corridor-main', type: 'corridor', position: { x: 400, y: 250 }, floor: 1, name: 'Main Corridor', tags: ['covered'], data: { width: 200, height: 15 } },
  { id: 'corridor-east', type: 'corridor', position: { x: 600, y: 350 }, floor: 1, name: 'East Wing', tags: ['covered'], data: { width: 15, height: 100 } },
  { id: 'corridor-west', type: 'corridor', position: { x: 200, y: 350 }, floor: 1, name: 'West Wing', tags: ['covered'], data: { width: 15, height: 100 } },
  { id: 'room-101', type: 'room', position: { x: 150, y: 300 }, floor: 1, name: 'Lecture Hall A', tags: ['lecture', 'projector', 'wifi'], data: { width: 80, height: 50, capacity: 150 } },
  { id: 'room-102', type: 'room', position: { x: 150, y: 420 }, floor: 1, name: 'Lecture Hall B', tags: ['lecture', 'projector'], data: { width: 80, height: 50, capacity: 100 } },
  { id: 'room-103', type: 'room', position: { x: 300, y: 350 }, floor: 1, name: 'Computer Lab', tags: ['lab', 'pc', 'wifi'], data: { width: 60, height: 40, capacity: 40 } },
  { id: 'room-104', type: 'room', position: { x: 500, y: 350 }, floor: 1, name: 'Physics Lab', tags: ['lab', 'science'], data: { width: 60, height: 40 } },
  { id: 'room-105', type: 'room', position: { x: 650, y: 300 }, floor: 1, name: 'Office 105', tags: ['office'], data: { width: 40, height: 30 } },
  { id: 'room-106', type: 'room', position: { x: 650, y: 420 }, floor: 1, name: 'Office 106', tags: ['office'], data: { width: 40, height: 30 } },
  { id: 'stairs-1', type: 'stairs', position: { x: 280, y: 250 }, floor: 1, name: 'Stairs West', tags: [], data: { width: 20 } },
  { id: 'stairs-2', type: 'stairs', position: { x: 520, y: 250 }, floor: 1, name: 'Stairs East', tags: [], data: { width: 20 } },
  { id: 'elevator-1', type: 'elevator', position: { x: 400, y: 350 }, floor: 1, name: 'Elevator', tags: ['wheelchair'], data: { width: 18 } },
  { id: 'restroom-m', type: 'room', position: { x: 350, y: 450 }, floor: 1, name: 'Restroom M', tags: ['restroom'], data: { width: 25, height: 20 } },
  { id: 'restroom-f', type: 'room', position: { x: 450, y: 450 }, floor: 1, name: 'Restroom F', tags: ['restroom'], data: { width: 25, height: 20 } },
  // Floor 2
  { id: 'room-201', type: 'room', position: { x: 150, y: 300 }, floor: 2, name: 'Library', tags: ['quiet', 'study', 'wifi'], data: { width: 120, height: 80 } },
  { id: 'room-202', type: 'room', position: { x: 350, y: 300 }, floor: 2, name: 'Meeting Room A', tags: ['meeting', 'projector'], data: { width: 50, height: 40 } },
  { id: 'room-203', type: 'room', position: { x: 450, y: 300 }, floor: 2, name: 'Meeting Room B', tags: ['meeting'], data: { width: 50, height: 40 } },
  { id: 'room-204', type: 'room', position: { x: 600, y: 350 }, floor: 2, name: 'Faculty Office', tags: ['office'], data: { width: 60, height: 40 } },
  { id: 'corridor-2f', type: 'corridor', position: { x: 400, y: 250 }, floor: 2, name: '2F Corridor', tags: ['covered'], data: { width: 200, height: 15 } },
]

const sampleEdges: Edge[] = [
  { id: 'e-entrance', from: 'entrance', to: 'corridor-main', bidirectional: true, distance: 150, constraints: {}, tags: [], data: {} },
  { id: 'e-main-west', from: 'corridor-main', to: 'corridor-west', bidirectional: true, distance: 200, constraints: {}, tags: [], data: {} },
  { id: 'e-main-east', from: 'corridor-main', to: 'corridor-east', bidirectional: true, distance: 200, constraints: {}, tags: [], data: {} },
  { id: 'e-west-101', from: 'corridor-west', to: 'room-101', bidirectional: true, distance: 50, constraints: {}, tags: [], data: {} },
  { id: 'e-west-102', from: 'corridor-west', to: 'room-102', bidirectional: true, distance: 70, constraints: {}, tags: [], data: {} },
  { id: 'e-west-103', from: 'corridor-main', to: 'room-103', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  { id: 'e-east-104', from: 'corridor-main', to: 'room-104', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  { id: 'e-east-105', from: 'corridor-east', to: 'room-105', bidirectional: true, distance: 50, constraints: { requires: ['keycard'] }, tags: [], data: {} },
  { id: 'e-east-106', from: 'corridor-east', to: 'room-106', bidirectional: true, distance: 70, constraints: { requires: ['keycard'] }, tags: [], data: {} },
  { id: 'e-stairs-1', from: 'corridor-main', to: 'stairs-1', bidirectional: true, distance: 120, constraints: {}, tags: [], data: {} },
  { id: 'e-stairs-2', from: 'corridor-main', to: 'stairs-2', bidirectional: true, distance: 120, constraints: {}, tags: [], data: {} },
  { id: 'e-elevator', from: 'corridor-main', to: 'elevator-1', bidirectional: true, distance: 100, constraints: {}, tags: [], data: {} },
  { id: 'e-restroom-m', from: 'corridor-west', to: 'restroom-m', bidirectional: true, distance: 100, constraints: { max: { width: 0.9 } }, tags: ['narrow'], data: {} },
  { id: 'e-restroom-f', from: 'corridor-east', to: 'restroom-f', bidirectional: true, distance: 100, constraints: { max: { width: 0.9 } }, tags: ['narrow'], data: {} },
]

function Sidebar() {
  const { userLocation, userConstraints, dispatch } = useMap()

  const setLocationToEntrance = () => {
    dispatch({
      type: 'SET_USER_LOCATION',
      payload: { nodeId: 'entrance', position: { x: 400, y: 100 }, floor: 1 },
    })
  }

  const toggleWheelchair = () => {
    dispatch({
      type: 'SET_USER_CONSTRAINTS',
      payload: userConstraints.requires?.includes('wheelchair')
        ? {}
        : { requires: ['wheelchair'] },
    })
  }

  const toggleKeycard = () => {
    const current = userConstraints.requires || []
    const hasKeycard = current.includes('keycard')
    dispatch({
      type: 'SET_USER_CONSTRAINTS',
      payload: {
        ...userConstraints,
        requires: hasKeycard
          ? current.filter(r => r !== 'keycard')
          : [...current, 'keycard'],
      },
    })
  }

  return (
    <div style={{ width: 280, background: '#fff', borderLeft: '1px solid #ddd', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>🔍 Search</h3>
        <SearchPanel />
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>📍 Navigation</h3>
        <RoutePanel />
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>⚙️ Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={setLocationToEntrance}
            style={{ padding: '8px 12px', textAlign: 'left' }}
          >
            {userLocation ? '📍 Update Location' : '📍 Set Location to Entrance'}
          </button>
          <button
            onClick={toggleWheelchair}
            style={{
              padding: '8px 12px',
              textAlign: 'left',
              background: userConstraints.requires?.includes('wheelchair') ? '#4a90d9' : '#f0f0f0',
              color: userConstraints.requires?.includes('wheelchair') ? '#fff' : '#333',
            }}
          >
            ♿ Wheelchair Mode
          </button>
          <button
            onClick={toggleKeycard}
            style={{
              padding: '8px 12px',
              textAlign: 'left',
              background: userConstraints.requires?.includes('keycard') ? '#4a90d9' : '#f0f0f0',
              color: userConstraints.requires?.includes('keycard') ? '#fff' : '#333',
            }}
          >
            🔑 Has Keycard
          </button>
        </div>
      </div>

      <div style={{ padding: 16, marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <ZoomControl />
        </div>
      </div>
    </div>
  )
}

function MapArea() {
  const { zoom, activeFloor } = useMap()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, background: '#f8f8f8', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 16 }}>
        <FloorSelector />
        <ViewModeToggle />
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 14 }}>
          Floor {activeFloor} | Zoom: {Math.round(zoom * 100)}%
        </span>
      </div>
      <div style={{ flex: 1, background: '#e8e8e8', overflow: 'hidden', position: 'relative' }}>
        <MapCanvas width={800} height={600} scale={zoom} />
        <UserMarker scale={zoom} />
      </div>
    </div>
  )
}

export function App() {
  const nodeMap = new Map(sampleNodes.map((n) => [n.id, n]))
  const edgeMap = new Map(sampleEdges.map((e) => [e.id, e]))

  return (
    <MapProvider initialState={{
      nodes: nodeMap,
      edges: edgeMap,
      activeFloor: 1,
      center: { x: 400, y: 300 },
      zoom: 1,
    }}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '12px 16px', background: '#2c3e50', color: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>ube-kosen-map</h1>
          <span style={{ opacity: 0.7, fontSize: 14 }}>Campus Navigation Demo</span>
        </header>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <MapArea />
          <Sidebar />
        </div>
      </div>
    </MapProvider>
  )
}
