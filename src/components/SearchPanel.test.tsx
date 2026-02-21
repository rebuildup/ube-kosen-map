import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchPanel } from './SearchPanel'
import { MapProvider } from '../context/MapContext'
import type { Node } from '../types'

const testNodes: Node[] = [
  { id: 'n1', type: 'room', position: { x: 0, y: 0 }, floor: 1, name: 'Lecture Hall', tags: [], data: {} },
  { id: 'n2', type: 'room', position: { x: 100, y: 0 }, floor: 1, name: 'Lab Room', tags: [], data: {} },
  { id: 'n3', type: 'room', position: { x: 0, y: 100 }, floor: 2, name: 'Office', tags: [], data: {} },
]

describe('SearchPanel', () => {
  it('should render search input', () => {
    render(
      <MapProvider>
        <SearchPanel />
      </MapProvider>
    )

    expect(screen.getByTestId('search-input')).toBeInTheDocument()
    expect(screen.getByTestId('search-button')).toBeInTheDocument()
  })

  it('should show results when searching', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, activeFloor: 1 }}>
        <SearchPanel />
      </MapProvider>
    )

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Lecture' } })
    fireEvent.click(screen.getByTestId('search-button'))

    expect(screen.getByTestId('search-results')).toBeInTheDocument()
    expect(screen.getByTestId('search-result-n1')).toBeInTheDocument()
  })

  it('should show no results message when nothing found', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, activeFloor: 1 }}>
        <SearchPanel />
      </MapProvider>
    )

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'xyz' } })
    fireEvent.click(screen.getByTestId('search-button'))

    expect(screen.getByTestId('search-no-results')).toBeInTheDocument()
  })

  it('should call onSelect when result is clicked', () => {
    const onSelect = vi.fn()
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, activeFloor: 1 }}>
        <SearchPanel onSelect={onSelect} />
      </MapProvider>
    )

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Lab' } })
    fireEvent.click(screen.getByTestId('search-button'))
    fireEvent.click(screen.getByTestId('search-result-n2'))

    expect(onSelect).toHaveBeenCalledWith('n2')
  })

  it('should search on Enter key', () => {
    const nodeMap = new Map(testNodes.map(n => [n.id, n]))
    render(
      <MapProvider initialState={{ nodes: nodeMap, activeFloor: 1 }}>
        <SearchPanel />
      </MapProvider>
    )

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Lecture' } })
    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Enter' })

    expect(screen.getByTestId('search-results')).toBeInTheDocument()
  })
})
