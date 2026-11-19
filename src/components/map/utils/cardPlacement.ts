import type { Coordinate } from "../../../types/map";
import type { MeasuredRect } from "./coordinateTransform";

/**
 * Pure card placement: picks the least-bad side of an anchor point for the
 * detail card overlay. Priority is dynamic — points on the left prefer
 * right-side placement and vice versa, top/bottom similarly — then falls
 * back to the side with the most free space.
 */

export interface CardPlacement {
  placement: "bottom" | "left" | "right" | "top";
  transform?: string;
  x: number;
  y: number;
}

interface PlacementCandidate {
  finalX: number;
  finalY: number;
  name: CardPlacement["placement"];
  priority: number;
  spaceAvailable: number;
  transform: string;
  viable: boolean;
  x: number;
  y: number;
}

export const computeCardPosition = ({
  anchor,
  containerRect,
  isCluster = false,
  screenEvent,
  svgRect,
  viewBox,
}: {
  anchor: Coordinate;
  containerRect: MeasuredRect;
  isCluster?: boolean;
  screenEvent?: { clientX: number; clientY: number };
  svgRect?: MeasuredRect | null;
  viewBox: { height: number; width: number; x: number; y: number };
}): CardPlacement => {
  const cardWidth = isCluster ? 400 : 300;
  const cardHeight = isCluster ? 300 : 200;
  const margin = 20;

  let baseX: number;
  let baseY: number;

  if (screenEvent) {
    baseX = screenEvent.clientX - containerRect.left;
    baseY = screenEvent.clientY - containerRect.top;
  } else if (svgRect) {
    baseX = ((anchor.x - viewBox.x) / viewBox.width) * svgRect.width;
    baseY = ((anchor.y - viewBox.y) / viewBox.height) * svgRect.height;
  } else {
    baseX = containerRect.width / 2;
    baseY = containerRect.height / 2;
  }

  const leftThird = containerRect.width / 3;
  const rightThird = (containerRect.width * 2) / 3;
  const topThird = containerRect.height / 3;
  const bottomThird = (containerRect.height * 2) / 3;

  let priorities = { bottom: 1, left: 4, right: 3, top: 2 };
  if (baseX < leftThird) {
    priorities = { bottom: 2, left: 4, right: 1, top: 3 };
  } else if (baseX > rightThird) {
    priorities = { bottom: 2, left: 1, right: 4, top: 3 };
  }
  if (baseY < topThird) {
    priorities = { bottom: 1, left: 3, right: 2, top: 4 };
  } else if (baseY > bottomThird) {
    priorities = { bottom: 4, left: 3, right: 2, top: 1 };
  }

  const placements: PlacementCandidate[] = [
    {
      finalX: baseX,
      finalY: baseY + 50,
      name: "bottom",
      priority: priorities.bottom,
      spaceAvailable: containerRect.height - (baseY + 50 + cardHeight + margin),
      transform: "translate(-50%, 0%)",
      viable: baseY + 50 + cardHeight + margin < containerRect.height,
      x: baseX,
      y: baseY + 50,
    },
    {
      finalX: baseX,
      finalY: baseY - 50,
      name: "top",
      priority: priorities.top,
      spaceAvailable: baseY - 50 - cardHeight - margin,
      transform: "translate(-50%, -100%)",
      viable: baseY - 50 - cardHeight - margin > 0,
      x: baseX,
      y: baseY - 50,
    },
    {
      finalX: baseX + 50,
      finalY: baseY,
      name: "right",
      priority: priorities.right,
      spaceAvailable: containerRect.width - (baseX + 50 + cardWidth + margin),
      transform: "translate(0%, -50%)",
      viable: baseX + 50 + cardWidth + margin < containerRect.width,
      x: baseX + 50,
      y: baseY,
    },
    {
      finalX: baseX - 50,
      finalY: baseY,
      name: "left",
      priority: priorities.left,
      spaceAvailable: baseX - 50 - cardWidth - margin,
      transform: "translate(-100%, -50%)",
      viable: baseX - 50 - cardWidth - margin > 0,
      x: baseX - 50,
      y: baseY,
    },
  ];

  const viablePlacements = placements.filter((p) => p.viable);
  const selectedPlacement =
    viablePlacements.length > 0
      ? [...viablePlacements].sort((a, b) => {
          const aHasSpace = a.spaceAvailable > 50;
          const bHasSpace = b.spaceAvailable > 50;
          if (aHasSpace && !bHasSpace) return -1;
          if (!aHasSpace && bHasSpace) return 1;
          if (aHasSpace && bHasSpace) return a.priority - b.priority;
          return b.spaceAvailable - a.spaceAvailable;
        })[0]
      : [...placements].sort((a, b) => b.spaceAvailable - a.spaceAvailable)[0];

  let finalX = selectedPlacement.finalX;
  let finalY = selectedPlacement.finalY;
  if (!selectedPlacement.viable) {
    finalX = containerRect.width / 2;
    finalY = containerRect.height / 2;
  }

  return {
    placement: selectedPlacement.name,
    transform: selectedPlacement.transform,
    x: finalX,
    y: finalY,
  };
};
