type MapMode = "display" | "detail" | "interactive";

export const shouldEmitTouchMapClick = (
  _mode: MapMode,
  onMapClick: ((coordinate: { x: number; y: number }) => void) | undefined,
): boolean => {
  return typeof onMapClick === "function";
};
