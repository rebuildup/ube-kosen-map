// src/importer/svg/parseSvgSegments.ts
export type Vec2 = { x: number; y: number }

export type SegmentKind = 'building' | 'road' | 'door' | 'balcony' | 'other'

export interface Segment {
  a: Vec2
  b: Vec2
  pathIndex?: number
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

// --- Transform utilities (mirrors analyzeStructuralGroups.ts) ---

type Mat2D = [number, number, number, number, number, number] // a,b,c,d,e,f

const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0]

const mul = (m1: Mat2D, m2: Mat2D): Mat2D => {
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

const applyMat = (m: Mat2D, x: number, y: number): { x: number; y: number } => {
  const [a, b, c, d, e, f] = m
  return {
    x: a * x + c * y + e,
    y: b * x + d * y + f,
  }
}

const toNumbersT = (raw: string): number[] =>
  Array.from(raw.matchAll(/[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/gi), (m) => Number(m[0]))

const parseTransform = (raw: string): Mat2D => {
  let out: Mat2D = IDENTITY
  const re = /(matrix|translate|scale|rotate)\(([^)]+)\)/gi
  const parts = Array.from(raw.matchAll(re))
  for (const part of parts) {
    const fn = (part[1] ?? '').toLowerCase()
    const nums = toNumbersT(part[2] ?? '')
    let m: Mat2D = IDENTITY
    if (fn === 'matrix' && nums.length >= 6) {
      m = [nums[0] ?? 1, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 1, nums[4] ?? 0, nums[5] ?? 0]
    } else if (fn === 'translate') {
      const tx = nums[0] ?? 0
      const ty = nums[1] ?? 0
      m = [1, 0, 0, 1, tx, ty]
    } else if (fn === 'scale') {
      const sx = nums[0] ?? 1
      const sy = nums[1] ?? sx
      m = [sx, 0, 0, sy, 0, 0]
    } else if (fn === 'rotate') {
      const deg = nums[0] ?? 0
      const rad = (deg * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      if (nums.length >= 3) {
        const cx = nums[1] ?? 0
        const cy = nums[2] ?? 0
        const t1: Mat2D = [1, 0, 0, 1, cx, cy]
        const r: Mat2D = [cos, sin, -sin, cos, 0, 0]
        const t2: Mat2D = [1, 0, 0, 1, -cx, -cy]
        m = mul(mul(t1, r), t2)
      } else {
        m = [cos, sin, -sin, cos, 0, 0]
      }
    }
    out = mul(out, m)
  }
  return out
}

const getElementTransform = (el: Element): Mat2D => {
  let m: Mat2D = IDENTITY
  const chain: Element[] = []
  let cur: Element | null = el
  while (cur) {
    chain.push(cur)
    cur = cur.parentElement
  }
  chain.reverse()
  for (const node of chain) {
    const t = node.getAttribute('transform')
    if (!t) continue
    m = mul(m, parseTransform(t))
  }
  return m
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

function getPointsWorld(el: Element): { pts: Vec2[]; close: boolean } {
  const tf = getElementTransform(el)
  const { pts, close } = getPoints(el)
  return {
    pts: pts.map(p => applyMat(tf, p.x, p.y)),
    close,
  }
}

const EPS = 0.01

export function parseSvgSegments(rawSvg: string): Segment[] {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  const shapes = Array.from(root.querySelectorAll(SHAPE_SELECTOR))
  const result: Segment[] = []
  let pathIndex = 0

  for (const el of shapes) {
    if (inDefsOrSymbol(el)) continue
    const currentPathIndex = pathIndex
    pathIndex += 1
    if (!hasStroke(el)) continue
    const featureId = el.getAttribute('id') ?? el.getAttribute('data-id') ?? undefined
    const { pts, close } = getPointsWorld(el)
    if (pts.length < 2) continue
    const effective = close ? [...pts, pts[0]!] : pts
    for (let i = 0; i < effective.length - 1; i++) {
      const a = effective[i]!
      const b = effective[i + 1]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (Math.sqrt(dx*dx + dy*dy) < EPS) continue
      result.push({ a, b, pathIndex: currentPathIndex, featureId })
    }
  }

  return result
}
