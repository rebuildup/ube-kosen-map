const NON_GRAPHIC_TAGS = new Set([
  'svg', 'g', 'defs', 'symbol', 'clipPath', 'style', 'title', 'desc', 'metadata',
])

const stripFillFromStyle = (style: string): string => style
  .replace(/(^|;)\s*fill\s*:[^;]*/gi, '$1')
  .replace(/(^|;)\s*fill-rule\s*:[^;]*/gi, '$1')
  .replace(/(^|;)\s*fill-opacity\s*:[^;]*/gi, '$1')
  .replace(/;;+/g, ';')
  .replace(/^;/, '')
  .trim()

const isStrokeNone = (el: Element): boolean => {
  const style = el.getAttribute('style') ?? ''
  const strokeAttr = (el.getAttribute('stroke') ?? '').trim().toLowerCase()
  return /(^|;)\s*stroke\s*:\s*none\s*(;|$)/i.test(style) || strokeAttr === 'none'
}

const removeIfNonStroked = (el: Element): boolean => {
  const style = el.getAttribute('style') ?? ''
  const strokeAttr = (el.getAttribute('stroke') ?? '').trim()
  const hasStyleStroke = /(^|;)\s*stroke\s*:\s*[^;]+/i.test(style)
  const hasStrokeAttr = strokeAttr.length > 0 && strokeAttr.toLowerCase() !== 'none'
  return isStrokeNone(el) || (!hasStyleStroke && !hasStrokeAttr && el.tagName.toLowerCase() !== 'use')
}

export const extractStrokeOnlySvg = (rawSvg: string): string => {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const root = doc.documentElement

  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'image') {
      el.remove()
      continue
    }
    if (NON_GRAPHIC_TAGS.has(tag)) continue

    if (removeIfNonStroked(el)) {
      el.remove()
      continue
    }

    const style = el.getAttribute('style') ?? ''
    const nextStyle = stripFillFromStyle(style)
    if (nextStyle.length > 0) el.setAttribute('style', nextStyle)
    else el.removeAttribute('style')

    el.setAttribute('fill', 'none')
    el.removeAttribute('fill-rule')
    el.removeAttribute('fill-opacity')
  }

  return new XMLSerializer().serializeToString(root)
}
