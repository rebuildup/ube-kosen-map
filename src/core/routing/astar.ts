/**
 * @module core/routing/astar
 * A* pathfinding engine with multi-floor support and Yen's K-shortest paths.
 *
 * [P-1] Topology First: pathfinding operates on the graph structure.
 * [P-3] Context-Aware Dynamics: cost function integrates profile and context.
 */

import type { CampusGraph, NodeId, FloorId } from '../schema'
import { distance } from '../../math'
import type { RoutingProfile, RoutingContext } from './cost'
import { computeCost } from './cost'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FloorTransition {
  nodeId: string
  fromFloorId: string | undefined
  toFloorId: string | undefined
  description: string
}

export interface Route {
  nodeIds: string[]
  totalCost: number
  floorTransitions: FloorTransition[]
}

export type RouteResult =
  | { ok: true; route: Route; alternatives?: Route[] }
  | { ok: false; reason: string }

export interface FindRouteOptions {
  /** Number of alternative routes to compute (Yen's K-paths). Default: 0 */
  maxAlternatives?: number
}

// ── Min-heap priority queue ───────────────────────────────────────────────────

class MinHeap<T> {
  private data: { priority: number; item: T }[] = []

  push(item: T, priority: number): void {
    this.data.push({ priority, item })
    this._bubbleUp(this.data.length - 1)
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined
    const top = this.data[0].item
    const last = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = last
      this._sinkDown(0)
    }
    return top
  }

  get size(): number { return this.data.length }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.data[parent].priority <= this.data[i].priority) break
      ;[this.data[parent], this.data[i]] = [this.data[i], this.data[parent]]
      i = parent
    }
  }

  private _sinkDown(i: number): void {
    const n = this.data.length
    while (true) {
      let smallest = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.data[l].priority < this.data[smallest].priority) smallest = l
      if (r < n && this.data[r].priority < this.data[smallest].priority) smallest = r
      if (smallest === i) break
      ;[this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]]
      i = smallest
    }
  }
}

// ── A* core ───────────────────────────────────────────────────────────────────

/**
 * Euclidean-distance heuristic (admissible for straight-line world coords).
 */
const heuristic = (graph: CampusGraph, nodeId: string, goalId: string): number => {
  const n = graph.nodes[nodeId]
  const g = graph.nodes[goalId]
  if (!n?.position || !g?.position) return 0
  return distance(n.position, g.position)
}

interface AStarNode {
  id: string
  gCost: number
  fCost: number
}

/**
 * Run A* from start to goal. Returns the path as node ID array + cost, or null if unreachable.
 * Supports optional exclusion of specific edges (used by Yen's algorithm).
 */
const runAStar = (
  graph: CampusGraph,
  startId: string,
  goalId: string,
  profile: RoutingProfile,
  context: RoutingContext,
  excludedEdges = new Set<string>(),
  excludedNodes = new Set<string>(),
): { nodeIds: string[]; totalCost: number } | null => {
  const openSet = new MinHeap<AStarNode>()
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>()

  gScore.set(startId, 0)
  openSet.push({ id: startId, gCost: 0, fCost: heuristic(graph, startId, goalId) }, 0)

  while (openSet.size > 0) {
    const current = openSet.pop()!

    if (current.id === goalId) {
      // Reconstruct path
      const path: string[] = []
      let node: string | undefined = goalId
      while (node) {
        path.unshift(node)
        node = cameFrom.get(node)
      }
      return { nodeIds: path, totalCost: gScore.get(goalId) ?? 0 }
    }

    // Expand neighbors
    for (const edge of Object.values(graph.edges)) {
      if (excludedEdges.has(edge.id)) continue

      let neighborId: string | null = null
      if (edge.sourceNodeId === current.id) neighborId = edge.targetNodeId
      else if (edge.targetNodeId === current.id && edge.direction !== 'forward') {
        neighborId = edge.sourceNodeId
      }

      if (!neighborId || excludedNodes.has(neighborId)) continue

      const edgeCost = computeCost(edge, profile, context)
      if (edgeCost === Infinity) continue

      const tentativeG = (gScore.get(current.id) ?? Infinity) + edgeCost
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current.id)
        gScore.set(neighborId, tentativeG)
        const f = tentativeG + heuristic(graph, neighborId, goalId)
        openSet.push({ id: neighborId, gCost: tentativeG, fCost: f }, f)
      }
    }
  }

  return null
}

// ── Floor transition extraction ───────────────────────────────────────────────

const extractFloorTransitions = (
  graph: CampusGraph,
  nodeIds: string[],
): FloorTransition[] => {
  const transitions: FloorTransition[] = []
  for (let i = 1; i < nodeIds.length; i++) {
    const prev = graph.nodes[nodeIds[i - 1]]
    const curr = graph.nodes[nodeIds[i]]
    if (prev?.floorId && curr?.floorId && prev.floorId !== curr.floorId) {
      const fromFloor = graph.floors[prev.floorId]
      const toFloor   = graph.floors[curr.floorId]
      transitions.push({
        nodeId: nodeIds[i],
        fromFloorId: prev.floorId,
        toFloorId: curr.floorId,
        description: `${fromFloor?.name ?? prev.floorId}→${toFloor?.name ?? curr.floorId}`,
      })
    }
  }
  return transitions
}

// ── Yen's K-shortest paths ────────────────────────────────────────────────────

const yensKShortest = (
  graph: CampusGraph,
  startId: string,
  goalId: string,
  profile: RoutingProfile,
  context: RoutingContext,
  k: number,
  firstPath: { nodeIds: string[]; totalCost: number },
): { nodeIds: string[]; totalCost: number }[] => {
  const A: { nodeIds: string[]; totalCost: number }[] = [firstPath]
  const B: { nodeIds: string[]; totalCost: number }[] = []

  for (let ki = 1; ki < k; ki++) {
    const prev = A[ki - 1]

    for (let spurIdx = 0; spurIdx < prev.nodeIds.length - 1; spurIdx++) {
      const spurNode = prev.nodeIds[spurIdx]
      const rootPath = prev.nodeIds.slice(0, spurIdx + 1)

      const excludedEdges = new Set<string>()
      const excludedNodes = new Set<string>(rootPath.slice(0, -1))

      // Exclude edges shared by existing A paths at this root
      for (const route of A) {
        const rp = route.nodeIds
        let matches = true
        for (let ri = 0; ri < rootPath.length; ri++) {
          if (rp[ri] !== rootPath[ri]) { matches = false; break }
        }
        if (matches && spurIdx < rp.length - 1) {
          // Find edge from rp[spurIdx] to rp[spurIdx+1]
          for (const edge of Object.values(graph.edges)) {
            if (
              (edge.sourceNodeId === rp[spurIdx] && edge.targetNodeId === rp[spurIdx + 1]) ||
              (edge.targetNodeId === rp[spurIdx] && edge.sourceNodeId === rp[spurIdx + 1])
            ) {
              excludedEdges.add(edge.id)
            }
          }
        }
      }

      const spurPath = runAStar(graph, spurNode, goalId, profile, context, excludedEdges, excludedNodes)
      if (!spurPath) continue

      // Calculate root cost
      let rootCost = 0
      for (let ri = 0; ri < spurIdx; ri++) {
        const n1 = rootPath[ri]
        const n2 = rootPath[ri + 1]
        for (const edge of Object.values(graph.edges)) {
          if (
            (edge.sourceNodeId === n1 && edge.targetNodeId === n2) ||
            (edge.targetNodeId === n1 && edge.sourceNodeId === n2)
          ) {
            rootCost += computeCost(edge, profile, context)
            break
          }
        }
      }

      const totalPath = {
        nodeIds: [...rootPath, ...spurPath.nodeIds.slice(1)],
        totalCost: rootCost + spurPath.totalCost,
      }

      // Check not already in B
      const key = totalPath.nodeIds.join(',')
      if (!B.some(p => p.nodeIds.join(',') === key) &&
          !A.some(p => p.nodeIds.join(',') === key)) {
        B.push(totalPath)
      }
    }

    if (B.length === 0) break
    B.sort((a, b) => a.totalCost - b.totalCost)
    A.push(B.shift()!)
  }

  return A.slice(1) // return alternatives (skip first which is already in main result)
}

// ── Public API ────────────────────────────────────────────────────────────────

export const findRoute = (
  graph: CampusGraph,
  startId: NodeId,
  goalId: NodeId,
  profile: RoutingProfile,
  context: RoutingContext,
  options: FindRouteOptions = {},
): RouteResult => {
  if (!graph.nodes[startId]) return { ok: false, reason: `Start node "${startId}" not found.` }
  if (!graph.nodes[goalId])  return { ok: false, reason: `Goal node "${goalId}" not found.` }

  // Trivial case: same node
  if (startId === goalId) {
    return {
      ok: true,
      route: { nodeIds: [startId], totalCost: 0, floorTransitions: [] },
    }
  }

  const raw = runAStar(graph, startId, goalId, profile, context)
  if (!raw) {
    return {
      ok: false,
      reason: 'No reachable path exists (all paths may be impassable or Infinity cost under the current profile).',
    }
  }

  const route: Route = {
    nodeIds: raw.nodeIds,
    totalCost: raw.totalCost,
    floorTransitions: extractFloorTransitions(graph, raw.nodeIds),
  }

  // Compute alternative routes if requested
  const k = options.maxAlternatives ?? 0
  let alternatives: Route[] | undefined

  if (k > 0) {
    const altRaw = yensKShortest(graph, startId, goalId, profile, context, k + 1, raw)
    alternatives = altRaw.map(r => ({
      nodeIds: r.nodeIds,
      totalCost: r.totalCost,
      floorTransitions: extractFloorTransitions(graph, r.nodeIds),
    }))
  }

  return { ok: true, route, alternatives }
}
