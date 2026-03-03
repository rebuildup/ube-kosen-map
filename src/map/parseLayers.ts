// src/map/parseLayers.ts
import type { MapLayer, ViewBox } from './types'

export interface ParsedMap {
  viewBox: ViewBox
  styles: string
  layers: MapLayer[]
}

export function parseLayers(rawSvg: string): ParsedMap {
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml')

  // Detect XML parse errors
  if (doc.querySelector('parsererror')) {
    throw new Error('parseLayers: invalid SVG — XML parsing failed')
  }

  const svgEl = doc.querySelector('svg')
  if (!svgEl) throw new Error('parseLayers: root <svg> element not found')

  // Parse and validate viewBox
  const vbStr = svgEl.getAttribute('viewBox')
  if (!vbStr) throw new Error('parseLayers: missing viewBox attribute')
  const parts = vbStr.trim().split(/\s+/).map(Number)
  if (parts.length !== 4 || parts.some(n => isNaN(n))) {
    throw new Error(`parseLayers: invalid viewBox "${vbStr}"`)
  }
  const viewBox: ViewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }

  // Extract styles from <defs><style>
  const styleEls = svgEl.querySelectorAll('defs style')
  const styles = Array.from(styleEls).map(el => el.textContent ?? '').join('\n')

  // Extract layers (top-level <g> elements with id)
  const groups = svgEl.querySelectorAll(':scope > g[id]')
  const serializer = new XMLSerializer()
  const layers: MapLayer[] = Array.from(groups).map((g, index) => {
    const id = g.getAttribute('id') ?? `layer_${index}`
    const label = id.startsWith('_') ? id.slice(1) : id
    // Serialize child nodes (innerHTML equivalent for XML)
    const svgContent = Array.from(g.childNodes)
      .map(node => serializer.serializeToString(node))
      .join('')
    return { id, index, label, svgContent }
  })

  return { viewBox, styles, layers }
}
