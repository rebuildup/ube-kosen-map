import type { Vec2 } from '../../math'

export interface SvgProfile {
  pathCount: number
  useCount: number
  textCount: number
}

export interface StrokePath {
  d: string
  style: string
  strokeWidth: number
}

export interface SvgImportOptions {
  buildingName: string
  floorLevel: number
  mergeTolerance?: number
}

export type Polyline = Vec2[]
