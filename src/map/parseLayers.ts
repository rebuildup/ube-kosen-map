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
  const svgEl = doc.querySelector('svg')!

  // Parse viewBox
  const vb = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 470.53, 710.52]
  const viewBox: ViewBox = { x: vb[0], y: vb[1], width: vb[2], height: vb[3] }

  // Extract styles from <defs><style>
  const styleEls = svgEl.querySelectorAll('defs style')
  const styles = Array.from(styleEls).map(el => el.textContent ?? '').join('\n')

  // Extract layers (top-level <g> elements with id)
  const groups = svgEl.querySelectorAll(':scope > g[id]')
  const serializer = new XMLSerializer()
  const layers: MapLayer[] = Array.from(groups).map((g, index) => {
    const id = g.getAttribute('id') ?? `layer_${index}`
    const label = id.startsWith('_') ? id.slice(1) : id
    // Serialize children (innerHTML equivalent for XML)
    const svgContent = Array.from(g.childNodes)
      .map(node => serializer.serializeToString(node))
      .join('')
    return { id, index, label, svgContent }
  })

  return { viewBox, styles, layers }
}
