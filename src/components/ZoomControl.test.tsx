import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ZoomControl } from './ZoomControl'
import { MapProvider } from '../context/MapContext'

describe('ZoomControl', () => {
  it('should render zoom buttons', () => {
    render(
      <MapProvider>
        <ZoomControl />
      </MapProvider>
    )

    expect(screen.getByTestId('zoom-in')).toBeInTheDocument()
    expect(screen.getByTestId('zoom-out')).toBeInTheDocument()
    expect(screen.getByTestId('zoom-reset')).toBeInTheDocument()
  })

  it('should show current zoom level', () => {
    render(
      <MapProvider initialState={{ zoom: 2 }}>
        <ZoomControl />
      </MapProvider>
    )

    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('200%')
  })

  it('should zoom in when + is clicked', () => {
    render(
      <MapProvider>
        <ZoomControl />
      </MapProvider>
    )

    fireEvent.click(screen.getByTestId('zoom-in'))
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('150%')
  })

  it('should zoom out when - is clicked', () => {
    render(
      <MapProvider initialState={{ zoom: 2 }}>
        <ZoomControl />
      </MapProvider>
    )

    fireEvent.click(screen.getByTestId('zoom-out'))
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('150%')
  })

  it('should disable zoom in at max zoom', () => {
    render(
      <MapProvider initialState={{ zoom: 4 }}>
        <ZoomControl maxZoom={4} />
      </MapProvider>
    )

    expect(screen.getByTestId('zoom-in')).toBeDisabled()
  })

  it('should disable zoom out at min zoom', () => {
    render(
      <MapProvider initialState={{ zoom: 0.5 }}>
        <ZoomControl minZoom={0.5} />
      </MapProvider>
    )

    expect(screen.getByTestId('zoom-out')).toBeDisabled()
  })
})
