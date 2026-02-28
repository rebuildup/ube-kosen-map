export interface StyleGroup {
  index: number
  strokeColor: string
  strokeWidth: string
  fillColor: string
  count: number
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

export function groupSvgPaths(rawSvg: string): GroupedSvgPaths {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox') ?? '0 0 100 100'

  const shapes = Array.from(root.querySelectorAll(SHAPE_SEL))
    .filter(el => !inDefsOrSymbol(el))

  const styleMap = new Map<string, number>()
  const groupAccum: Omit<StyleGroup, 'index'>[] = []

  for (const el of shapes) {
    const { strokeColor, strokeWidth, fillColor } = extractStyle(el)
    const key = `${strokeColor}|${strokeWidth}|${fillColor}`
    let idx = styleMap.get(key)
    if (idx === undefined) {
      idx = groupAccum.length
      styleMap.set(key, idx)
      groupAccum.push({ strokeColor, strokeWidth, fillColor, count: 0 })
    }
    groupAccum[idx]!.count++
    el.setAttribute('data-sg', String(idx))
  }

  const groups: StyleGroup[] = groupAccum.map((g, i) => ({ ...g, index: i }))
  const svgInnerHTML = root.innerHTML

  return { groups, svgInnerHTML, viewBox }
}
