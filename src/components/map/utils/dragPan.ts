import type { Coordinate, ViewBox } from "../../../types/map";
import type { MapBoundsSize } from "./coordinateTransform";

interface CalculatePanViewBoxParams {
  startClient: Coordinate;
  currentClient: Coordinate;
  startViewBox: ViewBox;
  /** Painted content size of the SVG element (letterbox aware). */
  contentSize: MapBoundsSize;
}

export const calculatePanViewBox = ({
  startClient,
  currentClient,
  startViewBox,
  contentSize,
}: CalculatePanViewBoxParams): ViewBox => {
  const deltaX = currentClient.x - startClient.x;
  const deltaY = currentClient.y - startClient.y;

  const scaleX = startViewBox.width / contentSize.width;
  const scaleY = startViewBox.height / contentSize.height;

  return {
    height: startViewBox.height,
    width: startViewBox.width,
    x: startViewBox.x - deltaX * scaleX,
    y: startViewBox.y - deltaY * scaleY,
  };
};
