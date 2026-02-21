import { useState, useCallback } from 'react'
import { useMap, searchNodes } from '..'

interface SearchPanelProps {
  onSelect?: (nodeId: string) => void
}

export function SearchPanel({ onSelect }: SearchPanelProps) {
  const { nodes, activeFloor, dispatch } = useMap()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name?: string; type: string }>>([])
  const [isOpen, setIsOpen] = useState(false)

  const handleSearch = useCallback(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const found = searchNodes(nodes, {
      nameContains: query,
      floor: activeFloor,
    })

    setResults(found.map(n => ({ id: n.id, name: n.name, type: n.type })))
    setIsOpen(true)
  }, [nodes, query, activeFloor])

  const handleSelect = (nodeId: string) => {
    dispatch({ type: 'SET_DESTINATION', payload: nodeId })
    onSelect?.(nodeId)
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="search-panel" data-testid="search-panel">
      <div className="search-input-wrapper">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search rooms, facilities..."
          data-testid="search-input"
        />
        <button onClick={handleSearch} data-testid="search-button">
          🔍
        </button>
      </div>

      {isOpen && results.length > 0 && (
        <ul className="search-results" data-testid="search-results">
          {results.map((result) => (
            <li key={result.id}>
              <button
                onClick={() => handleSelect(result.id)}
                data-testid={`search-result-${result.id}`}
              >
                <span className="result-name">{result.name || result.id}</span>
                <span className="result-type">{result.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="search-no-results" data-testid="search-no-results">
          No results found
        </div>
      )}
    </div>
  )
}
