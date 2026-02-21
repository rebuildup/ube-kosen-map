import type { Node, Edge } from '../types'

interface EdgeRendererProps {
  edge: Edge
  nodes: Map<string, Node>
  scale: number
  isOnRoute?: boolean
  onClick?: (edge: Edge) => void
}

export function EdgeRenderer({ edge, nodes, scale, isOnRoute, onClick }: EdgeRendererProps) {
  const fromNode = nodes.get(edge.from)
  const toNode = nodes.get(edge.to)

  if (!fromNode || !toNode) return null

  const x1 = fromNode.position.x * scale
  const y1 = fromNode.position.y * scale
  const x2 = toNode.position.x * scale
  const y2 = toNode.position.y * scale

  const stroke = isOnRoute ? '#ff6600' : '#aaa'
  const strokeWidth = isOnRoute ? 4 : 2

  const handleClick = () => {
    onClick?.(edge)
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      onClick={handleClick}
      data-testid={`edge-${edge.id}`}
    />
  )
}
