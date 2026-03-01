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

export interface Page1InspectConfig {
  _description?: string
  keepGroups: number[]
  hiddenPathRanges: Array<{ group?: number; start: number; end: number }>
  pathStatus: Record<string, PathStatus>
  customShapes: CustomShape[]
  /** 非表示にしたシェイプの id 一覧。保存・読込で保持する。 */
  hiddenShapeIds?: string[]
}

export function createEmptyConfig(): Page1InspectConfig {
  return {
    keepGroups: [4, 12, 13, 14],
    hiddenPathRanges: [{ group: 4, start: 96, end: 1090 }],
    pathStatus: {},
    customShapes: [],
    hiddenShapeIds: [],
  }
}
