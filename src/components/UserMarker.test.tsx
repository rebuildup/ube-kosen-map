import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UserMarker } from './UserMarker'
import { MapProvider } from '../context/MapContext'

describe('UserMarker', () => {
  it('should not render when userLocation is null', () => {
    const { container } = render(
      <MapProvider>
        <svg>
          <UserMarker />
        </svg>
      </MapProvider>
    )

    expect(container.querySelector('[data-testid="user-marker"]')).not.toBeInTheDocument()
  })

  it('should render when userLocation is set', () => {
    const userLocation = {
      nodeId: 'n1',
      position: { x: 100, y: 200 },
      floor: 1,
    }

    const { container } = render(
      <MapProvider initialState={{ userLocation } as any}>
        <svg>
          <UserMarker />
        </svg>
      </MapProvider>
    )

    expect(container.querySelector('[data-testid="user-marker"]')).toBeInTheDocument()
  })
})
