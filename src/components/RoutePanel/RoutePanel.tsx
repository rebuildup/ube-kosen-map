/**
 * RoutePanel — Displays the current route result with floor transitions
 * and alternative route selection.
 */

import React from 'react'
import type { Route } from '../../core/routing'

export interface RoutePanelProps {
  route: Route | null
  alternatives?: Route[]
  onAlternativeSelect?: (index: number) => void
}

export const RoutePanel: React.FC<RoutePanelProps> = ({
  route,
  alternatives = [],
  onAlternativeSelect,
}) => {
  if (!route) {
    return (
      <div
        data-no-route="true"
        style={{ padding: 12, color: '#6b7280', fontSize: 13 }}
      >
        出発地と目的地を選択してください
      </div>
    )
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Total cost */}
      <div style={{ fontWeight: 700, fontSize: 14 }}>
        総距離: {route.totalCost.toFixed(1)} m
      </div>

      {/* Node steps */}
      <ol style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12 }}>
        {route.nodeIds.map((id, i) => (
          <li key={id} data-route-node={id}>
            {i === 0 && '🟢 '}
            {i === route.nodeIds.length - 1 && '🔴 '}
            {id.slice(0, 8)}…
          </li>
        ))}
      </ol>

      {/* Floor transitions */}
      {route.floorTransitions.length > 0 && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          <strong>フロア遷移:</strong>
          {route.floorTransitions.map((ft, i) => (
            <span key={i} style={{ marginLeft: 6 }}>{ft.description}</span>
          ))}
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>代替経路:</div>
          {alternatives.map((alt, i) => (
            <button
              key={i}
              data-alternative-route={i}
              onClick={() => onAlternativeSelect?.(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '4px 8px',
                marginBottom: 2,
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              代替 {i + 1}: {alt.totalCost.toFixed(1)} m ({alt.nodeIds.length} ノード)
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
