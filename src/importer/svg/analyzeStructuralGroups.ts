import { extractStrokeOnlySvg } from './extractStrokeOnlySvg'

const SHAPE_SELECTOR = 'path,polyline,polygon,line,rect,circle,ellipse'
const PALETTE = [
  '#9ec5fe',
  '#a7f3d0',
  '#fde68a',
  '#fbcfe8',
  '#c4b5fd',
  '#fdba74',
  '#93c5fd',
  '#86efac',
]

export interface StructuralLayer {
  id: string
  pathCount: number
  depth: number
  height: number
  color: string
  svgMarkup: string
}

export interface StructuralConnector {
  xFrom: number
  yFrom: number
  xTo: number
  yTo: number
  x: number
  y: number
  zFrom: number
  zTo: number
}

export interface StructuralAnalysis {
  viewBox: string
  baseStrokeSvg: string
  layers: StructuralLayer[]
  connectors: StructuralConnector[]
}

export interface StructuralAnalysisOptions {
  hideNonBuildingSymbols?: boolean
}

const inDefsOrSymbol = (el: Element): boolean =>
  Boolean(el.closest('defs') || el.closest('symbol'))

const styleHasStroke = (style: string): boolean =>
  /(^|;)\s*stroke\s*:\s*[^;]+/i.test(style) && !/(^|;)\s*stroke\s*:\s*none\s*(;|$)/i.test(style)

const hasDrawableStroke = (el: Element): boolean => {
  const style = el.getAttribute('style') ?? ''
  const strokeAttr = (el.getAttribute('stroke') ?? '').trim().toLowerCase()
  return styleHasStroke(style) || (strokeAttr.length > 0 && strokeAttr !== 'none')
}

const depthFromRoot = (el: Element): number => {
  let depth = 0
  let p = el.parentElement
  while (p) {
    if (p.tagName.toLowerCase() === 'g') depth += 1
    p = p.parentElement
  }
  return depth
}

const countDrawableShapes = (el: Element): number =>
  Array.from(el.querySelectorAll(SHAPE_SELECTOR))
    .filter((s) => !inDefsOrSymbol(s))
    .filter(hasDrawableStroke)
    .length

const stripFillStyle = (style: string): string => style
  .replace(/(^|;)\s*fill\s*:[^;]*/gi, '$1')
  .replace(/(^|;)\s*fill-rule\s*:[^;]*/gi, '$1')
  .replace(/(^|;)\s*fill-opacity\s*:[^;]*/gi, '$1')
  .replace(/;;+/g, ';')
  .replace(/^;/, '')
  .trim()

const parseStyleProperty = (style: string, prop: string): string | null => {
  const m = style.match(new RegExp(`(^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))
  return m?.[2]?.trim() ?? null
}

const normalizeStrokeKey = (el: Element): { key: string; width: number } => {
  const style = el.getAttribute('style') ?? ''
  const stroke = (parseStyleProperty(style, 'stroke') ?? el.getAttribute('stroke') ?? '').trim().toLowerCase()
  const widthRaw = (parseStyleProperty(style, 'stroke-width') ?? el.getAttribute('stroke-width') ?? '0').trim()
  const width = Number(widthRaw) || 0
  const opacity = (parseStyleProperty(style, 'stroke-opacity') ?? el.getAttribute('stroke-opacity') ?? '1').trim()
  return {
    key: `${stroke}|${width.toFixed(3)}|${opacity}`,
    width,
  }
}

const stripOuterSvg = (serialized: string): string =>
  serialized.replace(/^<svg[^>]*>/i, '').replace(/<\/svg>$/i, '')

const toNumbers = (raw: string): number[] =>
  Array.from(raw.matchAll(/[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/gi), (m) => Number(m[0]))

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

const parseTransform = (raw: string): Mat2D => {
  let out: Mat2D = IDENTITY
  const re = /(matrix|translate|scale|rotate)\(([^)]+)\)/gi
  const parts = Array.from(raw.matchAll(re))
  for (const part of parts) {
    const fn = (part[1] ?? '').toLowerCase()
    const nums = toNumbers(part[2] ?? '')
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

const getApproxBounds = (el: Element): { width: number; height: number; area: number } | null => {
  const tag = el.tagName.toLowerCase()
  if (tag === 'line') {
    const x1 = Number(el.getAttribute('x1') ?? '0')
    const y1 = Number(el.getAttribute('y1') ?? '0')
    const x2 = Number(el.getAttribute('x2') ?? '0')
    const y2 = Number(el.getAttribute('y2') ?? '0')
    const width = Math.abs(x2 - x1)
    const height = Math.abs(y2 - y1)
    return { width, height, area: width * height }
  }
  if (tag === 'rect') {
    const width = Number(el.getAttribute('width') ?? '0')
    const height = Number(el.getAttribute('height') ?? '0')
    return { width, height, area: width * height }
  }
  if (tag === 'circle') {
    const r = Number(el.getAttribute('r') ?? '0')
    const d = r * 2
    return { width: d, height: d, area: d * d }
  }
  if (tag === 'ellipse') {
    const rx = Number(el.getAttribute('rx') ?? '0')
    const ry = Number(el.getAttribute('ry') ?? '0')
    return { width: rx * 2, height: ry * 2, area: rx * 2 * ry * 2 }
  }

  const pointsAttr = el.getAttribute('points')
  if (pointsAttr) {
    const nums = toNumbers(pointsAttr)
    if (nums.length < 2) return null
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < nums.length - 1; i += 2) {
      xs.push(nums[i] ?? 0)
      ys.push(nums[i + 1] ?? 0)
    }
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = maxX - minX
    const height = maxY - minY
    return { width, height, area: width * height }
  }

  const d = el.getAttribute('d')
  if (!d) return null
  const nums = toNumbers(d)
  if (nums.length < 2) return null
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < nums.length - 1; i += 2) {
    xs.push(nums[i] ?? 0)
    ys.push(nums[i + 1] ?? 0)
  }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY
  return { width, height, area: width * height }
}

const quantizePointKey = (x: number, y: number): string =>
  `${Math.round(x * 2)}:${Math.round(y * 2)}`

const PATH_TOKEN_RE = /[AaCcHhLlMmQqSsTtVvZz]|[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/g

const isPathCommand = (token: string): boolean => /^[AaCcHhLlMmQqSsTtVvZz]$/.test(token)

const collectPathPoints = (d: string): { x: number; y: number }[] => {
  const tokens = Array.from(d.matchAll(PATH_TOKEN_RE), (m) => m[0] ?? '')
  const points: { x: number; y: number }[] = []
  let i = 0
  let cmd = ''
  let curX = 0
  let curY = 0
  let startX = 0
  let startY = 0

  const canReadNumber = (): boolean => i < tokens.length && !isPathCommand(tokens[i] ?? '')
  const readNumber = (): number | null => {
    if (!canReadNumber()) return null
    const n = Number(tokens[i] ?? '')
    i += 1
    return Number.isFinite(n) ? n : null
  }

  while (i < tokens.length) {
    const t = tokens[i] ?? ''
    if (isPathCommand(t)) {
      cmd = t
      i += 1
    } else if (!cmd) {
      break
    }

    const rel = cmd === cmd.toLowerCase()
    const upper = cmd.toUpperCase()

    if (upper === 'Z') {
      curX = startX
      curY = startY
      points.push({ x: curX, y: curY })
      continue
    }

    if (upper === 'M') {
      let first = true
      while (canReadNumber()) {
        const x = readNumber()
        const y = readNumber()
        if (x == null || y == null) break
        curX = rel ? curX + x : x
        curY = rel ? curY + y : y
        if (first) {
          startX = curX
          startY = curY
          first = false
        }
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'L') {
      while (canReadNumber()) {
        const x = readNumber()
        const y = readNumber()
        if (x == null || y == null) break
        curX = rel ? curX + x : x
        curY = rel ? curY + y : y
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'H') {
      while (canReadNumber()) {
        const x = readNumber()
        if (x == null) break
        curX = rel ? curX + x : x
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'V') {
      while (canReadNumber()) {
        const y = readNumber()
        if (y == null) break
        curY = rel ? curY + y : y
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'C') {
      while (canReadNumber()) {
        const _x1 = readNumber()
        const _y1 = readNumber()
        const _x2 = readNumber()
        const _y2 = readNumber()
        const x = readNumber()
        const y = readNumber()
        if (_x1 == null || _y1 == null || _x2 == null || _y2 == null || x == null || y == null) break
        curX = rel ? curX + x : x
        curY = rel ? curY + y : y
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'S' || upper === 'Q') {
      while (canReadNumber()) {
        const _x1 = readNumber()
        const _y1 = readNumber()
        const x = readNumber()
        const y = readNumber()
        if (_x1 == null || _y1 == null || x == null || y == null) break
        curX = rel ? curX + x : x
        curY = rel ? curY + y : y
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'T') {
      while (canReadNumber()) {
        const x = readNumber()
        const y = readNumber()
        if (x == null || y == null) break
        curX = rel ? curX + x : x
        curY = rel ? curY + y : y
        points.push({ x: curX, y: curY })
      }
      continue
    }

    if (upper === 'A') {
      while (canReadNumber()) {
        const _rx = readNumber()
        const _ry = readNumber()
        const _rot = readNumber()
        const _largeArc = readNumber()
        const _sweep = readNumber()
        const x = readNumber()
        const y = readNumber()
        if (_rx == null || _ry == null || _rot == null || _largeArc == null || _sweep == null || x == null || y == null) break
        curX = rel ? curX + x : x
        curY = rel ? curY + y : y
        points.push({ x: curX, y: curY })
      }
      continue
    }

    // Unknown command: consume one token to avoid infinite loops.
    i += 1
  }

  return points
}

const collectShapePoints = (el: Element): { x: number; y: number }[] => {
  const tag = el.tagName.toLowerCase()

  if (tag === 'line') {
    const x1 = Number(el.getAttribute('x1') ?? '0')
    const y1 = Number(el.getAttribute('y1') ?? '0')
    const x2 = Number(el.getAttribute('x2') ?? '0')
    const y2 = Number(el.getAttribute('y2') ?? '0')
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }]
  }

  if (tag === 'rect') {
    const x = Number(el.getAttribute('x') ?? '0')
    const y = Number(el.getAttribute('y') ?? '0')
    const w = Number(el.getAttribute('width') ?? '0')
    const h = Number(el.getAttribute('height') ?? '0')
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }

  if (tag === 'circle') {
    const cx = Number(el.getAttribute('cx') ?? '0')
    const cy = Number(el.getAttribute('cy') ?? '0')
    const r = Number(el.getAttribute('r') ?? '0')
    return [
      { x: cx - r, y: cy },
      { x: cx + r, y: cy },
      { x: cx, y: cy - r },
      { x: cx, y: cy + r },
    ]
  }

  if (tag === 'ellipse') {
    const cx = Number(el.getAttribute('cx') ?? '0')
    const cy = Number(el.getAttribute('cy') ?? '0')
    const rx = Number(el.getAttribute('rx') ?? '0')
    const ry = Number(el.getAttribute('ry') ?? '0')
    return [
      { x: cx - rx, y: cy },
      { x: cx + rx, y: cy },
      { x: cx, y: cy - ry },
      { x: cx, y: cy + ry },
    ]
  }

  const pointsAttr = el.getAttribute('points')
  if (pointsAttr) {
    const nums = toNumbers(pointsAttr)
    const points: { x: number; y: number }[] = []
    for (let i = 0; i < nums.length - 1; i += 2) {
      points.push({ x: nums[i] ?? 0, y: nums[i + 1] ?? 0 })
    }
    return points
  }

  const d = el.getAttribute('d')
  if (!d) return []
  return collectPathPoints(d)
}

const collectAnchorMap = (root: Element): Map<string, { x: number; y: number }> => {
  const map = new Map<string, { x: number; y: number }>()
  const shapes = Array.from(root.querySelectorAll(SHAPE_SELECTOR))
  for (const shape of shapes) {
    if (inDefsOrSymbol(shape) || !hasDrawableStroke(shape)) continue
    const tf = getElementTransform(shape)
    const points = collectShapePoints(shape)
    for (const p of points) {
      const world = applyMat(tf, p.x, p.y)
      const key = quantizePointKey(world.x, world.y)
      if (!map.has(key)) map.set(key, world)
    }
  }
  return map
}

const spatialKey = (x: number, y: number, cellSize: number): string =>
  `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`

const buildSpatialIndex = (
  points: { x: number; y: number }[],
  cellSize: number,
): Map<string, { x: number; y: number }[]> => {
  const index = new Map<string, { x: number; y: number }[]>()
  for (const p of points) {
    const key = spatialKey(p.x, p.y, cellSize)
    const bucket = index.get(key)
    if (bucket) {
      bucket.push(p)
    } else {
      index.set(key, [p])
    }
  }
  return index
}

const findNearestPoint = (
  point: { x: number; y: number },
  index: Map<string, { x: number; y: number }[]>,
  cellSize: number,
  tolerance: number,
): { x: number; y: number } | null => {
  const cx = Math.floor(point.x / cellSize)
  const cy = Math.floor(point.y / cellSize)
  let best: { x: number; y: number } | null = null
  let bestD2 = tolerance * tolerance
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const key = `${cx + ox}:${cy + oy}`
      const bucket = index.get(key)
      if (!bucket) continue
      for (const cand of bucket) {
        const dx = cand.x - point.x
        const dy = cand.y - point.y
        const d2 = dx * dx + dy * dy
        if (d2 > bestD2) continue
        bestD2 = d2
        best = cand
      }
    }
  }
  return best
}

const stripLikelySymbols = (root: Element): void => {
  const shapes = Array.from(root.querySelectorAll(SHAPE_SELECTOR))
  for (const shape of shapes) {
    if (inDefsOrSymbol(shape)) continue
    const box = getApproxBounds(shape)
    if (!box) continue
    const likelySmallIcon =
      box.width >= 2 &&
      box.height >= 2 &&
      box.width <= 14 &&
      box.height <= 14 &&
      box.area <= 150
    if (likelySmallIcon) {
      shape.remove()
    }
  }
}

const tintLayerClone = (layerRoot: Element, color: string): void => {
  const nodes = Array.from(layerRoot.querySelectorAll(SHAPE_SELECTOR))
  for (const n of nodes) {
    if (!hasDrawableStroke(n)) {
      n.remove()
      continue
    }

    const style = n.getAttribute('style') ?? ''
    const cleaned = stripFillStyle(style)
    const nextStyle = `${cleaned}${cleaned.length > 0 ? ';' : ''}fill:${color};fill-opacity:0.24;`
    n.setAttribute('style', nextStyle)
    n.setAttribute('fill', color)
    n.setAttribute('fill-opacity', '0.24')
  }
}

const removeEmptyGroups = (root: Element): void => {
  const groups = Array.from(root.querySelectorAll('g')).reverse()
  for (const g of groups) {
    if (g.querySelector(SHAPE_SELECTOR)) continue
    if (g.children.length > 0) continue
    g.remove()
  }
}

const buildStyleLayers = (root: Element): StructuralLayer[] => {
  const shapes = Array.from(root.querySelectorAll(SHAPE_SELECTOR))
    .filter((s) => !inDefsOrSymbol(s))
    .filter(hasDrawableStroke)

  const buckets = new Map<string, { count: number; width: number }>()
  for (const shape of shapes) {
    const info = normalizeStrokeKey(shape)
    const prev = buckets.get(info.key)
    if (prev) {
      prev.count += 1
    } else {
      buckets.set(info.key, { count: 1, width: info.width })
    }
  }

  const selected = Array.from(buckets.entries())
    .map(([key, meta]) => ({ key, ...meta }))
    .filter((x) => x.count >= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return selected.map((bucket, index) => {
    const layerRoot = root.cloneNode(true) as Element
    const layerShapes = Array.from(layerRoot.querySelectorAll(SHAPE_SELECTOR))
    for (const shape of layerShapes) {
      if (inDefsOrSymbol(shape) || !hasDrawableStroke(shape)) {
        shape.remove()
        continue
      }
      if (normalizeStrokeKey(shape).key !== bucket.key) {
        shape.remove()
      }
    }

    const color = PALETTE[index % PALETTE.length] ?? '#9ec5fe'
    tintLayerClone(layerRoot, color)
    removeEmptyGroups(layerRoot)
    const serialized = new XMLSerializer().serializeToString(layerRoot)

    return {
      id: `layer-style-${index + 1}`,
      pathCount: bucket.count,
      depth: index,
      height: 18 + index * 16 + Math.round(bucket.width * 18),
      color,
      svgMarkup: stripOuterSvg(serialized),
    }
  })
}

const selectStructuralGroups = (root: Element): Element[] => {
  const candidates = Array.from(root.querySelectorAll('g'))
    .filter((g) => !inDefsOrSymbol(g))
    .map((g) => ({ node: g, count: countDrawableShapes(g), depth: depthFromRoot(g) }))
    .filter((x) => x.count >= 20)
    .sort((a, b) => b.count - a.count || a.depth - b.depth)

  const selected: Element[] = []
  for (const c of candidates) {
    if (selected.some((s) => s.contains(c.node) || c.node.contains(s))) continue
    selected.push(c.node)
    if (selected.length >= 8) break
  }
  return selected
}

export const analyzeStructuralGroups = (
  rawSvg: string,
  options: StructuralAnalysisOptions = {},
): StructuralAnalysis => {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  if (options.hideNonBuildingSymbols !== false) {
    stripLikelySymbols(root)
  }
  const viewBox = root.getAttribute('viewBox') ?? '0 0 595.276 841.89'
  const defs = root.querySelector('defs')
  const defsMarkup = defs ? new XMLSerializer().serializeToString(defs) : ''
  const selectedGroups = selectStructuralGroups(root)
  const layerAnchors: Map<string, { x: number; y: number }>[] = []

  const groupLayers = selectedGroups.map((g, index) => {
    const clone = g.cloneNode(true) as Element
    const color = PALETTE[index % PALETTE.length] ?? '#9ec5fe'
    tintLayerClone(clone, color)
    removeEmptyGroups(clone)

    const pathCount = countDrawableShapes(g)
    const depth = depthFromRoot(g)
    const height = (index + 1) * 12 + depth * 2
    const layerMarkup = new XMLSerializer().serializeToString(clone)
    layerAnchors.push(collectAnchorMap(clone))

    return {
      id: `layer-${index + 1}`,
      pathCount,
      depth,
      height,
      color,
      svgMarkup: `${defsMarkup}${layerMarkup}`,
    }
  })

  const layers = groupLayers.length <= 1
    ? (() => {
      const built = buildStyleLayers(root)
      layerAnchors.length = 0
      for (const layer of built) {
        const parsed = new DOMParser().parseFromString(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
            layer.svgMarkup,
            '</svg>',
          ].join(''),
          'image/svg+xml',
        )
        layerAnchors.push(collectAnchorMap(parsed.documentElement))
      }
      return built
    })()
    : groupLayers

  const connectors: StructuralConnector[] = []
  const pairLimit = 1200
  for (let i = 0; i < layers.length - 1; i += 1) {
    const from = layers[i]
    const to = layers[i + 1]
    const fromAnchors = layerAnchors[i]
    const toAnchors = layerAnchors[i + 1]
    if (!fromAnchors || !toAnchors) continue
    const toPoints = Array.from(toAnchors.values())
    const toIndex = buildSpatialIndex(toPoints, 4)
    const tolerance = 4
    let count = 0
    for (const [key, point] of fromAnchors.entries()) {
      const exact = toAnchors.get(key)
      const p2 = exact ?? findNearestPoint(point, toIndex, 4, tolerance)
      if (!p2) continue
      connectors.push({
        xFrom: point.x,
        yFrom: point.y,
        xTo: p2.x,
        yTo: p2.y,
        x: (point.x + p2.x) / 2,
        y: (point.y + p2.y) / 2,
        zFrom: from.height,
        zTo: to.height,
      })
      count += 1
      if (count >= pairLimit) break
    }
  }

  return {
    viewBox,
    baseStrokeSvg: extractStrokeOnlySvg(rawSvg),
    layers,
    connectors,
  }
}
