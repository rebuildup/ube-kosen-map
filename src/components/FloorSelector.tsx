import { useMap } from '../context/MapContext'

interface FloorSelectorProps {
  floors?: number[]
  onChange?: (floor: number) => void
}

export function FloorSelector({ floors, onChange }: FloorSelectorProps) {
  const { buildings, activeFloor, dispatch } = useMap()

  // Get all unique floors from buildings or use provided floors
  const availableFloors = floors ?? (() => {
    const floorSet = new Set<number>()
    buildings.forEach(b => b.floors.forEach(f => floorSet.add(f)))
    return [...floorSet].sort((a, b) => a - b)
  })()

  const handleFloorChange = (floor: number) => {
    dispatch({ type: 'SET_ACTIVE_FLOOR', payload: floor })
    onChange?.(floor)
  }

  if (availableFloors.length === 0) {
    // Default floors if no buildings
    return (
      <div className="floor-selector" data-testid="floor-selector">
        {[1, 2, 3].map(floor => (
          <button
            key={floor}
            onClick={() => handleFloorChange(floor)}
            data-active={activeFloor === floor}
            data-testid={`floor-${floor}`}
          >
            {floor === 0 ? 'B1' : `${floor}F`}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="floor-selector" data-testid="floor-selector">
      {availableFloors.map(floor => (
        <button
          key={floor}
          onClick={() => handleFloorChange(floor)}
          data-active={activeFloor === floor}
          data-testid={`floor-${floor}`}
        >
          {floor <= 0 ? `B${Math.abs(floor)}` : `${floor}F`}
        </button>
      ))}
    </div>
  )
}
