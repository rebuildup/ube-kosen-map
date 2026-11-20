export const addTouchPointer = (
  pointerIds: number[],
  pointerId: number,
): number[] => {
  if (pointerIds.includes(pointerId)) {
    return pointerIds;
  }
  if (pointerIds.length >= 2) {
    return pointerIds;
  }
  return [...pointerIds, pointerId];
};

export const removeTouchPointer = (
  pointerIds: number[],
  pointerId: number,
): number[] => {
  if (!pointerIds.includes(pointerId)) {
    return pointerIds;
  }
  return pointerIds.filter((id) => id !== pointerId);
};
