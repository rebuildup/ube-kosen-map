import type { StyleGroup } from '../../importer/svg/groupSvgPaths'
import type { CustomShape, ShapeBridgeEdit, ShapeVertexRef } from './page1InspectTypes'

type XY = [number, number]

export interface PathEndpointPair {
  start: XY
  end: XY
}

export interface ShapeVertexPoint {
  key: string
  x: number
  y: number
  refs: ShapeVertexRef[]
}

export interface ShapeVertexStats {
  isClosed: boolean
  all: ShapeVertexPoint[]
  dangling: ShapeVertexPoint[]
}

const endpointKey = (pt: XY, tolerance: number): string => {
  const qx = Math.round(pt[0] / tolerance)
  const qy = Math.round(pt[1] / tolerance)
  return `${qx}:${qy}`
}

export function buildPathEndpointMap(groups: StyleGroup[]): Map<number, PathEndpointPair> {
  const map = new Map<number, PathEndpointPair>()
  for (const group of groups) {
    for (const path of group.paths) {
      map.set(path.pathIndex, { start: path.startPt, end: path.endPt })
    }
  }
  return map
}

function toBridgeKey(
  ref: ShapeVertexRef,
  pathMap: Map<number, PathEndpointPair>,
  tolerance: number,
): string | null {
  const pair = pathMap.get(ref.pathIndex)
  if (pair == null) return null
  const pt = ref.endpoint === 'start' ? pair.start : pair.end
  return endpointKey(pt, tolerance)
}

export function collectShapeVertexStats(
  shape: CustomShape,
  pathMap: Map<number, PathEndpointPair>,
  bridges: ShapeBridgeEdit[],
  removedVertices: ShapeVertexRef[] = [],
  tolerance: number = 1,
): ShapeVertexStats {
  const endpointCounts = new Map<string, number>()
  const vertexMap = new Map<string, ShapeVertexPoint>()
  const removedKeySet = new Set(removedVertices.map((v) => `${v.pathIndex}:${v.endpoint}`))
  const isRemoved = (ref: ShapeVertexRef): boolean => removedKeySet.has(`${ref.pathIndex}:${ref.endpoint}`)

  const addEndpoint = (ref: ShapeVertexRef): void => {
    if (isRemoved(ref)) return
    const pair = pathMap.get(ref.pathIndex)
    if (pair == null) return
    const pt = ref.endpoint === 'start' ? pair.start : pair.end
    const key = endpointKey(pt, tolerance)
    endpointCounts.set(key, (endpointCounts.get(key) ?? 0) + 1)
    const prev = vertexMap.get(key)
    if (prev == null) {
      vertexMap.set(key, { key, x: pt[0], y: pt[1], refs: [ref] })
      return
    }
    prev.refs.push(ref)
  }

  for (const pathIndex of shape.pathIndices) {
    addEndpoint({ pathIndex, endpoint: 'start' })
    addEndpoint({ pathIndex, endpoint: 'end' })
  }

  const shapePathSet = new Set(shape.pathIndices)
  for (const bridge of bridges) {
    if (shapePathSet.has(bridge.from.pathIndex) && !isRemoved(bridge.from)) {
      const key = toBridgeKey(bridge.from, pathMap, tolerance)
      if (key != null) endpointCounts.set(key, (endpointCounts.get(key) ?? 0) + 1)
    }
    if (shapePathSet.has(bridge.to.pathIndex) && !isRemoved(bridge.to)) {
      const key = toBridgeKey(bridge.to, pathMap, tolerance)
      if (key != null) endpointCounts.set(key, (endpointCounts.get(key) ?? 0) + 1)
    }
  }

  const dangling: ShapeVertexPoint[] = []
  const all = Array.from(vertexMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  for (const [key, count] of endpointCounts.entries()) {
    if (count % 2 === 1) {
      const point = vertexMap.get(key)
      if (point != null) dangling.push(point)
    }
  }
  dangling.sort((a, b) => a.key.localeCompare(b.key))

  return {
    isClosed: dangling.length === 0,
    all,
    dangling,
  }
}

export function buildBridgeSegments(
  bridges: ShapeBridgeEdit[],
  pathMap: Map<number, PathEndpointPair>,
): Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> {
  const segments: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = []
  for (const bridge of bridges) {
    const from = pathMap.get(bridge.from.pathIndex)
    const to = pathMap.get(bridge.to.pathIndex)
    if (from == null || to == null) continue
    const p1 = bridge.from.endpoint === 'start' ? from.start : from.end
    const p2 = bridge.to.endpoint === 'start' ? to.start : to.end
    segments.push({ id: bridge.id, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] })
  }
  return segments
}
