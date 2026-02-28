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
  let currentCmd = ''
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (/^[MmLlHhVvCcSsQqTtAaZz]$/.test(trimmed)) {
      currentCmd = trimmed
      segments.push({ cmd: trimmed, nums: [] })
    } else {
      // Numbers for the current command
      const nums = trimmed.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))
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

    for (const li of localIndices) {
      const info = pathInfos[li]!
      const startKey = hashKey(info.startPt[0], info.startPt[1])
      const endKey = hashKey(info.endPt[0], info.endPt[1])

      endpointCount.set(startKey, (endpointCount.get(startKey) ?? 0) + 1)
      if (startKey !== endKey) {
        endpointCount.set(endKey, (endpointCount.get(endKey) ?? 0) + 1)
      }
      // isClosed paths contribute both start and end as the same point (already counted once above)
      // For a closed path alone, its single endpoint appears once → not fully connected to others
    }

    const isClosed = Array.from(endpointCount.values()).every(c => c >= 2)

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

export function groupSvgPaths(rawSvg: string): GroupedSvgPaths {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox') ?? '0 0 100 100'

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
    const startPt: [number, number] = endpoints ? endpoints.start : [0, 0]
    const endPt: [number, number] = endpoints ? endpoints.end : [0, 0]
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
    shapes: buildShapes(i, groupElements[i]!, g.paths),
  }))

  const svgInnerHTML = root.innerHTML

  return { groups, svgInnerHTML, viewBox }
}
