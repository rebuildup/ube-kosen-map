import { useMap } from '../context/MapContext'
import { NodeRenderer } from './NodeRenderer'
import { EdgeRenderer } from './EdgeRenderer'

interface MapCanvasProps {
  width: number
  height: number
  scale?: number
  onNodeClick?: (nodeId: string) => void
}

export function MapCanvas({ width, height, scale = 1, onNodeClick }: MapCanvasProps) {
  const { nodes, edges, activeFloor, route, center } = useMap()

  const routeEdgeSet = new Set(route?.edges ?? [])

  // Filter nodes/edges by active floor
  const floorNodes = [...nodes.values()].filter(n => n.floor === activeFloor)
  const floorEdges = [...edges.values()].filter(e => {
    const fromNode = nodes.get(e.from)
    const toNode = nodes.get(e.to)
    return fromNode?.floor === activeFloor && toNode?.floor === activeFloor
  })

  // Calculate viewBox for panning
  const viewBoxX = center.x - width / (2 * scale)
  const viewBoxY = center.y - height / (2 * scale)
  const viewBoxWidth = width / scale
  const viewBoxHeight = height / scale

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label="Campus map"
    >
      {/* Render edges first (below nodes) */}
      {floorEdges.map(edge => (
        <EdgeRenderer
          key={edge.id}
          edge={edge}
          nodes={nodes}
          scale={1}
          isOnRoute={routeEdgeSet.has(edge.id)}
        />
      ))}

      {/* Render nodes on top */}
      {floorNodes.map(node => (
        <NodeRenderer
          key={node.id}
          node={node}
          scale={1}
          isSelected={route?.nodeIds.includes(node.id) ?? false}
          onClick={(n) => onNodeClick?.(n.id)}
        />
      ))}
    </svg>
  )
}
