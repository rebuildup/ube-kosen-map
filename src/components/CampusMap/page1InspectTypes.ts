/**
 * page1-inspect-config.json の型定義
 */
export type PathStatus = 'incomplete' | 'completed' | 'deleted'

export interface CustomShape {
  id: string
  pathIndices: number[]
  isClosed: boolean
  hasFill: boolean
  fillColor?: string
}

export interface ShapeVertexRef {
  pathIndex: number
  endpoint: 'start' | 'end'
}

export interface ShapeBridgeEdit {
  id: string
  from: ShapeVertexRef
  to: ShapeVertexRef
  kind?: 'manual-bridge' | 'manual-cut'
  note?: string
}

export interface ShapeRelation {
  fromShapeId: string
  toShapeId: string
  relation: 'adjacent' | 'connected' | 'contains' | 'overlaps' | 'composed'
  note?: string
}

export interface ShapeMergeEdit {
  id: string
  sourceShapeIds: string[]
  resultShapeId: string
  isClosed?: boolean
  hasFill?: boolean
  fillColor?: string
}

export interface ShapeSplitPart {
  id: string
  pathIndices: number[]
  isClosed?: boolean
  hasFill?: boolean
  fillColor?: string
}

export interface ShapeSplitEdit {
  id: string
  sourceShapeId: string
  parts: ShapeSplitPart[]
}

export interface ShapeEditConfig {
  bridges?: ShapeBridgeEdit[]
  removedVertices?: ShapeVertexRef[]
  relations?: ShapeRelation[]
  merges?: ShapeMergeEdit[]
  splits?: ShapeSplitEdit[]
}

export interface ShapeLayerDefinition {
  id: string
  name: string
  baseZ: number
  color?: string
}

export interface ShapePlacement {
  shapeId: string
  layerId: string
  height: number
}

export interface ShapeTransition {
  id: string
  kind: 'stairs' | 'slope'
  fromLayerId: string
  toLayerId: string
  lowerEdgePathIndices: number[]
  upperEdgePathIndices: number[]
  stepCount?: number
}

export interface Page1InspectConfig {
  _description?: string
  keepGroups: number[]
  hiddenPathRanges: Array<{ group?: number; start: number; end: number }>
  pathStatus: Record<string, PathStatus>
  shapeStatus?: Record<string, PathStatus>
  shapeHeights?: Record<string, number>
  shapeLayers?: ShapeLayerDefinition[]
  shapePlacements?: Record<string, ShapePlacement>
  shapeTransitions?: ShapeTransition[]
  customShapes: CustomShape[]
  /** 非表示にしたシェイプの id 一覧。保存・読込で保持する。 */
  hiddenShapeIds?: string[]
  /** シェイプ接続・合成・分割などの追加編集情報。 */
  shapeEdits?: ShapeEditConfig
}

export function createEmptyConfig(): Page1InspectConfig {
  return {
    keepGroups: [4, 12, 13, 14],
    hiddenPathRanges: [{ group: 4, start: 96, end: 1090 }],
    pathStatus: {},
    shapeStatus: {},
    shapeHeights: {},
    shapeLayers: [{ id: 'layer-ground', name: 'Ground', baseZ: 0, color: '#64748b' }],
    shapePlacements: {},
    shapeTransitions: [],
    customShapes: [],
    hiddenShapeIds: [],
    shapeEdits: {
      bridges: [],
      removedVertices: [],
      relations: [],
      merges: [],
      splits: [],
    },
  }
}
