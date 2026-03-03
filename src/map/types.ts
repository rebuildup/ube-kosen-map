// src/map/types.ts
export interface Coordinate { x: number; y: number }
export interface ViewBox { x: number; y: number; width: number; height: number }

export interface MapLayer {
  id: string        // "_00", "_01", ... "frame"
  index: number     // 0, 1, ... 12
  label: string     // "00", "01", ... "frame"
  svgContent: string // serialized child nodes of the <g> element
}

export interface InteractivePoint {
  id: string
  coordinates: Coordinate
  title: string
  type: string       // "event" | "exhibit" | "room" | "toilet" | "trash" | etc
  color?: string
  floorIndex?: number // which layer this point belongs to
  contentItem?: unknown
  onClick?: () => void
}

export interface PointCluster {
  id: string
  coordinates: Coordinate
  points: InteractivePoint[]
  count: number
}

export type LabelPosition = 'left' | 'right'
