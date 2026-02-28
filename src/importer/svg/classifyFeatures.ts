// src/importer/svg/classifyFeatures.ts
import type { Segment, SegmentKind } from './parseSvgSegments'

const VALID_KINDS: SegmentKind[] = ['building', 'road', 'door', 'balcony', 'other']
const isValidKind = (v: string): v is SegmentKind => VALID_KINDS.includes(v as SegmentKind)

function buildDataKindMap(rawSvg: string): Map<string, SegmentKind> {
  const map = new Map<string, SegmentKind>()
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  const els = doc.querySelectorAll('[id][data-kind]')
  for (const el of els) {
    const id = el.getAttribute('id')
    const kind = el.getAttribute('data-kind') as SegmentKind
    if (id && isValidKind(kind)) map.set(id, kind)
  }
  return map
}

// Order matters: BA must be checked before B
function classifyByIdPrefix(id: string): SegmentKind {
  if (/^BA/i.test(id)) return 'balcony'
  if (/^B/i.test(id)) return 'building'
  if (/^R/i.test(id)) return 'road'
  if (/^D/i.test(id)) return 'door'
  return 'other'
}

export function classifySegments(segments: Segment[], rawSvg: string): Segment[] {
  const dataKindMap = buildDataKindMap(rawSvg)
  return segments.map(seg => {
    if (seg.featureId && dataKindMap.has(seg.featureId)) {
      return { ...seg, kind: dataKindMap.get(seg.featureId) }
    }
    if (seg.featureId) {
      return { ...seg, kind: classifyByIdPrefix(seg.featureId) }
    }
    return { ...seg, kind: 'other' }
  })
}
