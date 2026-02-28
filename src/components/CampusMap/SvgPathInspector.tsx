// src/components/CampusMap/SvgPathInspector.tsx
import React, { useMemo, useState, useRef, useCallback } from 'react'
import { groupSvgPaths, type StyleGroup } from '../../importer/svg/groupSvgPaths'

export interface SvgPathInspectorProps {
  rawSvg: string
  /** If provided, only these group indices are shown; all others are force-hidden */
  keepGroups?: number[]
  /** If true, hides all text, tspan, use, and image elements in the SVG */
  excludeText?: boolean
  /** Permanently hidden path ranges. group constrains to a specific data-sg. */
  hiddenPathRanges?: Array<{ group?: number; start: number; end: number }>
}

const PATH_DISPLAY_LIMIT = 200

function swatchColor(g: StyleGroup): string {
  if (g.strokeColor !== 'none') return g.strokeColor
  if (g.fillColor !== 'none') return g.fillColor
  return '#64748b'
}

export const SvgPathInspector: React.FC<SvgPathInspectorProps> = ({ rawSvg, keepGroups, excludeText, hiddenPathRanges }) => {
  const { groups, svgInnerHTML, viewBox } = useMemo(
    () => groupSvgPaths(rawSvg),
    [rawSvg],
  )

  const keepGroupSet = useMemo(
    () => (keepGroups ? new Set(keepGroups) : null),
    [keepGroups],
  )

  // group-level visibility
  const [hiddenGroups, setHiddenGroups] = useState<Set<number>>(new Set())
  // individual path visibility
  const [hiddenPaths, setHiddenPaths] = useState<Set<number>>(new Set())
  // hover state
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null)
  const [hoveredPath, setHoveredPath] = useState<number | null>(null)
  // expand/collapse
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  // zoom/pan
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const clampZoom = (v: number) => Math.max(0.1, Math.min(20, v))

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => clampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current
    if (drag) {
      setPanX(v => v + e.clientX - drag.x)
      setPanY(v => v + e.clientY - drag.y)
      dragRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    // hover detection via data-sp on SVG element
    const target = e.target as Element
    const sp = target.getAttribute?.('data-sp')
    setHoveredPath(sp != null ? Number(sp) : null)
  }, [])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  const resetView = useCallback(() => {
    setZoom(1); setPanX(0); setPanY(0)
  }, [])

  // CSS generation
  const cssText = useMemo(() => {
    const rules: string[] = []
    // Force-hide all groups not in keepGroups
    if (keepGroupSet) {
      groups.forEach(g => {
        if (!keepGroupSet.has(g.index)) {
          rules.push(`[data-sg="${g.index}"]{display:none}`)
        }
      })
    }
    hiddenGroups.forEach(idx => rules.push(`[data-sg="${idx}"]{display:none}`))
    hiddenPaths.forEach(pidx => rules.push(`[data-sp="${pidx}"]{display:none}`))
    // Permanently hidden path ranges
    if (hiddenPathRanges) {
      for (const { group, start, end } of hiddenPathRanges) {
        const prefix = group !== undefined ? `[data-sg="${group}"]` : ''
        for (let i = start; i <= end; i++) {
          rules.push(`${prefix}[data-sp="${i}"]{display:none}`)
        }
      }
    }
    // Hide text, icons not captured by path grouping
    if (excludeText) rules.push('text,tspan,use,image{display:none}')
    if (hoveredGroup !== null) {
      rules.push(`[data-sg="${hoveredGroup}"]{stroke:orange!important;stroke-width:3!important;opacity:1!important}`)
    }
    if (hoveredPath !== null) {
      rules.push(`[data-sp="${hoveredPath}"]{stroke:cyan!important;stroke-width:4!important;opacity:1!important}`)
    }
    return rules.join('\n')
  }, [groups, keepGroupSet, hiddenGroups, hiddenPaths, hiddenPathRanges, excludeText, hoveredGroup, hoveredPath])

  // group toggle
  const toggleGroup = useCallback((idx: number) => {
    setHiddenGroups(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }, [])

  // individual path toggle
  const togglePath = useCallback((pidx: number) => {
    setHiddenPaths(prev => {
      const next = new Set(prev)
      if (next.has(pidx)) next.delete(pidx); else next.add(pidx)
      return next
    })
  }, [])

  // expand/collapse group
  const toggleExpand = useCallback((idx: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }, [])

  const hideAll = useCallback(() => {
    const targets = keepGroupSet ? groups.filter(g => keepGroupSet.has(g.index)) : groups
    setHiddenGroups(new Set(targets.map(g => g.index)))
  }, [groups, keepGroupSet])
  const showAll = useCallback(() => { setHiddenGroups(new Set()); setHiddenPaths(new Set()) }, [])

  const activeGroups = keepGroupSet ? groups.filter(g => keepGroupSet.has(g.index)) : groups
  const visibleCount = activeGroups.filter(g => !hiddenGroups.has(g.index)).length
  const isDragging = dragRef.current !== null

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* SVG canvas with zoom/pan */}
      <div
        data-inspector-svg="true"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--bg-1)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={resetView}
      >
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '50% 50%',
          }}
        >
          <style data-inspector-style="true">{cssText}</style>
          <g dangerouslySetInnerHTML={{ __html: svgInnerHTML }} />
        </svg>
      </div>

      {/* Panel */}
      <div style={{
        width: 240,
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
            {visibleCount}/{activeGroups.length} groups
            {keepGroupSet && <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>({groups.length} total)</span>}
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
            const isGroupHidden = hiddenGroups.has(g.index)
            const isForceExcluded = keepGroupSet !== null && !keepGroupSet.has(g.index)
            const isExpanded = expandedGroups.has(g.index)
            const isHovered = hoveredGroup === g.index

            return (
              <div key={g.index}>
                {/* Group header */}
                <div
                  data-group-row={g.index}
                  onMouseEnter={() => setHoveredGroup(g.index)}
                  onMouseLeave={() => setHoveredGroup(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 8px',
                    borderBottom: '1px solid var(--border-1)',
                    background: isHovered && !isForceExcluded ? 'var(--accent-bg)' : 'transparent',
                    opacity: isForceExcluded ? 0.25 : isGroupHidden ? 0.4 : 1,
                    cursor: isForceExcluded ? 'default' : 'pointer',
                  }}
                  onClick={() => { if (!isForceExcluded) toggleExpand(g.index) }}
                >
                  {/* Expand indicator */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)', width: 8, flexShrink: 0 }}>
                    {isForceExcluded ? '–' : isExpanded ? '▼' : '▶'}
                  </span>

                  {/* Color swatch */}
                  <div style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: swatchColor(g),
                    border: '1px solid rgba(255,255,255,0.15)',
                    flexShrink: 0,
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 9, lineHeight: 1.4 }}>
                    <div style={{ color: 'var(--text-1)' }}>#{g.index} ({g.count})</div>
                    <div style={{ color: 'var(--text-3)', fontSize: 8 }}>sw:{g.strokeWidth}</div>
                  </div>

                  {/* Group toggle (or excluded badge) */}
                  {isForceExcluded ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 7,
                      padding: '1px 4px', borderRadius: 2,
                      border: '1px solid var(--border-2)',
                      color: 'var(--text-3)',
                      flexShrink: 0,
                    }}>excl</span>
                  ) : (
                  <button
                    data-toggle={g.index}
                    onClick={(e) => { e.stopPropagation(); toggleGroup(g.index) }}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8,
                      padding: '1px 5px', borderRadius: 2,
                      border: '1px solid',
                      borderColor: isGroupHidden ? 'var(--border-2)' : 'var(--accent)',
                      background: isGroupHidden ? 'transparent' : 'var(--accent-bg)',
                      color: isGroupHidden ? 'var(--text-3)' : 'var(--accent)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {isGroupHidden ? 'OFF' : 'ON'}
                  </button>
                  )}
                </div>

                {/* Expanded: individual path list */}
                {isExpanded && (
                  <div style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {g.count > PATH_DISPLAY_LIMIT && (
                      <div style={{ padding: '3px 24px', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                        最初の {PATH_DISPLAY_LIMIT} 件を表示 (全 {g.count} 件)
                      </div>
                    )}
                    {g.paths.slice(0, PATH_DISPLAY_LIMIT).map(p => {
                      const isPathHidden = hiddenPaths.has(p.pathIndex)
                      const isPathHovered = hoveredPath === p.pathIndex
                      return (
                        <div
                          key={p.pathIndex}
                          data-path-row={p.pathIndex}
                          onMouseEnter={() => setHoveredPath(p.pathIndex)}
                          onMouseLeave={() => setHoveredPath(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '2px 8px 2px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isPathHovered ? 'rgba(6,182,212,0.15)' : 'transparent',
                            opacity: isPathHidden ? 0.35 : 1,
                          }}
                        >
                          <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-3)' }}>
                            path {p.pathIndex}
                          </span>
                          <button
                            data-path-toggle={p.pathIndex}
                            onClick={() => togglePath(p.pathIndex)}
                            style={{
                              fontFamily: 'var(--font-mono)', fontSize: 7,
                              padding: '0px 4px', borderRadius: 2,
                              border: '1px solid',
                              borderColor: isPathHidden ? 'var(--border-2)' : 'rgba(6,182,212,0.6)',
                              background: isPathHidden ? 'transparent' : 'rgba(6,182,212,0.1)',
                              color: isPathHidden ? 'var(--text-3)' : 'rgb(6,182,212)',
                              cursor: 'pointer',
                            }}
                          >
                            {isPathHidden ? 'OFF' : 'ON'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
