// src/components/CampusMap/SvgPathInspector.tsx
import React, { useMemo, useState, useCallback } from 'react'
import { groupSvgPaths, type StyleGroup } from '../../importer/svg/groupSvgPaths'

export interface SvgPathInspectorProps {
  rawSvg: string
}

function swatchColor(g: StyleGroup): string {
  if (g.strokeColor !== 'none') return g.strokeColor
  if (g.fillColor !== 'none') return g.fillColor
  return '#64748b'
}

export const SvgPathInspector: React.FC<SvgPathInspectorProps> = ({ rawSvg }) => {
  const { groups, svgInnerHTML, viewBox } = useMemo(
    () => groupSvgPaths(rawSvg),
    [rawSvg],
  )

  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [hovered, setHovered] = useState<number | null>(null)

  const cssText = useMemo(() => {
    const rules: string[] = []
    hidden.forEach(idx => {
      rules.push(`[data-sg="${idx}"]{display:none}`)
    })
    if (hovered !== null) {
      rules.push(
        `[data-sg="${hovered}"]{stroke:orange!important;stroke-width:3!important;opacity:1!important}`,
      )
    }
    return rules.join('\n')
  }, [hidden, hovered])

  const toggle = useCallback((idx: number) => {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const hideAll = useCallback(() => {
    setHidden(new Set(groups.map(g => g.index)))
  }, [groups])

  const showAll = useCallback(() => {
    setHidden(new Set())
  }, [])

  const visibleCount = groups.length - hidden.size

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* SVG canvas */}
      <div
        data-inspector-svg="true"
        style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-1)' }}
      >
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
        >
          <style data-inspector-style="true">{cssText}</style>
          <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
        </svg>
      </div>

      {/* Panel */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderLeft: '1px solid var(--border-1)',
        background: 'var(--bg-2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Toolbar */}
        <div style={{
          padding: '5px 8px',
          borderBottom: '1px solid var(--border-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-2)', flex: 1 }}>
            {visibleCount}/{groups.length} visible
          </span>
          {(['HIDE ALL', 'SHOW ALL'] as const).map(label => (
            <button
              key={label}
              onClick={label === 'HIDE ALL' ? hideAll : showAll}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 8,
                padding: '2px 5px', borderRadius: 2,
                border: '1px solid var(--border-2)',
                background: 'transparent', color: 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Group list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {groups.map(g => {
            const isHidden = hidden.has(g.index)
            const isHovered = hovered === g.index
            return (
              <div
                key={g.index}
                data-group-row={g.index}
                onMouseEnter={() => setHovered(g.index)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderBottom: '1px solid var(--border-1)',
                  background: isHovered ? 'var(--accent-bg)' : 'transparent',
                  opacity: isHidden ? 0.4 : 1,
                }}
              >
                {/* Swatch */}
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: swatchColor(g),
                  border: '1px solid rgba(255,255,255,0.15)',
                  flexShrink: 0,
                }} />

                {/* Info */}
                <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9, lineHeight: 1.4 }}>
                  <div style={{ color: 'var(--text-1)' }}>#{g.index} ({g.count})</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 8 }}>
                    sw:{g.strokeWidth}
                  </div>
                </div>

                {/* Toggle */}
                <button
                  data-toggle={g.index}
                  onClick={() => toggle(g.index)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    padding: '1px 5px', borderRadius: 2,
                    border: '1px solid',
                    borderColor: isHidden ? 'var(--border-2)' : 'var(--accent)',
                    background: isHidden ? 'transparent' : 'var(--accent-bg)',
                    color: isHidden ? 'var(--text-3)' : 'var(--accent)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {isHidden ? 'OFF' : 'ON'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
