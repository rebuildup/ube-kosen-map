import type { Node } from '../types'

interface NodeRendererProps {
  node: Node
  scale: number
  isSelected?: boolean
  onClick?: (node: Node) => void
}

export function NodeRenderer({ node, scale, isSelected, onClick }: NodeRendererProps) {
  const x = node.position.x * scale
  const y = node.position.y * scale
  const width = (node.data.width as number ?? 20) * scale
  const height = (node.data.height as number ?? 20) * scale

  const fillColor = getFillColor(node.type)
  const strokeColor = isSelected ? '#ff6600' : '#333'
  const strokeWidth = isSelected ? 3 : 1

  const handleClick = () => {
    onClick?.(node)
  }

  if (node.type === 'stairs' || node.type === 'elevator') {
    return (
      <circle
        cx={x}
        cy={y}
        r={width / 2}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        onClick={handleClick}
        data-testid={`node-${node.id}`}
      />
    )
  }

  return (
    <rect
      x={x - width / 2}
      y={y - height / 2}
      width={width}
      height={height}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      onClick={handleClick}
      data-testid={`node-${node.id}`}
    />
  )
}

function getFillColor(type: string): string {
  const colors: Record<string, string> = {
    room: '#4a90d9',
    corridor: '#8bc34a',
    stairs: '#ff9800',
    elevator: '#9c27b0',
    entrance: '#f44336',
    office: '#2196f3',
  }
  return colors[type] ?? '#888'
}
