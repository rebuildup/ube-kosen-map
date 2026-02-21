import { useMap } from '../context/MapContext'

interface UserMarkerProps {
  scale?: number
}

export function UserMarker({ scale = 1 }: UserMarkerProps) {
  const { userLocation } = useMap()

  if (!userLocation) return null

  const x = userLocation.position.x * scale
  const y = userLocation.position.y * scale
  const radius = 8

  return (
    <g data-testid="user-marker">
      {/* Outer pulse ring */}
      <circle
        cx={x}
        cy={y}
        r={radius * 2}
        fill="rgba(66, 133, 244, 0.2)"
        className="user-marker-pulse"
      />
      {/* Main marker */}
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="#4285F4"
        stroke="#fff"
        strokeWidth={3}
      />
      {/* Direction indicator (optional) */}
      <circle
        cx={x}
        cy={y}
        r={radius * 0.4}
        fill="#fff"
      />
    </g>
  )
}
