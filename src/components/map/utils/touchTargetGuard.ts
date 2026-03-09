export const shouldIgnoreTouchTarget = ({
  isDragging,
  isGesture,
  isOnCardOverlay,
  isOnUiControl,
}: {
  isDragging: boolean;
  isGesture: boolean;
  isOnUiControl: boolean;
  isOnCardOverlay: boolean;
}): boolean => {
  // During active drag/gesture, keep processing events even if target moves over overlays.
  if (isDragging || isGesture) {
    return false;
  }
  return isOnUiControl || isOnCardOverlay;
};
