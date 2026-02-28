export type HeightMap = Record<string, number>

export function resolveHeight(
  featureId: string | undefined,
  heights: HeightMap,
  defaultHeight: number,
): number {
  if (!featureId) return defaultHeight
  return heights[featureId] ?? defaultHeight
}
