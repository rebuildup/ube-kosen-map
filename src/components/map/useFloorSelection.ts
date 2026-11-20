import { useCallback, useEffect, useState } from "react";

import {
  BUILDING_FLOOR_CONFIGS,
  type BuildingFloorConfig,
} from "../../data/floorConfig";
import {
  resolveDetectedFloorId,
  resolveFocusedFloorId,
} from "./utils/floorSelection";

const BUILDING_BY_ID = new Map(
  BUILDING_FLOOR_CONFIGS.map((building) => [building.id, building]),
);

const GROUP_ID_TO_BUILDING_ID = new Map<string, string>();
for (const building of BUILDING_FLOOR_CONFIGS) {
  if (building.svgGroupId) {
    GROUP_ID_TO_BUILDING_ID.set(building.svgGroupId, building.id);
  }
  for (const floor of building.floors) {
    GROUP_ID_TO_BUILDING_ID.set(floor.svgGroupId, building.id);
  }
}

/** Group ids whose room-divider lines are hidden unless showRoomLines. */
export const ROOM_LINE_GROUP_IDS: readonly string[] = [
  ...new Set(
    BUILDING_FLOOR_CONFIGS.flatMap((building) => [
      ...(building.svgGroupId ? [building.svgGroupId] : []),
      ...building.floors.map((floor) => floor.svgGroupId),
    ]),
  ),
];

/** Walk up the DOM from an event target to the building that owns it. */
const resolveBuildingFromElement = (
  element: Element | null,
): BuildingFloorConfig | null => {
  let current: Element | null = element;
  while (current) {
    const groupId = current.getAttribute("id");
    if (groupId) {
      const buildingId = GROUP_ID_TO_BUILDING_ID.get(groupId);
      if (buildingId) {
        return BUILDING_BY_ID.get(buildingId) ?? null;
      }
    }
    current = current.parentElement;
  }
  return null;
};

/** Building under the viewport center, via DOM hit testing. */
const detectCenterBuilding = (
  svg: SVGSVGElement | null,
): BuildingFloorConfig | null => {
  if (!svg || typeof document === "undefined") return null;

  const svgRect = svg.getBoundingClientRect();
  const centerX = svgRect.left + svgRect.width / 2;
  const centerY = svgRect.top + svgRect.height / 2;
  const centerElements = document.elementsFromPoint(centerX, centerY);

  for (const element of centerElements) {
    const found = resolveBuildingFromElement(element);
    if (found) return found;
  }
  return null;
};

interface UseFloorSelectionOptions {
  /** Re-run center detection when the view changes. */
  viewBox: { height: number; width: number; x: number; y: number };
  /** False until the inline SVG content has loaded. */
  contentLoaded: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

/**
 * Building/floor selection state machine.
 *
 * `manualBuildingId` is the explicit user choice (tap/click/FloorSelector);
 * when absent, the building under the viewport center is auto-detected.
 * Detection reads the DOM, so it runs inside a scheduled frame rather than
 * synchronously during render or effect body.
 */
export const useFloorSelection = ({
  contentLoaded,
  svgRef,
  viewBox,
}: UseFloorSelectionOptions) => {
  const [activeBuilding, setActiveBuilding] =
    useState<BuildingFloorConfig | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [manualBuildingId, setManualBuildingId] = useState<string | null>(null);

  const focusBuilding = useCallback((building: BuildingFloorConfig | null) => {
    if (!building) {
      setManualBuildingId(null);
      return;
    }
    setManualBuildingId(building.id);
    setActiveBuilding(building);
    setSelectedFloorId((prev) => resolveFocusedFloorId(building, prev));
  }, []);

  useEffect(() => {
    if (!contentLoaded) return;
    const frame = requestAnimationFrame(() => {
      const manualBuilding = manualBuildingId
        ? (BUILDING_BY_ID.get(manualBuildingId) ?? null)
        : null;
      const found = manualBuilding ?? detectCenterBuilding(svgRef.current);

      setActiveBuilding(found);
      if (found?.id !== activeBuilding?.id) {
        setSelectedFloorId(resolveDetectedFloorId(found));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [viewBox, manualBuildingId, contentLoaded, svgRef, activeBuilding]);

  return {
    activeBuilding,
    focusBuilding,
    resolveBuildingFromElement,
    selectedFloorId,
    setActiveBuilding,
    setManualBuildingId,
    setSelectedFloorId,
  };
};
