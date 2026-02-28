// src/importer/svg/parseSvgSegments.ts
export type Vec2 = { x: number; y: number }

export type SegmentKind = 'building' | 'road' | 'door' | 'balcony' | 'other'

export interface Segment {
  a: Vec2
  b: Vec2
  featureId?: string
  kind?: SegmentKind
}

const SHAPE_SELECTOR = 'path,polyline,polygon,line'

const inDefsOrSymbol = (el: Element): boolean =>
  Boolean(el.closest('defs') || el.closest('symbol'))

const hasStroke = (el: Element): boolean => {
  const style = el.getAttribute('style') ?? ''
  const strokeAttr = (el.getAttribute('stroke') ?? '').toLowerCase().trim()
  const hasStyleStroke = /(^|;)\s*stroke\s*:\s*(?!none)[^;]+/i.test(style)
  return hasStyleStroke || (strokeAttr.length > 0 && strokeAttr !== 'none')
}

const PATH_TOKEN_RE = /[AaCcHhLlMmQqSsTtVvZz]|[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/g
const isCmd = (t: string) => /^[AaCcHhLlMmQqSsTtVvZz]$/.test(t)

function collectPathPoints(d: string): Vec2[] {
  const tokens = Array.from(d.matchAll(PATH_TOKEN_RE), m => m[0] ?? '')
  const pts: Vec2[] = []
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0
  const num = (): number | null => {
    if (i >= tokens.length || isCmd(tokens[i] ?? '')) return null
    const n = Number(tokens[i++])
    return Number.isFinite(n) ? n : null
  }
  const has = () => i < tokens.length && !isCmd(tokens[i] ?? '')
  while (i < tokens.length) {
    const t = tokens[i] ?? ''
    if (isCmd(t)) { cmd = t; i++ } else if (!cmd) break
    const rel = cmd === cmd.toLowerCase()
    const up = cmd.toUpperCase()
    if (up === 'Z') { cx = sx; cy = sy; pts.push({ x: cx, y: cy }); continue }
    if (up === 'M') {
      let first = true
      while (has()) {
        const x = num(); const y = num()
        if (x == null || y == null) break
        cx = rel && !first ? cx + x : x; cy = rel && !first ? cy + y : y
        if (first) { sx = cx; sy = cy; first = false }
        pts.push({ x: cx, y: cy })
      }
      continue
    }
    if (up === 'L') { while (has()) { const x = num(); const y = num(); if (x == null || y == null) break; cx = rel ? cx+x : x; cy = rel ? cy+y : y; pts.push({x:cx,y:cy}) }; continue }
    if (up === 'H') { while (has()) { const x = num(); if (x == null) break; cx = rel ? cx+x : x; pts.push({x:cx,y:cy}) }; continue }
    if (up === 'V') { while (has()) { const y = num(); if (y == null) break; cy = rel ? cy+y : y; pts.push({x:cx,y:cy}) }; continue }
    if (up === 'C') { while (has()) { const a=num(),b=num(),c=num(),dd=num(),x=num(),y=num(); if(a==null||b==null||c==null||dd==null||x==null||y==null) break; cx=rel?cx+x:x; cy=rel?cy+y:y; pts.push({x:cx,y:cy}) }; continue }
    if (up==='S'||up==='Q') { while(has()){const a=num(),b=num(),x=num(),y=num();if(a==null||b==null||x==null||y==null)break;cx=rel?cx+x:x;cy=rel?cy+y:y;pts.push({x:cx,y:cy})};continue }
    if (up==='T') { while(has()){const x=num(),y=num();if(x==null||y==null)break;cx=rel?cx+x:x;cy=rel?cy+y:y;pts.push({x:cx,y:cy})};continue }
    if (up==='A') { while(has()){const a=num(),b=num(),c=num(),dd=num(),e=num(),x=num(),y=num();if(a==null||b==null||c==null||dd==null||e==null||x==null||y==null)break;cx=rel?cx+x:x;cy=rel?cy+y:y;pts.push({x:cx,y:cy})};continue }
    i++
  }
  return pts
}

function getPoints(el: Element): { pts: Vec2[]; close: boolean } {
  const tag = el.tagName.toLowerCase()
  if (tag === 'line') {
    return {
      pts: [
        { x: Number(el.getAttribute('x1') ?? 0), y: Number(el.getAttribute('y1') ?? 0) },
        { x: Number(el.getAttribute('x2') ?? 0), y: Number(el.getAttribute('y2') ?? 0) },
      ],
      close: false,
    }
  }
  if (tag === 'polyline' || tag === 'polygon') {
    const raw = el.getAttribute('points') ?? ''
    const nums = Array.from(raw.matchAll(/[+-]?(?:\d*\.\d+|\d+)/g), m => Number(m[0]))
    const pts: Vec2[] = []
    for (let i = 0; i < nums.length - 1; i += 2) pts.push({ x: nums[i]!, y: nums[i+1]! })
    return { pts, close: tag === 'polygon' }
  }
  const d = el.getAttribute('d')
  if (d) return { pts: collectPathPoints(d), close: false }
  return { pts: [], close: false }
}

const EPS = 0.01

export function parseSvgSegments(rawSvg: string): Segment[] {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  const shapes = Array.from(root.querySelectorAll(SHAPE_SELECTOR))
  const result: Segment[] = []

  for (const el of shapes) {
    if (inDefsOrSymbol(el) || !hasStroke(el)) continue
    const featureId = el.getAttribute('id') ?? el.getAttribute('data-id') ?? undefined
    const { pts, close } = getPoints(el)
    if (pts.length < 2) continue
    const effective = close ? [...pts, pts[0]!] : pts
    for (let i = 0; i < effective.length - 1; i++) {
      const a = effective[i]!
      const b = effective[i + 1]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (Math.sqrt(dx*dx + dy*dy) < EPS) continue
      result.push({ a, b, featureId })
    }
  }

  return result
}
