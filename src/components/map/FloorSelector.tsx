import React from "react";
import { BuildingFloorConfig } from "../../data/floorConfig";

interface FloorSelectorProps {
  building: BuildingFloorConfig;
  selectedFloorId: string;
  onSelectFloor: (floorId: string) => void;
}

const FloorSelector: React.FC<FloorSelectorProps> = ({
  building,
  selectedFloorId,
  onSelectFloor,
}) => {
  if (building.floors.length <= 1) return null;
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
      {[...building.floors].reverse().map((floor) => {
        const isSelected = floor.id === selectedFloorId;
        return (
          <button
            key={floor.id}
            onClick={() => onSelectFloor(floor.id)}
            className={`w-12 h-12 rounded-full shadow-md text-sm font-bold transition-all ${
              isSelected
                ? "bg-blue-500 text-white scale-110 shadow-lg"
                : "bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600"
            }`}
            title={`${building.name} ${floor.label}`}
          >
            {floor.label}
          </button>
        );
      })}
    </div>
  );
};

export default FloorSelector;
