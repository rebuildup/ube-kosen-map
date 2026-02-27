import type { Vec2 } from '../../math'

const TOKEN_PATTERN = /([a-zA-Z])|([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)/g

const pair = (a: number, b: number): Vec2 => ({ x: a, y: b })

const samePoint = (a: Vec2 | null, b: Vec2): boolean =>
  a !== null && a.x === b.x && a.y === b.y

export const pathToPolyline = (d: string): Vec2[] => {
  const tokens = Array.from(d.matchAll(TOKEN_PATTERN), (m) => m[0])
  const points: Vec2[] = []

  let i = 0
  let cmd = ''
  let current = pair(0, 0)
  let subpathStart = pair(0, 0)

  const push = (p: Vec2): void => {
    const last = points.at(-1) ?? null
    if (!samePoint(last, p)) points.push(p)
  }

  const readNum = (): number => {
    const token = tokens[i]
    if (token === undefined) return Number.NaN
    i += 1
    return Number(token)
  }

  while (i < tokens.length) {
    const token = tokens[i]
    if (token === undefined) break
    if (/^[a-zA-Z]$/.test(token)) {
      cmd = token
      i += 1
      continue
    }

    switch (cmd) {
      case 'M': {
        const x = readNum()
        const y = readNum()
        current = pair(x, y)
        subpathStart = current
        push(current)
        cmd = 'L'
        break
      }
      case 'm': {
        const x = current.x + readNum()
        const y = current.y + readNum()
        current = pair(x, y)
        subpathStart = current
        push(current)
        cmd = 'l'
        break
      }
      case 'L': {
        current = pair(readNum(), readNum())
        push(current)
        break
      }
      case 'l': {
        current = pair(current.x + readNum(), current.y + readNum())
        push(current)
        break
      }
      case 'H': {
        current = pair(readNum(), current.y)
        push(current)
        break
      }
      case 'h': {
        current = pair(current.x + readNum(), current.y)
        push(current)
        break
      }
      case 'V': {
        current = pair(current.x, readNum())
        push(current)
        break
      }
      case 'v': {
        current = pair(current.x, current.y + readNum())
        push(current)
        break
      }
      case 'C': {
        readNum(); readNum()
        readNum(); readNum()
        current = pair(readNum(), readNum())
        push(current)
        break
      }
      case 'c': {
        readNum(); readNum()
        readNum(); readNum()
        current = pair(current.x + readNum(), current.y + readNum())
        push(current)
        break
      }
      case 'S': {
        readNum(); readNum()
        current = pair(readNum(), readNum())
        push(current)
        break
      }
      case 's': {
        readNum(); readNum()
        current = pair(current.x + readNum(), current.y + readNum())
        push(current)
        break
      }
      case 'Q': {
        readNum(); readNum()
        current = pair(readNum(), readNum())
        push(current)
        break
      }
      case 'q': {
        readNum(); readNum()
        current = pair(current.x + readNum(), current.y + readNum())
        push(current)
        break
      }
      case 'T': {
        current = pair(readNum(), readNum())
        push(current)
        break
      }
      case 't': {
        current = pair(current.x + readNum(), current.y + readNum())
        push(current)
        break
      }
      case 'A': {
        readNum(); readNum(); readNum(); readNum(); readNum()
        current = pair(readNum(), readNum())
        push(current)
        break
      }
      case 'a': {
        readNum(); readNum(); readNum(); readNum(); readNum()
        current = pair(current.x + readNum(), current.y + readNum())
        push(current)
        break
      }
      case 'Z':
      case 'z': {
        current = subpathStart
        push(current)
        break
      }
      default: {
        // Unknown command or malformed segment; consume one token and continue.
        i += 1
      }
    }
  }

  return points
}
