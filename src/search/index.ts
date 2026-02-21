import type { Node, SearchRequest } from '../types'

export function searchNodes(
  nodes: Map<string, Node>,
  query: SearchRequest
): Node[] {
  const results: Node[] = []

  for (const node of nodes.values()) {
    if (query.type && node.type !== query.type) continue
    if (query.floor !== undefined && node.floor !== query.floor) continue

    if (query.tags && !query.tags.every(t => node.tags.includes(t))) continue
    if (query.excludeTags && query.excludeTags.some(t => node.tags.includes(t))) continue

    if (query.nameContains) {
      const name = node.name?.toLowerCase() ?? ''
      if (!name.includes(query.nameContains.toLowerCase())) continue
    }

    results.push(node)
  }

  return results
}
