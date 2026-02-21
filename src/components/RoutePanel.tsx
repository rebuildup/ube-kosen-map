import { useMap, findRoute } from '..'
import { useMemo } from 'react'

interface RoutePanelProps {
  onStart?: () => void
  onClear?: () => void
}

export function RoutePanel({ onStart, onClear }: RoutePanelProps) {
  const { nodes, edges, destination, route, userLocation, userConstraints, dispatch } = useMap()

  const turnInstructions = useMemo(() => {
    if (!route || route.nodeIds.length < 2) return []

    const instructions: Array<{
      step: number
      from: string
      to: string
      edge: string
      distance: number
    }> = []

    for (let i = 0; i < route.nodeIds.length - 1; i++) {
      const fromNode = nodes.get(route.nodeIds[i])
      const toNode = nodes.get(route.nodeIds[i + 1])
      const edge = edges.get(route.edges[i])

      if (fromNode && toNode && edge) {
        instructions.push({
          step: i + 1,
          from: fromNode.name || fromNode.id,
          to: toNode.name || toNode.id,
          edge: edge.id,
          distance: edge.distance,
        })
      }
    }

    return instructions
  }, [route, nodes, edges])

  const handleClear = () => {
    dispatch({ type: 'SET_ROUTE', payload: null })
    dispatch({ type: 'SET_DESTINATION', payload: null })
    onClear?.()
  }

  const handleRecalculate = () => {
    if (!userLocation || !destination) return

    const newRoute = findRoute(nodes, edges, {
      from: userLocation.nodeId,
      to: destination,
      constraints: userConstraints,
    })

    if (newRoute) {
      dispatch({ type: 'SET_ROUTE', payload: newRoute })
      onStart?.()
    }
  }

  if (!destination) {
    return null
  }

  const destinationNode = nodes.get(destination)

  return (
    <div className="route-panel" data-testid="route-panel">
      <div className="route-header">
        <h3>Route to: {destinationNode?.name || destination}</h3>
        <button onClick={handleClear} data-testid="route-clear">
          ✕
        </button>
      </div>

      {route ? (
        <>
          <div className="route-summary" data-testid="route-summary">
            <span>📏 {route.distance}m</span>
            <span>📍 {route.nodeIds.length} stops</span>
          </div>

          {turnInstructions.length > 0 && (
            <ol className="route-instructions" data-testid="route-instructions">
              {turnInstructions.map((inst) => (
                <li key={inst.step} data-testid={`route-step-${inst.step}`}>
                  <span className="step-from">{inst.from}</span>
                  <span className="step-arrow">→</span>
                  <span className="step-to">{inst.to}</span>
                  <span className="step-distance">({inst.distance}m)</span>
                </li>
              ))}
            </ol>
          )}

          {userLocation && (
            <button onClick={handleRecalculate} data-testid="route-recalculate">
              🔄 Recalculate from current location
            </button>
          )}
        </>
      ) : (
        <div className="route-no-path" data-testid="route-no-path">
          No route available
        </div>
      )}
    </div>
  )
}
