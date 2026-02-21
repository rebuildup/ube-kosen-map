import { useMap } from '../context/MapContext'

interface ZoomControlProps {
  minZoom?: number
  maxZoom?: number
  step?: number
}

export function ZoomControl({ minZoom = 0.5, maxZoom = 4, step = 0.5 }: ZoomControlProps) {
  const { zoom, dispatch } = useMap()

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + step, maxZoom)
    dispatch({ type: 'SET_ZOOM', payload: newZoom })
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - step, minZoom)
    dispatch({ type: 'SET_ZOOM', payload: newZoom })
  }

  const handleReset = () => {
    dispatch({ type: 'SET_ZOOM', payload: 1 })
  }

  return (
    <div className="zoom-control" data-testid="zoom-control">
      <button
        onClick={handleZoomIn}
        disabled={zoom >= maxZoom}
        aria-label="Zoom in"
        data-testid="zoom-in"
      >
        +
      </button>
      <button
        onClick={handleReset}
        aria-label="Reset zoom"
        data-testid="zoom-reset"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={handleZoomOut}
        disabled={zoom <= minZoom}
        aria-label="Zoom out"
        data-testid="zoom-out"
      >
        −
      </button>
    </div>
  )
}
