import { useMap } from '../context/MapContext'

export function ViewModeToggle() {
  const { viewMode, dispatch } = useMap()

  const toggleViewMode = () => {
    dispatch({
      type: 'SET_VIEW_MODE',
      payload: viewMode === 'top_down' ? 'section' : 'top_down',
    })
  }

  return (
    <button
      className="view-mode-toggle"
      onClick={toggleViewMode}
      data-testid="view-mode-toggle"
      aria-label={`Switch to ${viewMode === 'top_down' ? 'section' : 'top-down'} view`}
    >
      {viewMode === 'top_down' ? '📐 Section' : '🗺️ Top-down'}
    </button>
  )
}
