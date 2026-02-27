# SVGから数理データ化パイプライン Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `docs/reference/page_1.svg` から、`CampusGraph` 互換の数理データ（nodes/edges/spaces）を再現可能な手順で生成できるようにする。

**Architecture:** 手動トレースUIではなく「SVG解析 → 幾何プリミティブ正規化 → グラフ合成 → バリデーション」の4段パイプラインを `src/importer/svg` に実装する。出力は `data/derived/page_1.graph.json` に固定し、`core/autocomplete` と `core/graph/validate` を通して品質を保証する。

**Tech Stack:** TypeScript, DOMParser (jsdom), Vitest, 既存 `src/math/*`, 既存 `src/core/{autocomplete,graph/schema}`

---

### Task 1: SVG解析対象の固定化（フィクスチャ + プロファイル）

**Files:**
- Create: `src/importer/svg/profilePageSvg.ts`
- Create: `src/importer/svg/profilePageSvg.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { profilePageSvg } from './profilePageSvg'

describe('profilePageSvg', () => {
  it('counts major SVG element types for page_1.svg', async () => {
    const profile = await profilePageSvg('docs/reference/page_1.svg')
    expect(profile.pathCount).toBeGreaterThan(8000)
    expect(profile.useCount).toBeGreaterThan(200)
    expect(profile.textCount).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/importer/svg/profilePageSvg.test.ts`
Expected: FAIL with module not found

**Step 3: Write minimal implementation**

```ts
import { readFileSync } from 'node:fs'

export interface SvgProfile {
  pathCount: number
  useCount: number
  textCount: number
}

export const profilePageSvg = async (filePath: string): Promise<SvgProfile> => {
  const raw = readFileSync(filePath, 'utf-8')
  return {
    pathCount: (raw.match(/<path(\s|>)/g) ?? []).length,
    useCount: (raw.match(/<use(\s|>)/g) ?? []).length,
    textCount: (raw.match(/<text(\s|>)/g) ?? []).length,
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/importer/svg/profilePageSvg.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/importer/svg/profilePageSvg.ts src/importer/svg/profilePageSvg.test.ts
git commit -m "test(importer): add page_1.svg profiling baseline"
```

### Task 2: SVG path抽出（図形候補のみを選別）

**Files:**
- Create: `src/importer/svg/extractStrokePaths.ts`
- Create: `src/importer/svg/extractStrokePaths.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { extractStrokePaths } from './extractStrokePaths'

describe('extractStrokePaths', () => {
  it('filters drawable stroke paths from page SVG', () => {
    const raw = `<svg><path d="M0,0L1,1" style="fill:none;stroke-width:0.27;"/><path d="M0,0L1,1" style="stroke:none;"/></svg>`
    const paths = extractStrokePaths(raw)
    expect(paths).toHaveLength(1)
    expect(paths[0].strokeWidth).toBeCloseTo(0.27)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/importer/svg/extractStrokePaths.test.ts`
Expected: FAIL with module not found

**Step 3: Write minimal implementation**

```ts
export interface StrokePath {
  d: string
  strokeWidth: number
  style: string
}

export const extractStrokePaths = (rawSvg: string): StrokePath[] => {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml')
  return Array.from(doc.querySelectorAll('path'))
    .map((el) => ({ d: el.getAttribute('d') ?? '', style: el.getAttribute('style') ?? '' }))
    .filter((p) => p.d.length > 0 && /fill\s*:\s*none/i.test(p.style) && !/stroke\s*:\s*none/i.test(p.style))
    .map((p) => {
      const m = p.style.match(/stroke-width\s*:\s*([0-9.]+)/i)
      return { ...p, strokeWidth: m ? Number(m[1]) : 0 }
    })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/importer/svg/extractStrokePaths.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/importer/svg/extractStrokePaths.ts src/importer/svg/extractStrokePaths.test.ts
git commit -m "feat(importer): extract stroke candidate paths from SVG"
```

### Task 3: Pathを数理プリミティブへ変換（Polyline化）

**Files:**
- Create: `src/importer/svg/pathToPolyline.ts`
- Create: `src/importer/svg/pathToPolyline.test.ts`
- Create: `src/importer/svg/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { pathToPolyline } from './pathToPolyline'

describe('pathToPolyline', () => {
  it('converts M/L commands to ordered points', () => {
    const points = pathToPolyline('M 0 0 L 10 0 L 10 10')
    expect(points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/importer/svg/pathToPolyline.test.ts`
Expected: FAIL with module not found

**Step 3: Write minimal implementation**

```ts
import type { Vec2 } from '../../math'

export const pathToPolyline = (d: string): Vec2[] => {
  const tokens = d.trim().split(/\s+/)
  const out: Vec2[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'M' || t === 'L') {
      const x = Number(tokens[i + 1])
      const y = Number(tokens[i + 2])
      out.push({ x, y })
      i += 2
    }
  }
  return out
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/importer/svg/pathToPolyline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/importer/svg/pathToPolyline.ts src/importer/svg/pathToPolyline.test.ts src/importer/svg/types.ts
git commit -m "feat(importer): add deterministic path-to-polyline conversion"
```

### Task 4: Polyline群からGraph草案を合成

**Files:**
- Create: `src/importer/svg/buildGraphFromSvg.ts`
- Create: `src/importer/svg/buildGraphFromSvg.test.ts`
- Modify: `src/core/schema/ids.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildGraphFromSvg } from './buildGraphFromSvg'

describe('buildGraphFromSvg', () => {
  it('builds a non-empty graph from a simple corridor polyline', () => {
    const svg = `<svg><path d="M 0 0 L 10 0 L 10 10" style="fill:none;stroke-width:0.27;"/></svg>`
    const graph = buildGraphFromSvg(svg, { buildingName: 'B1', floorLevel: 1 })
    expect(Object.keys(graph.nodes).length).toBe(3)
    expect(Object.keys(graph.edges).length).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/importer/svg/buildGraphFromSvg.test.ts`
Expected: FAIL with module not found

**Step 3: Write minimal implementation**

```ts
import { createEmptyCampusGraph } from '../../core/schema/graph'
import { extractStrokePaths } from './extractStrokePaths'
import { pathToPolyline } from './pathToPolyline'
import { autoComplete } from '../../core/autocomplete'

export const buildGraphFromSvg = (
  rawSvg: string,
  opts: { buildingName: string; floorLevel: number },
) => {
  const g = createEmptyCampusGraph()
  // 最小実装: path頂点を node、隣接頂点を edge に変換
  // IDは ids.ts の deterministic helper を使って安定化する
  // build/floor 作成もここで行う
  return autoComplete(g)
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/importer/svg/buildGraphFromSvg.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/importer/svg/buildGraphFromSvg.ts src/importer/svg/buildGraphFromSvg.test.ts src/core/schema/ids.ts
git commit -m "feat(importer): synthesize initial CampusGraph from SVG polylines"
```

### Task 5: 品質ゲート（autocomplete + validate + 保存）

**Files:**
- Create: `src/importer/svg/exportGraphJson.ts`
- Create: `src/importer/svg/exportGraphJson.test.ts`
- Modify: `src/core/graph/persistence.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { exportGraphJson } from './exportGraphJson'

describe('exportGraphJson', () => {
  it('exports graph JSON only when validation has no errors', () => {
    const result = exportGraphJson('<svg></svg>')
    expect(result.ok).toBe(true)
    expect(result.json.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/importer/svg/exportGraphJson.test.ts`
Expected: FAIL with module not found

**Step 3: Write minimal implementation**

```ts
import { buildGraphFromSvg } from './buildGraphFromSvg'
import { validate } from '../../core/graph/validate'
import { saveCampusGraph } from '../../core/graph/persistence'

export const exportGraphJson = (rawSvg: string) => {
  const graph = buildGraphFromSvg(rawSvg, { buildingName: 'page-1', floorLevel: 1 })
  const report = validate(graph)
  if (!report.isValid) return { ok: false as const, report, json: '' }
  return { ok: true as const, report, json: saveCampusGraph(graph) }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/importer/svg/exportGraphJson.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/importer/svg/exportGraphJson.ts src/importer/svg/exportGraphJson.test.ts src/core/graph/persistence.ts
git commit -m "feat(importer): add validation-gated JSON export for SVG pipeline"
```

### Task 6: page_1.svg 実データ出力とViewer接続

**Files:**
- Create: `data/derived/page_1.graph.json`
- Create: `src/importer/svg/page1Pipeline.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import graph from '../../../data/derived/page_1.graph.json'
import { validate } from '../../core/graph/validate'

describe('page_1 derived graph', () => {
  it('is loadable and has no validation errors', () => {
    const report = validate(graph as any)
    expect(report.isValid).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/importer/svg/page1Pipeline.test.ts`
Expected: FAIL with file missing

**Step 3: Write minimal implementation**

```ts
// page_1.svg を exportGraphJson で変換して data/derived/page_1.graph.json を生成
// App.tsx の初期モードを viewer に変更し、このJSONを読み込んで CampusViewer に渡す
```

**Step 4: Run tests and typecheck**

Run: `npm test -- --run src/importer/svg/page1Pipeline.test.ts src/App.test.tsx`
Expected: PASS

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add data/derived/page_1.graph.json src/importer/svg/page1Pipeline.test.ts src/App.tsx src/App.test.tsx
git commit -m "feat(data): derive page_1 CampusGraph from SVG and wire viewer default"
```

### Task 7: ドキュメント更新（エディター依存の整理）

**Files:**
- Modify: `docs/architecture/system-overview.md`
- Modify: `docs/features/01-trace-editor.md`
- Create: `docs/features/05-svg-data-pipeline.md`

**Step 1: Write/adjust doc assertions**

```md
- 手動トレースは「メンテナンスモード」に変更
- 本番データ生成は SVG パイプラインを正規ルートとする
- 検証ゲート: validate(graph).isValid === true
```

**Step 2: Run docs + tests sanity**

Run: `npm test -- --run src/importer/svg/page1Pipeline.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/architecture/system-overview.md docs/features/01-trace-editor.md docs/features/05-svg-data-pipeline.md
git commit -m "docs: shift primary data authoring flow from trace editor to SVG pipeline"
```

---

## Definition of Done

- `docs/reference/page_1.svg` から `data/derived/page_1.graph.json` を再生成できる
- 生成グラフが `validate` で error 0
- `CampusViewer` で生成データが表示できる
- 変換ロジックに単体テストと実データテストがある
- 仕様書が「手動トレース前提」から更新されている
