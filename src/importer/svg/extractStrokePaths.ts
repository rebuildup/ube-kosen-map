import type { StrokePath } from './types'

const STROKE_WIDTH_PATTERN = /stroke-width\s*:\s*([0-9.]+)/i

const parseStrokeWidth = (style: string): number => {
  const m = style.match(STROKE_WIDTH_PATTERN)
  return m ? Number(m[1]) : 0
}

export const extractStrokePaths = (rawSvg: string): StrokePath[] => {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')

  return Array.from(doc.querySelectorAll('path'))
    .map((node) => ({
      d: node.getAttribute('d') ?? '',
      style: node.getAttribute('style') ?? '',
    }))
    .filter((p) => p.d.length > 0)
    .filter((p) => /fill\s*:\s*none/i.test(p.style))
    .filter((p) => !/stroke\s*:\s*none/i.test(p.style))
    .map((p) => ({
      ...p,
      strokeWidth: parseStrokeWidth(p.style),
    }))
}
