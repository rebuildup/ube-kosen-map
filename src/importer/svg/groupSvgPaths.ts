export interface PathInfo {
  pathIndex: number
  startPt: [number, number]
  endPt: [number, number]
  isClosed: boolean
}

export interface ShapeGroup {
  shapeIndex: number
  paths: PathInfo[]
  isClosed: boolean
}

export interface StyleGroup {
  index: number
  strokeColor: string
  strokeWidth: string
  fillColor: string
  count: number
  paths: PathInfo[]
  shapes: ShapeGroup[]
}

export interface GroupedSvgPaths {
  groups: StyleGroup[]
  svgInnerHTML: string
  viewBox: string
}

const SHAPE_SEL = 'path,polyline,polygon,line'
type Mat2D = [number, number, number, number, number, number] // a,b,c,d,e,f
const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0]

function inDefsOrSymbol(el: Element): boolean {
  return Boolean(el.closest('defs') || el.closest('symbol'))
}

function extractStyle(el: Element): { strokeColor: string; strokeWidth: string; fillColor: string } {
  const style = el.getAttribute('style') ?? ''
  const get = (prop: string): string => {
    const m = style.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'))
    return m ? m[1]!.trim() : ''
  }
  const strokeColor = get('stroke') || el.getAttribute('stroke') || 'none'
  const strokeWidth = get('stroke-width') || el.getAttribute('stroke-width') || '1'
  const fillColor   = get('fill')   || el.getAttribute('fill')   || 'none'
  return {
    strokeColor: strokeColor.trim().toLowerCase(),
    strokeWidth: strokeWidth.trim(),
    fillColor:   fillColor.trim().toLowerCase(),
  }
}

function toNumbers(raw: string): number[] {
  return Array.from(raw.matchAll(/[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/gi), (m) => Number(m[0]))
}

function mul(m1: Mat2D, m2: Mat2D): Mat2D {
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

function applyMat(m: Mat2D, x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = m
  return [a * x + c * y + e, b * x + d * y + f]
}

function parseTransform(raw: string): Mat2D {
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

function getElementTransform(el: Element): Mat2D {
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

// Parse space/comma-separated number list from SVG points attribute
function parsePoints(pts: string): [number, number][] {
  const nums = pts.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
  const result: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    result.push([nums[i]!, nums[i + 1]!])
  }
  return result
}

// Tokenize SVG path d attribute into [command, ...numbers] segments
function tokenizePathD(d: string): Array<{ cmd: string; nums: number[] }> {
  const segments: Array<{ cmd: string; nums: number[] }> = []
  // Split on command letters, keeping the delimiter
  const parts = d.trim().split(/([MmLlHhVvCcSsQqTtAaZz])/)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(trimmed)) {
      segments.push({ cmd: trimmed, nums: [] })
    } else {
      // Numbers for the current command
      // Use regex to handle sign-separated numbers like "85.04-40.07" (common in PDF-exported SVG)
      const nums = Array.from(
        trimmed.matchAll(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g),
        m => Number(m[0]),
      )
      if (nums.length > 0 && segments.length > 0) {
        segments[segments.length - 1]!.nums.push(...nums)
      }
    }
  }
  return segments
}

function extractPathDEndpoints(
  d: string
): { start: [number, number]; end: [number, number]; isClosed: boolean } | null {
  const segments = tokenizePathD(d)
  if (segments.length === 0) return null

  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let subpathStartX = 0
  let subpathStartY = 0
  let hasStart = false
  let isClosed = false

  for (const seg of segments) {
    const { cmd, nums } = seg

    switch (cmd) {
      case 'M': {
        // Absolute moveto; implicit L for subsequent pairs
        for (let i = 0; i + 1 < nums.length; i += 2) {
          cx = nums[i]!
          cy = nums[i + 1]!
          if (!hasStart) {
            startX = cx; startY = cy
            subpathStartX = cx; subpathStartY = cy
            hasStart = true
          } else if (i === 0) {
            // New subpath start
            subpathStartX = cx; subpathStartY = cy
          }
        }
        break
      }
      case 'm': {
        // Relative moveto
        for (let i = 0; i + 1 < nums.length; i += 2) {
          if (!hasStart) {
            cx = nums[i]!; cy = nums[i + 1]!
            startX = cx; startY = cy
            subpathStartX = cx; subpathStartY = cy
            hasStart = true
          } else {
            cx += nums[i]!; cy += nums[i + 1]!
            if (i === 0) {
              subpathStartX = cx; subpathStartY = cy
            }
          }
        }
        break
      }
      case 'L': {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          cx = nums[i]!; cy = nums[i + 1]!
        }
        break
      }
      case 'l': {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          cx += nums[i]!; cy += nums[i + 1]!
        }
        break
      }
      case 'H': {
        if (nums.length > 0) cx = nums[nums.length - 1]!
        break
      }
      case 'h': {
        for (const n of nums) cx += n
        break
      }
      case 'V': {
        if (nums.length > 0) cy = nums[nums.length - 1]!
        break
      }
      case 'v': {
        for (const n of nums) cy += n
        break
      }
      case 'C': {
        // Cubic bezier: 6 numbers per curve (x1 y1 x2 y2 x y)
        for (let i = 0; i + 5 < nums.length; i += 6) {
          cx = nums[i + 4]!; cy = nums[i + 5]!
        }
        break
      }
      case 'c': {
        for (let i = 0; i + 5 < nums.length; i += 6) {
          cx += nums[i + 4]!; cy += nums[i + 5]!
        }
        break
      }
      case 'S': {
        // Smooth cubic: 4 numbers per curve (x2 y2 x y)
        for (let i = 0; i + 3 < nums.length; i += 4) {
          cx = nums[i + 2]!; cy = nums[i + 3]!
        }
        break
      }
      case 's': {
        for (let i = 0; i + 3 < nums.length; i += 4) {
          cx += nums[i + 2]!; cy += nums[i + 3]!
        }
        break
      }
      case 'Q': {
        // Quadratic bezier: 4 numbers per curve (x1 y1 x y)
        for (let i = 0; i + 3 < nums.length; i += 4) {
          cx = nums[i + 2]!; cy = nums[i + 3]!
        }
        break
      }
      case 'q': {
        for (let i = 0; i + 3 < nums.length; i += 4) {
          cx += nums[i + 2]!; cy += nums[i + 3]!
        }
        break
      }
      case 'T': {
        // Smooth quadratic: 2 numbers per point
        for (let i = 0; i + 1 < nums.length; i += 2) {
          cx = nums[i]!; cy = nums[i + 1]!
        }
        break
      }
      case 't': {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          cx += nums[i]!; cy += nums[i + 1]!
        }
        break
      }
      case 'A': {
        // Arc: 7 numbers per arc (rx ry x-rotation large-arc-flag sweep-flag x y)
        for (let i = 0; i + 6 < nums.length; i += 7) {
          cx = nums[i + 5]!; cy = nums[i + 6]!
        }
        break
      }
      case 'a': {
        for (let i = 0; i + 6 < nums.length; i += 7) {
          cx += nums[i + 5]!; cy += nums[i + 6]!
        }
        break
      }
      case 'Z':
      case 'z': {
        cx = subpathStartX; cy = subpathStartY
        isClosed = true
        break
      }
    }
  }

  if (!hasStart) return null
  return { start: [startX, startY], end: [cx, cy], isClosed }
}

function extractElementEndpoints(
  el: Element
): { start: [number, number]; end: [number, number]; isClosed: boolean } | null {
  const tag = el.tagName.toLowerCase()

  if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') ?? '0')
    const y1 = parseFloat(el.getAttribute('y1') ?? '0')
    const x2 = parseFloat(el.getAttribute('x2') ?? '0')
    const y2 = parseFloat(el.getAttribute('y2') ?? '0')
    return { start: [x1, y1], end: [x2, y2], isClosed: false }
  }

  if (tag === 'polyline') {
    const pts = parsePoints(el.getAttribute('points') ?? '')
    if (pts.length === 0) return null
    return { start: pts[0]!, end: pts[pts.length - 1]!, isClosed: false }
  }

  if (tag === 'polygon') {
    const pts = parsePoints(el.getAttribute('points') ?? '')
    if (pts.length === 0) return null
    // Closed shape: start === end
    return { start: pts[0]!, end: pts[0]!, isClosed: true }
  }

  if (tag === 'path') {
    const d = el.getAttribute('d') ?? ''
    return extractPathDEndpoints(d)
  }

  return null
}

// Union-Find with path compression
function makeUnionFind(n: number): { parent: number[]; find: (i: number) => number; union: (a: number, b: number) => void } {
  const parent = Array.from({ length: n }, (_, i) => i)
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]!)
    return parent[i]!
  }
  function union(a: number, b: number): void {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  return { parent, find, union }
}

function buildShapes(
  groupIndex: number,
  elements: Element[],
  pathInfos: PathInfo[],
  epsilon: number = 1.0
): ShapeGroup[] {
  const n = pathInfos.length
  if (n === 0) return []

  const uf = makeUnionFind(n)

  // Spatial hash: rounded-coord key → list of path indices within this group
  const spatialHash = new Map<string, number[]>()

  function hashKey(x: number, y: number): string {
    return `${Math.round(x / epsilon)},${Math.round(y / epsilon)}`
  }

  function addToHash(key: string, localIdx: number): void {
    const existing = spatialHash.get(key)
    if (existing === undefined) {
      spatialHash.set(key, [localIdx])
    } else {
      // Union this path with all existing paths in the same bucket
      for (const other of existing) {
        uf.union(localIdx, other)
      }
      existing.push(localIdx)
    }
  }

  for (let li = 0; li < n; li++) {
    const info = pathInfos[li]!
    const startKey = hashKey(info.startPt[0], info.startPt[1])
    const endKey = hashKey(info.endPt[0], info.endPt[1])
    addToHash(startKey, li)
    // For closed paths start === end, avoid double-adding same index
    if (startKey !== endKey) {
      addToHash(endKey, li)
    }
  }

  // Group local indices by root
  const componentMap = new Map<number, number[]>()
  for (let li = 0; li < n; li++) {
    const root = uf.find(li)
    const group = componentMap.get(root)
    if (group === undefined) {
      componentMap.set(root, [li])
    } else {
      group.push(li)
    }
  }

  // Determine isClosed for each component:
  // Count endpoint appearances; closed if ALL endpoints have ≥2 appearances
  const shapeGroups: ShapeGroup[] = []
  let shapeIdx = 0

  for (const [, localIndices] of componentMap) {
    const endpointCount = new Map<string, number>()
    // Keys that belong to a self-closed path (polygon / path with Z where start===end)
    const selfClosedKeys = new Set<string>()

    for (const li of localIndices) {
      const info = pathInfos[li]!
      const startKey = hashKey(info.startPt[0], info.startPt[1])
      const endKey = hashKey(info.endPt[0], info.endPt[1])

      endpointCount.set(startKey, (endpointCount.get(startKey) ?? 0) + 1)
      if (startKey !== endKey) {
        endpointCount.set(endKey, (endpointCount.get(endKey) ?? 0) + 1)
      }

      // Self-closed path: its endpoint is geometrically satisfied by itself
      if (info.isClosed) {
        selfClosedKeys.add(startKey)
        selfClosedKeys.add(endKey)
      }
    }

    // A key is satisfied if its count >= 2 OR it belongs to a self-closed path
    const isClosed = Array.from(endpointCount.keys()).every(
      key => (endpointCount.get(key) ?? 0) >= 2 || selfClosedKeys.has(key)
    )

    // Sort by pathIndex for stable output
    localIndices.sort((a, b) => pathInfos[a]!.pathIndex - pathInfos[b]!.pathIndex)

    const shapePaths = localIndices.map(li => pathInfos[li]!)

    // Assign data-ss to each DOM element in this shape
    for (const li of localIndices) {
      elements[li]!.setAttribute('data-ss', `${groupIndex}-${shapeIdx}`)
    }

    shapeGroups.push({
      shapeIndex: shapeIdx,
      paths: shapePaths,
      isClosed,
    })
    shapeIdx++
  }

  return shapeGroups
}

/** Parse viewBox "minX minY width height" and return { width, height } */
function parseViewBox(viewBox: string): { width: number; height: number } {
  const parts = viewBox.trim().split(/\s+/).map(Number)
  return {
    width: parts[2] ?? 100,
    height: parts[3] ?? 100,
  }
}

/** Epsilon for vertex connectivity: ~1% of smaller dimension, min 1. Catches PDF-export gaps. */
function connectivityEpsilon(viewBox: string): number {
  const { width, height } = parseViewBox(viewBox)
  const minDim = Math.min(width, height)
  return Math.max(1, minDim * 0.01)
}

export function groupSvgPaths(rawSvg: string): GroupedSvgPaths {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox') ?? '0 0 100 100'
  const epsilon = connectivityEpsilon(viewBox)

  const shapeElements = Array.from(root.querySelectorAll(SHAPE_SEL))
    .filter(el => !inDefsOrSymbol(el))

  const styleMap = new Map<string, number>()
  // Track elements per group for buildShapes
  const groupElements: Element[][] = []
  const groupAccum: Omit<StyleGroup, 'index' | 'shapes'>[] = []
  let globalPathIdx = 0

  for (const el of shapeElements) {
    const { strokeColor, strokeWidth, fillColor } = extractStyle(el)
    const key = `${strokeColor}|${strokeWidth}|${fillColor}`
    let idx = styleMap.get(key)
    if (idx === undefined) {
      idx = groupAccum.length
      styleMap.set(key, idx)
      groupAccum.push({ strokeColor, strokeWidth, fillColor, count: 0, paths: [] })
      groupElements.push([])
    }

    const endpoints = extractElementEndpoints(el)
    const tf = getElementTransform(el)
    const startPt: [number, number] = endpoints ? applyMat(tf, endpoints.start[0], endpoints.start[1]) : [0, 0]
    const endPt: [number, number] = endpoints ? applyMat(tf, endpoints.end[0], endpoints.end[1]) : [0, 0]
    const isClosed = endpoints ? endpoints.isClosed : false

    const pathIdx = globalPathIdx++
    groupAccum[idx]!.count++
    groupAccum[idx]!.paths.push({ pathIndex: pathIdx, startPt, endPt, isClosed })
    groupElements[idx]!.push(el)

    el.setAttribute('data-sg', String(idx))
    el.setAttribute('data-sp', String(pathIdx))
  }

  const groups: StyleGroup[] = groupAccum.map((g, i) => ({
    ...g,
    index: i,
    shapes: buildShapes(i, groupElements[i]!, g.paths, epsilon),
  }))

  const svgInnerHTML = root.innerHTML

  return { groups, svgInnerHTML, viewBox }
}
