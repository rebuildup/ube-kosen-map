import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FloorSelector } from './FloorSelector'
import { MapProvider } from '../context/MapContext'

describe('FloorSelector', () => {
  it('should render default floors when no buildings', () => {
    render(
      <MapProvider>
        <FloorSelector />
      </MapProvider>
    )

    expect(screen.getByTestId('floor-1')).toBeInTheDocument()
    expect(screen.getByTestId('floor-2')).toBeInTheDocument()
    expect(screen.getByTestId('floor-3')).toBeInTheDocument()
  })

  it('should highlight active floor', () => {
    render(
      <MapProvider initialState={{ activeFloor: 2 }}>
        <FloorSelector />
      </MapProvider>
    )

    expect(screen.getByTestId('floor-2')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('floor-1')).toHaveAttribute('data-active', 'false')
  })

  it('should call onChange when floor is clicked', () => {
    const onChange = vi.fn()
    render(
      <MapProvider>
        <FloorSelector onChange={onChange} />
      </MapProvider>
    )

    fireEvent.click(screen.getByTestId('floor-2'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('should render custom floors', () => {
    render(
      <MapProvider>
        <FloorSelector floors={[-1, 1, 2]} />
      </MapProvider>
    )

    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.getByText('1F')).toBeInTheDocument()
    expect(screen.getByText('2F')).toBeInTheDocument()
  })
})
