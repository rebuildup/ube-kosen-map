// src/map/labelLayout.ts
import type { LabelPosition } from './types'

const LABEL_W = 160
const LABEL_H = 24
const PIN_W = 24
const PIN_H = 32

interface PinPosition { x: number; y: number; index: number }
interface LayoutOptions { viewportWidth: number; viewportHeight: number }
export interface LabelResult { index: number; direction: LabelPosition | null }
interface Rect { x: number; y: number; width: number; height: number }
interface Placed { index: number; direction: LabelPosition; rect: Rect }

function overlap(a: Rect, b: Rect, margin = 5): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width > b.x - margin &&
    a.y < b.y + b.height + margin &&
    a.y + a.height > b.y - margin
  )
}

function labelRect(pin: PinPosition, dir: LabelPosition): Rect {
  return {
    x: dir === 'right' ? pin.x + 32 : pin.x - 32 - LABEL_W,
    y: pin.y - LABEL_H / 2,
    width: LABEL_W,
    height: LABEL_H,
  }
}

function pinRect(pin: PinPosition): Rect {
  return { x: pin.x - PIN_W / 2, y: pin.y - PIN_H, width: PIN_W, height: PIN_H }
}

function isValid(
  rect: Rect,
  selfIdx: number,
  pins: PinPosition[],
  placed: Placed[],
): boolean {
  for (const p of pins) {
    if (p.index === selfIdx) continue
    if (overlap(rect, pinRect(p), 2)) return false
  }
  for (const pl of placed) {
    if (pl.index === selfIdx) continue
    if (overlap(rect, pl.rect)) return false
  }
  return true
}

function tryFlipChain(
  idx: number,
  dir: LabelPosition,
  pins: PinPosition[],
  placed: Placed[],
  visited: Set<number>,
  maxDepth: number,
): Placed[] | null {
  if (visited.size >= maxDepth || visited.has(idx)) return null
  const pin = pins.find(p => p.index === idx)
  if (!pin) return null
  const rect = labelRect(pin, dir)
  if (isValid(rect, idx, pins, placed)) {
    return [{ index: idx, direction: dir, rect }]
  }
  const conflicts = placed.filter(pl => overlap(rect, pl.rect))
  visited.add(idx)
  for (const c of conflicts) {
    const newDir: LabelPosition = c.direction === 'left' ? 'right' : 'left'
    const without = placed.filter(pl => pl.index !== c.index)
    const chain = tryFlipChain(c.index, newDir, pins, without, new Set(visited), maxDepth)
    if (chain) return [...chain, { index: idx, direction: dir, rect }]
  }
  visited.delete(idx)
  return null
}

export function computeLabelLayout(
  pins: PinPosition[],
  opts: LayoutOptions,
): LabelResult[] {
  if (pins.length === 0) return []

  const centerX = opts.viewportWidth / 2

  // Sort by distance from center — closest first (highest priority)
  const sorted = [...pins].sort((a, b) => {
    const cx = opts.viewportWidth / 2
    const cy = opts.viewportHeight / 2
    return Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)
  })

  const placed: Placed[] = []
  const resultMap = new Map<number, LabelPosition | null>()

  for (const pin of sorted) {
    const defDir: LabelPosition = pin.x > centerX ? 'left' : 'right'
    const oppDir: LabelPosition = defDir === 'left' ? 'right' : 'left'

    // 1. Try default direction
    let rect = labelRect(pin, defDir)
    if (isValid(rect, pin.index, pins, placed)) {
      placed.push({ index: pin.index, direction: defDir, rect })
      resultMap.set(pin.index, defDir)
      continue
    }

    // 2. Try opposite
    rect = labelRect(pin, oppDir)
    if (isValid(rect, pin.index, pins, placed)) {
      placed.push({ index: pin.index, direction: oppDir, rect })
      resultMap.set(pin.index, oppDir)
      continue
    }

    // 3. Chain flip (default)
    let chain = tryFlipChain(pin.index, defDir, pins, placed, new Set(), 3)
    if (chain) {
      const newLabel = chain.at(-1)!
      for (const upd of chain.slice(0, -1)) {
        const idx = placed.findIndex(p => p.index === upd.index)
        if (idx !== -1) { placed[idx] = upd; resultMap.set(upd.index, upd.direction) }
      }
      placed.push(newLabel)
      resultMap.set(pin.index, newLabel.direction)
      continue
    }

    // 4. Chain flip (opposite)
    chain = tryFlipChain(pin.index, oppDir, pins, placed, new Set(), 3)
    if (chain) {
      const newLabel = chain.at(-1)!
      for (const upd of chain.slice(0, -1)) {
        const idx = placed.findIndex(p => p.index === upd.index)
        if (idx !== -1) { placed[idx] = upd; resultMap.set(upd.index, upd.direction) }
      }
      placed.push(newLabel)
      resultMap.set(pin.index, newLabel.direction)
      continue
    }

    // 5. No valid placement — hide label
    resultMap.set(pin.index, null)
  }

  return pins.map(p => ({ index: p.index, direction: resultMap.get(p.index) ?? null }))
}
