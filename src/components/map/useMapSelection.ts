import {
  useCallback,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import type {
  Coordinate,
  InteractivePoint,
  PointCluster,
  ViewBox,
} from "../../types/map";
import {
  BUILDING_FLOOR_CONFIGS,
  type BuildingFloorConfig,
} from "../../data/floorConfig";
import { computeCardPosition, type CardPlacement } from "./utils/cardPlacement";
import { toMeasuredRect } from "./utils/coordinateTransform";

interface UseMapSelectionOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: ViewBox;
  onPointClick?: (pointId: string) => void;
  onPointHover?: (pointId: string | null) => void;
  /** viewBox-space coordinate of a client point (component-owned transform). */
  clientToViewBox: (clientX: number, clientY: number) => Coordinate;
  /** map-space -> rotated viewBox coordinate (component-owned transform). */
  transformPinCoordinate: (x: number, y: number) => Coordinate;
  setActiveBuilding: Dispatch<SetStateAction<BuildingFloorConfig | null>>;
  setManualBuildingId: Dispatch<SetStateAction<string | null>>;
  setSelectedFloorId: Dispatch<SetStateAction<string | null>>;
}

/**
 * Point/cluster selection and card-overlay state.
 *
 * Owns which pin is hovered, which area is focused, which cluster card is
 * open, and where that card is placed. Building/floor changes triggered by
 * point taps are delegated to the floor-selection setters.
 */
export const useMapSelection = ({
  containerRef,
  onPointClick,
  onPointHover,
  clientToViewBox,
  setActiveBuilding,
  setManualBuildingId,
  setSelectedFloorId,
  svgRef,
  transformPinCoordinate,
  viewBox,
}: UseMapSelectionOptions) => {
  const [activePinPoint, setActivePinPoint] = useState<InteractivePoint | null>(
    null,
  );
  const [selectedCluster, setSelectedCluster] = useState<
    InteractivePoint[] | null
  >(null);
  const [cardPosition, setCardPosition] = useState<CardPlacement>({
    placement: "bottom",
    x: 0,
    y: 0,
  });
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const placeCard = useCallback(
    (
      pointCoordinates: Coordinate,
      screenEvent?: { clientX: number; clientY: number },
      isCluster = false,
    ): CardPlacement => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return { placement: "bottom", x: 0, y: 0 };
      return computeCardPosition({
        anchor: pointCoordinates,
        containerRect: toMeasuredRect(containerRect),
        isCluster,
        screenEvent,
        svgRect: svgRef.current
          ? toMeasuredRect(svgRef.current.getBoundingClientRect())
          : null,
        viewBox,
      });
    },
    [containerRef, svgRef, viewBox],
  );

  const closeCard = useCallback(() => {
    setSelectedCluster(null);
  }, []);

  const handlePointClick = useCallback(
    (point: InteractivePoint) => {
      const canFocusArea =
        Boolean(point.anchorArea) && point.isAreaFocusable !== false;
      setActivePinPoint(canFocusArea ? point : null);
      if (canFocusArea && point.buildingId) {
        const targetBuilding =
          BUILDING_FLOOR_CONFIGS.find((b) => b.id === point.buildingId) ?? null;
        setManualBuildingId(point.buildingId);
        setActiveBuilding(targetBuilding);
        if (targetBuilding && targetBuilding.floors.length > 0) {
          setSelectedFloorId(point.floorId ?? targetBuilding.defaultFloor);
        }
      }
      point.onClick?.();
      onPointClick?.(point.id);
    },
    [onPointClick, setActiveBuilding, setManualBuildingId, setSelectedFloorId],
  );

  const handleClusterClick = useCallback(
    (
      cluster: PointCluster,
      screenEvent?: { clientX: number; clientY: number },
    ) => {
      setActivePinPoint(null);
      setSelectedCluster(cluster.points);
      setCardPosition(placeCard(cluster.coordinates, screenEvent, true));
    },
    [placeCard],
  );

  const handlePointHover = useCallback(
    (point: InteractivePoint | null) => {
      const newHoveredId = point?.id || null;
      setHoveredPoint(newHoveredId);
      onPointHover?.(newHoveredId);
      point?.onHover?.(!!point);
    },
    [onPointHover],
  );

  /** Ray-cast hit test: is the client point inside the focused anchor area? */
  const isClientPointInFocusedArea = useCallback(
    (clientX: number, clientY: number) => {
      if (!activePinPoint?.anchorArea) return false;
      const clickedViewBox = clientToViewBox(clientX, clientY);
      const { anchorArea } = activePinPoint;
      const polygon = [
        transformPinCoordinate(anchorArea.x, anchorArea.y),
        transformPinCoordinate(anchorArea.x + anchorArea.width, anchorArea.y),
        transformPinCoordinate(
          anchorArea.x + anchorArea.width,
          anchorArea.y + anchorArea.height,
        ),
        transformPinCoordinate(anchorArea.x, anchorArea.y + anchorArea.height),
      ];

      let isInside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersects =
          yi > clickedViewBox.y !== yj > clickedViewBox.y &&
          clickedViewBox.x <
            ((xj - xi) * (clickedViewBox.y - yi)) / (yj - yi) + xi;
        if (intersects) {
          isInside = !isInside;
        }
      }
      return isInside;
    },
    [activePinPoint, clientToViewBox, transformPinCoordinate],
  );

  return {
    activePinPoint,
    cardPosition,
    closeCard,
    handleClusterClick,
    handlePointClick,
    handlePointHover,
    hoveredPoint,
    isClientPointInFocusedArea,
    selectedCluster,
    setActivePinPoint,
    setSelectedCluster,
  };
};
