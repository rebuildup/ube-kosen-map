import type { Node, Edge, RouteRequest, UserConstraints, Route } from '../types'

export function filterEdgesByConstraints(
  edges: Map<string, Edge>,
  constraints: UserConstraints
): Edge[] {
  const { max, requires } = constraints

  return [...edges.values()].filter(edge => {
    const ec = edge.constraints

    // Size/weight limit check
    if (max?.width !== undefined && ec.max?.width !== undefined) {
      if (max.width > ec.max.width) return false
    }
    if (max?.height !== undefined && ec.max?.height !== undefined) {
      if (max.height > ec.max.height) return false
    }
    if (max?.weight !== undefined && ec.max?.weight !== undefined) {
      if (max.weight > ec.max.weight) return false
    }

    // Requirement check - edge requires certain permissions, user must have them all
    if (ec.requires && ec.requires.length > 0) {
      if (!requires || !ec.requires.every(r => requires.includes(r))) return false
    }

    // Blocked check
    if (ec.blocked) {
      if (ec.blocked.from || ec.blocked.to) return false
    }

    return true
  })
}

interface DijkstraNode {
  id: string
  distance: number
  previous: string | null
  edgeId: string | null
}

export function findRoute(
  nodes: Map<string, Node>,
  edges: Map<string, Edge>,
  request: RouteRequest
): Route | null {
  const { from, to, avoid = [], constraints = {}, optimizeBy = 'distance' } = request

  // Same node
  if (from === to) {
    return { nodeIds: [from], edges: [], distance: 0 }
  }

  // Filter edges by constraints
  const validEdges = filterEdgesByConstraints(edges, constraints)
    .filter(e => !avoid.includes(e.id) && !avoid.includes(e.from) && !avoid.includes(e.to))

  // Build adjacency list
  const adjacency = new Map<string, Array<{ to: string; edge: Edge }>>()
  for (const node of nodes.keys()) {
    adjacency.set(node, [])
  }

  for (const edge of validEdges) {
    const cost = optimizeBy === 'time' ? (edge.estimatedTime ?? edge.distance) : edge.distance
    adjacency.get(edge.from)?.push({ to: edge.to, edge: { ...edge, distance: cost } })
    if (edge.bidirectional) {
      adjacency.get(edge.to)?.push({ to: edge.from, edge: { ...edge, distance: cost } })
    }
  }

  // Dijkstra's algorithm
  const distances = new Map<string, DijkstraNode>()
  for (const nodeId of nodes.keys()) {
    distances.set(nodeId, { id: nodeId, distance: Infinity, previous: null, edgeId: null })
  }
  distances.set(from, { id: from, distance: 0, previous: null, edgeId: null })

  const visited = new Set<string>()
  const queue = [from]

  while (queue.length > 0) {
    // Get node with minimum distance
    queue.sort((a, b) => (distances.get(a)?.distance ?? Infinity) - (distances.get(b)?.distance ?? Infinity))
    const current = queue.shift()!

    if (visited.has(current)) continue
    visited.add(current)

    if (current === to) break

    const neighbors = adjacency.get(current) ?? []
    for (const { to: neighbor, edge } of neighbors) {
      if (visited.has(neighbor)) continue

      const currentDist = distances.get(current)?.distance ?? Infinity
      const neighborDist = distances.get(neighbor)?.distance ?? Infinity
      const newDist = currentDist + edge.distance

      if (newDist < neighborDist) {
        distances.set(neighbor, {
          id: neighbor,
          distance: newDist,
          previous: current,
          edgeId: edge.id,
        })
        queue.push(neighbor)
      }
    }
  }

  // Reconstruct path
  const endNode = distances.get(to)
  if (!endNode || endNode.distance === Infinity) {
    return null
  }

  const nodeIds: string[] = []
  const edgeIds: string[] = []
  let current: string | null = to

  while (current !== null) {
    nodeIds.unshift(current)
    const node = distances.get(current)
    if (node?.edgeId) {
      edgeIds.unshift(node.edgeId)
    }
    current = node?.previous ?? null
  }

  // Get original edges for correct distance
  let totalDistance = 0
  for (const edgeId of edgeIds) {
    totalDistance += edges.get(edgeId)?.distance ?? 0
  }

  return { nodeIds, edges: edgeIds, distance: totalDistance }
}
