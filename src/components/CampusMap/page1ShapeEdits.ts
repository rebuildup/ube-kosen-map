import type { CustomShape, ShapeEditConfig } from './page1InspectTypes'

function sortedUniquePathIndices(pathIndices: number[]): number[] {
  return [...new Set(pathIndices)].sort((a, b) => a - b)
}

function cloneShape(shape: CustomShape): CustomShape {
  return {
    id: shape.id,
    pathIndices: [...shape.pathIndices],
    isClosed: shape.isClosed,
    hasFill: shape.hasFill,
    fillColor: shape.fillColor,
  }
}

export function applyShapeEdits(baseShapes: CustomShape[], shapeEdits?: ShapeEditConfig): CustomShape[] {
  const shapeMap = new Map<string, CustomShape>()
  for (const shape of baseShapes) {
    shapeMap.set(shape.id, cloneShape(shape))
  }

  const merges = shapeEdits?.merges ?? []
  for (const merge of merges) {
    if (merge.sourceShapeIds.length === 0) continue
    const sources = merge.sourceShapeIds
      .map(id => shapeMap.get(id))
      .filter((s): s is CustomShape => s != null)

    if (sources.length === 0) continue

    const merged: CustomShape = {
      id: merge.resultShapeId,
      pathIndices: sortedUniquePathIndices(sources.flatMap(s => s.pathIndices)),
      isClosed: merge.isClosed ?? sources[0]!.isClosed,
      hasFill: merge.hasFill ?? sources[0]!.hasFill,
      fillColor: merge.fillColor ?? sources[0]!.fillColor,
    }

    for (const sourceId of merge.sourceShapeIds) {
      shapeMap.delete(sourceId)
    }
    shapeMap.set(merged.id, merged)
  }

  const splits = shapeEdits?.splits ?? []
  for (const split of splits) {
    const source = shapeMap.get(split.sourceShapeId)
    if (source == null) continue

    shapeMap.delete(split.sourceShapeId)
    for (const part of split.parts) {
      shapeMap.set(part.id, {
        id: part.id,
        pathIndices: sortedUniquePathIndices(part.pathIndices),
        isClosed: part.isClosed ?? source.isClosed,
        hasFill: part.hasFill ?? source.hasFill,
        fillColor: part.fillColor ?? source.fillColor,
      })
    }
  }

  return Array.from(shapeMap.values()).sort((a, b) => a.id.localeCompare(b.id))
}
