import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewModeToggle } from './ViewModeToggle'
import { MapProvider } from '../context/MapContext'

describe('ViewModeToggle', () => {
  it('should render toggle button', () => {
    render(
      <MapProvider>
        <ViewModeToggle />
      </MapProvider>
    )

    expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument()
  })

  it('should show top-down by default', () => {
    render(
      <MapProvider>
        <ViewModeToggle />
      </MapProvider>
    )

    expect(screen.getByTestId('view-mode-toggle')).toHaveTextContent('Section')
  })

  it('should toggle to section view when clicked', () => {
    render(
      <MapProvider>
        <ViewModeToggle />
      </MapProvider>
    )

    fireEvent.click(screen.getByTestId('view-mode-toggle'))
    expect(screen.getByTestId('view-mode-toggle')).toHaveTextContent('Top-down')
  })
})
