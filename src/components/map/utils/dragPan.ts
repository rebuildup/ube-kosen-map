interface Coordinate {
  x: number;
  y: number;
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContentRect {
  width: number;
  height: number;
}

interface CalculatePanViewBoxParams {
  startClient: Coordinate;
  currentClient: Coordinate;
  startViewBox: ViewBox;
  contentRect: ContentRect;
}

export const calculatePanViewBox = ({
  startClient,
  currentClient,
  startViewBox,
  contentRect,
}: CalculatePanViewBoxParams): ViewBox => {
  const deltaX = currentClient.x - startClient.x;
  const deltaY = currentClient.y - startClient.y;

  const scaleX = startViewBox.width / contentRect.width;
  const scaleY = startViewBox.height / contentRect.height;

  return {
    height: startViewBox.height,
    width: startViewBox.width,
    x: startViewBox.x - deltaX * scaleX,
    y: startViewBox.y - deltaY * scaleY,
  };
};
