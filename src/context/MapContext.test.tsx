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
