import type { BuildingFloorConfig } from "../../../data/floorConfig";

/**
 * Floor id to select when the user explicitly focuses a building: keep the
 * previous floor when the building still has it, otherwise fall back to the
 * building default. Buildings without floors resolve to null.
 */
export const resolveFocusedFloorId = (
  building: BuildingFloorConfig | null,
  prevFloorId: string | null,
): string | null => {
  if (!building || building.floors.length === 0) return null;
  const keepsPrev =
    prevFloorId !== null &&
    building.floors.some((floor) => floor.id === prevFloorId);
  return keepsPrev ? prevFloorId : building.defaultFloor;
};

/**
 * Floor id selected by center detection: always the building default, since
 * auto-detection has no user-chosen floor to preserve.
 */
export const resolveDetectedFloorId = (
  building: BuildingFloorConfig | null,
): string | null => {
  if (!building || building.floors.length === 0) return null;
  return building.defaultFloor;
};
