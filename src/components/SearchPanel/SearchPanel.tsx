/**
 * SearchPanel — Text search for nodes and spaces in a CampusGraph.
 *
 * [P-4] Semantic Zoom: search results focus the map on the matched entity.
 */

import React, { useState, useMemo } from 'react'
import type { CampusGraph } from '../../core/schema'

export interface SearchResult {
  id: string
  kind: 'node' | 'space'
  label?: string
  type?: string
}

/**
 * Search nodes and spaces by label/name/tags (partial, case-insensitive match).
 */
export const searchNodes = (graph: CampusGraph, query: string): SearchResult[] => {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const node of Object.values(graph.nodes)) {
    const label = node.label ?? ''
    if (label.toLowerCase().includes(q) || node.type?.toLowerCase().includes(q)) {
      results.push({ id: node.id, kind: 'node', label, type: node.type })
    }
  }

  for (const space of Object.values(graph.spaces)) {
    const name = space.name ?? ''
    const tagsMatch = space.tags?.some(t => t.toLowerCase().includes(q)) ?? false
    if (name.toLowerCase().includes(q) || space.type?.toLowerCase().includes(q) || tagsMatch) {
      results.push({ id: space.id, kind: 'space', label: name || space.type, type: space.type })
    }
  }

  return results
}

export interface SearchPanelProps {
  graph: CampusGraph
  onSelect?: (id: string, kind: 'node' | 'space') => void
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ graph, onSelect }) => {
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchNodes(graph, query), [graph, query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input
        role="textbox"
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="施設・部屋を検索…"
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid #d1d5db',
          fontSize: 13,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      {results.length > 0 && (
        <div
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            background: 'white',
          }}
        >
          {results.map(r => (
            <div
              key={r.id}
              data-search-result={r.id}
              onClick={() => onSelect?.(r.id, r.kind)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: r.kind === 'node' ? '#dbeafe' : '#dcfce7',
                  color: r.kind === 'node' ? '#1d4ed8' : '#15803d',
                  fontSize: 10,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.kind === 'node' ? 'ノード' : 'スペース'}
              </span>
              <span>{r.label ?? r.id}</span>
              {r.type && (
                <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>{r.type}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
