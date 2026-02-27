import { autoComplete } from '../../core/autocomplete'
import {
  createEmptyCampusGraph,
  toBuildingId,
  toEdgeId,
  toFloorId,
  toNodeId,
} from '../../core/schema'
import type { NodeId } from '../../core/schema'
import type { Vec2 } from '../../math'
import { extractStrokePaths } from './extractStrokePaths'
import { pathToPolyline } from './pathToPolyline'
import type { SvgImportOptions } from './types'

const keyOf = (p: Vec2, tolerance: number): string => {
  const x = Math.round(p.x / tolerance)
  const y = Math.round(p.y / tolerance)
  return `${x}:${y}`
}

export const buildGraphFromSvg = (
  rawSvg: string,
  opts: SvgImportOptions,
) => {
  const tolerance = opts.mergeTolerance ?? 0.25
  const g = createEmptyCampusGraph()

  const buildingId = toBuildingId(`building-${opts.buildingName}`)
  const floorId = toFloorId(`floor-${opts.buildingName}-${opts.floorLevel}`)

  g.buildings[buildingId] = {
    id: buildingId,
    name: opts.buildingName,
    floorIds: [floorId],
  }
  g.floors[floorId] = {
    id: floorId,
    buildingId,
    level: opts.floorLevel,
  }

  const nodeByKey = new Map<string, NodeId>()
  let nodeCount = 0
  let edgeCount = 0

  const getNodeId = (point: Vec2): NodeId => {
    const key = keyOf(point, tolerance)
    const existing = nodeByKey.get(key)
    if (existing) return existing

    const id = toNodeId(`n-${opts.buildingName}-${opts.floorLevel}-${nodeCount}`)
    nodeCount += 1
    g.nodes[id] = {
      id,
      type: 'corridor_junction',
      position: point,
      floorId,
      buildingId,
    }
    nodeByKey.set(key, id)
    return id
  }

  const strokePaths = extractStrokePaths(rawSvg)
  const seenEdges = new Set<string>()

  for (const path of strokePaths) {
    const polyline = pathToPolyline(path.d)
    if (polyline.length < 2) continue

    for (let i = 0; i < polyline.length - 1; i += 1) {
      const a = getNodeId(polyline[i] as Vec2)
      const b = getNodeId(polyline[i + 1] as Vec2)
      if (a === b) continue

      const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`
      if (seenEdges.has(edgeKey)) continue
      seenEdges.add(edgeKey)

      const edgeId = toEdgeId(`e-${opts.buildingName}-${opts.floorLevel}-${edgeCount}`)
      edgeCount += 1

      g.edges[edgeId] = {
        id: edgeId,
        sourceNodeId: a,
        targetNodeId: b,
      }
    }
  }

  return autoComplete(g)
}
