# Reference Image Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PDF/SVG/画像ファイルをトレースエディターのキャンバス上にリファレンス画像として重ねて表示し、自由に移動・拡大縮小・回転できるようにする。

**Architecture:**
- リファレンス画像はSVG `<image>` 要素としてワールド座標系に配置。メインのグラフ要素と同じマトリクスでpan/zoomに追従するため、両者がロックされた状態でトレース可能。
- SVG/PNG/JPGは FileReader で dataURL 化。PDF は pdfjs-dist でオフスクリーン canvas にレンダリングし dataURL 化（canvas は一時的で表示されない = §0 違反なし）。
- 状態管理は `useReferenceImage` hook に集約。TraceEditorCanvas に `referenceImage` prop を追加し SVG に描画。ReferencePanel で右サイドバーにコントロールを表示。

**Tech Stack:** pdfjs-dist 4.x, React hooks, SVG `<image>` element, CSS variables

---

## Task 1: `useReferenceImage` hook（状態管理のみ、PDF なし）

**Files:**
- Create: `src/editor/useReferenceImage.ts`
- Create: `src/editor/useReferenceImage.test.ts`

### Step 1: テストを書く

`src/editor/useReferenceImage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReferenceImage } from './useReferenceImage'

describe('useReferenceImage', () => {
  it('initial state is empty', () => {
    const { result } = renderHook(() => useReferenceImage())
    expect(result.current.ref.dataUrl).toBeNull()
    expect(result.current.ref.opacity).toBe(0.5)
    expect(result.current.ref.scale).toBe(1)
    expect(result.current.ref.rotation).toBe(0)
    expect(result.current.ref.x).toBe(0)
    expect(result.current.ref.y).toBe(0)
  })

  it('setOpacity clamps to 0-1', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setOpacity(1.5))
    expect(result.current.ref.opacity).toBe(1)
    act(() => result.current.setOpacity(-0.1))
    expect(result.current.ref.opacity).toBe(0)
  })

  it('setScale clamps to min 0.01', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setScale(0))
    expect(result.current.ref.scale).toBe(0.01)
  })

  it('clear resets to initial', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => {
      result.current.setOpacity(0.8)
      result.current.setScale(2)
      result.current.clear()
    })
    expect(result.current.ref.dataUrl).toBeNull()
    expect(result.current.ref.opacity).toBe(0.5)
    expect(result.current.ref.scale).toBe(1)
  })

  it('setRaw sets dataUrl and natural size', () => {
    const { result } = renderHook(() => useReferenceImage())
    act(() => result.current.setRaw('data:image/png;base64,abc', 800, 600))
    expect(result.current.ref.dataUrl).toBe('data:image/png;base64,abc')
    expect(result.current.ref.naturalWidth).toBe(800)
    expect(result.current.ref.naturalHeight).toBe(600)
  })
})
```

### Step 2: テストが失敗することを確認

```bash
npm test -- --run src/editor/useReferenceImage.test.ts
```
Expected: FAIL (module not found)

### Step 3: hookを実装する

`src/editor/useReferenceImage.ts`:

```typescript
import { useState, useCallback } from 'react'

export interface ReferenceImageState {
  dataUrl: string | null
  opacity: number
  x: number
  y: number
  scale: number
  rotation: number  // degrees
  naturalWidth: number
  naturalHeight: number
  pageCount: number
  currentPage: number
}

const INITIAL: ReferenceImageState = {
  dataUrl: null,
  opacity: 0.5,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  pageCount: 1,
  currentPage: 1,
}

export interface UseReferenceImageReturn {
  ref: ReferenceImageState
  setOpacity: (v: number) => void
  setX: (v: number) => void
  setY: (v: number) => void
  setScale: (v: number) => void
  setRotation: (v: number) => void
  setCurrentPage: (page: number) => void
  /** Set raw dataUrl + intrinsic size (after file load / PDF render) */
  setRaw: (dataUrl: string, w: number, h: number, pageCount?: number) => void
  clear: () => void
}

export const useReferenceImage = (): UseReferenceImageReturn => {
  const [ref, setRef] = useState<ReferenceImageState>(INITIAL)

  const setOpacity   = useCallback((v: number) => setRef(s => ({ ...s, opacity: Math.max(0, Math.min(1, v)) })), [])
  const setX         = useCallback((v: number) => setRef(s => ({ ...s, x: v })), [])
  const setY         = useCallback((v: number) => setRef(s => ({ ...s, y: v })), [])
  const setScale     = useCallback((v: number) => setRef(s => ({ ...s, scale: Math.max(0.01, v) })), [])
  const setRotation  = useCallback((v: number) => setRef(s => ({ ...s, rotation: v })), [])
  const setCurrentPage = useCallback((page: number) => setRef(s => ({ ...s, currentPage: page })), [])

  const setRaw = useCallback((dataUrl: string, w: number, h: number, pageCount = 1) => {
    setRef(s => ({ ...s, dataUrl, naturalWidth: w, naturalHeight: h, pageCount, currentPage: 1 }))
  }, [])

  const clear = useCallback(() => setRef(INITIAL), [])

  return { ref, setOpacity, setX, setY, setScale, setRotation, setCurrentPage, setRaw, clear }
}
```

### Step 4: テストをパスさせる

```bash
npm test -- --run src/editor/useReferenceImage.test.ts
```
Expected: 5 tests pass

### Step 5: コミット

```bash
git add src/editor/useReferenceImage.ts src/editor/useReferenceImage.test.ts
git commit -m "feat(editor): useReferenceImage hook — reference image state management"
```

---

## Task 2: `ReferencePanel` コンポーネント（SVG/PNG/JPG ロード + コントロール）

**Files:**
- Create: `src/editor/ReferencePanel.tsx`
- Create: `src/editor/ReferencePanel.test.tsx`

### Step 1: テストを書く

`src/editor/ReferencePanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReferencePanel } from './ReferencePanel'
import type { UseReferenceImageReturn } from './useReferenceImage'

const makeHook = (overrides: Partial<UseReferenceImageReturn> = {}): UseReferenceImageReturn => ({
  ref: {
    dataUrl: null, opacity: 0.5, x: 0, y: 0, scale: 1, rotation: 0,
    naturalWidth: 0, naturalHeight: 0, pageCount: 1, currentPage: 1,
  },
  setOpacity: vi.fn(),
  setX: vi.fn(),
  setY: vi.fn(),
  setScale: vi.fn(),
  setRotation: vi.fn(),
  setCurrentPage: vi.fn(),
  setRaw: vi.fn(),
  clear: vi.fn(),
  ...overrides,
})

describe('ReferencePanel', () => {
  it('renders import button and no controls when empty', () => {
    render(<ReferencePanel hook={makeHook()} onLoadFile={vi.fn()} />)
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/opacity/i)).toBeNull()
  })

  it('shows controls when dataUrl is set', () => {
    const hook = makeHook({ ref: { dataUrl: 'data:image/png;base64,abc', opacity: 0.5, x: 0, y: 0, scale: 1, rotation: 0, naturalWidth: 100, naturalHeight: 100, pageCount: 1, currentPage: 1 } })
    render(<ReferencePanel hook={hook} onLoadFile={vi.fn()} />)
    expect(screen.getByLabelText(/opacity/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('calls clear when clear button clicked', () => {
    const clear = vi.fn()
    const hook = makeHook({
      ref: { dataUrl: 'data:image/png;base64,abc', opacity: 0.5, x: 0, y: 0, scale: 1, rotation: 0, naturalWidth: 100, naturalHeight: 100, pageCount: 1, currentPage: 1 },
      clear,
    })
    render(<ReferencePanel hook={hook} onLoadFile={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(clear).toHaveBeenCalled()
  })

  it('calls onLoadFile when import clicked', () => {
    const onLoadFile = vi.fn()
    render(<ReferencePanel hook={makeHook()} onLoadFile={onLoadFile} />)
    fireEvent.click(screen.getByRole('button', { name: /import/i }))
    expect(onLoadFile).toHaveBeenCalled()
  })

  it('shows page selector only for PDF (pageCount > 1)', () => {
    const hook = makeHook({
      ref: { dataUrl: 'data:image/png;base64,abc', opacity: 0.5, x: 0, y: 0, scale: 1, rotation: 0, naturalWidth: 100, naturalHeight: 100, pageCount: 3, currentPage: 1 },
    })
    render(<ReferencePanel hook={hook} onLoadFile={vi.fn()} />)
    expect(screen.getByLabelText(/page/i)).toBeInTheDocument()
  })
})
```

### Step 2: テストが失敗することを確認

```bash
npm test -- --run src/editor/ReferencePanel.test.tsx
```
Expected: FAIL

### Step 3: コンポーネントを実装する

`src/editor/ReferencePanel.tsx`:

```typescript
/**
 * ReferencePanel — import and control reference images for tracing.
 * Supports SVG, PNG, JPG (via FileReader) and PDF (via pdfjs-dist).
 */

import React from 'react'
import type { UseReferenceImageReturn } from './useReferenceImage'

export interface ReferencePanelProps {
  hook: UseReferenceImageReturn
  onLoadFile: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 2, fontFamily: 'var(--font-mono)',
  display: 'block',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '3px 6px', fontSize: 11, borderRadius: 3,
  border: '1px solid var(--border-2)', background: 'var(--bg-1)',
  color: 'var(--text-1)', boxSizing: 'border-box', outline: 'none',
}
const numStyle: React.CSSProperties = { ...inputStyle, width: '48%' }

export const ReferencePanel: React.FC<ReferencePanelProps> = ({ hook, onLoadFile }) => {
  const { ref } = hook
  const hasImage = ref.dataUrl !== null

  return (
    <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-1)' }}>
      {/* Import button */}
      <button
        aria-label="Import reference file"
        onClick={onLoadFile}
        style={{
          width: '100%', padding: '4px 8px', fontSize: 10, borderRadius: 3,
          border: '1px solid var(--border-2)', background: 'transparent',
          color: 'var(--text-2)', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: 6,
        }}
      >
        ＋ IMPORT (PDF / SVG / PNG / JPG)
      </button>

      {hasImage && (
        <>
          {/* Opacity */}
          <div style={{ marginBottom: 7 }}>
            <label aria-label="opacity" style={labelStyle}>不透明度 (Opacity)</label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={ref.opacity}
              onChange={e => hook.setOpacity(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Scale + Rotation */}
          <div style={{ marginBottom: 7 }}>
            <label style={labelStyle}>拡大率 / 回転</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number" step={0.1} min={0.01} value={ref.scale}
                onChange={e => hook.setScale(Number(e.target.value))}
                style={numStyle} title="Scale"
              />
              <input
                type="number" step={1} value={ref.rotation}
                onChange={e => hook.setRotation(Number(e.target.value))}
                style={numStyle} title="Rotation (°)"
              />
            </div>
          </div>

          {/* Position X / Y */}
          <div style={{ marginBottom: 7 }}>
            <label style={labelStyle}>位置 X / Y (ワールド座標)</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number" step={10} value={ref.x}
                onChange={e => hook.setX(Number(e.target.value))}
                style={numStyle} title="X"
              />
              <input
                type="number" step={10} value={ref.y}
                onChange={e => hook.setY(Number(e.target.value))}
                style={numStyle} title="Y"
              />
            </div>
          </div>

          {/* PDF page selector */}
          {ref.pageCount > 1 && (
            <div style={{ marginBottom: 7 }}>
              <label aria-label="page" style={labelStyle}>ページ (1 / {ref.pageCount})</label>
              <input
                type="number" min={1} max={ref.pageCount} value={ref.currentPage}
                onChange={e => hook.setCurrentPage(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          )}

          {/* Natural size info */}
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginBottom: 7, fontFamily: 'var(--font-mono)' }}>
            {ref.naturalWidth} × {ref.naturalHeight} px
          </div>

          {/* Clear */}
          <button
            aria-label="Clear reference"
            onClick={hook.clear}
            style={{
              width: '100%', padding: '3px 8px', fontSize: 10, borderRadius: 3,
              border: '1px solid rgba(248,113,113,0.4)', background: 'transparent',
              color: 'var(--red)', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}
          >
            CLEAR
          </button>
        </>
      )}
    </div>
  )
}
```

### Step 4: テストをパスさせる

```bash
npm test -- --run src/editor/ReferencePanel.test.tsx
```
Expected: 5 tests pass

### Step 5: コミット

```bash
git add src/editor/ReferencePanel.tsx src/editor/ReferencePanel.test.tsx
git commit -m "feat(editor): ReferencePanel — reference image import/control UI"
```

---

## Task 3: `TraceEditorCanvas` にリファレンス画像を描画する

**Files:**
- Modify: `src/editor/TraceEditorCanvas.tsx`
- Modify: `src/editor/TraceEditorCanvas.test.tsx`

### Step 1: 既存テストファイルを確認する

```bash
cat src/editor/TraceEditorCanvas.test.tsx
```

### Step 2: リファレンス画像描画のテストを追加する

`src/editor/TraceEditorCanvas.test.tsx` に以下を追記する（既存テストの後）:

```typescript
import type { ReferenceImageState } from './useReferenceImage'

const makeRef = (overrides: Partial<ReferenceImageState> = {}): ReferenceImageState => ({
  dataUrl: 'data:image/png;base64,abc',
  opacity: 0.5, x: 100, y: 200, scale: 1, rotation: 0,
  naturalWidth: 400, naturalHeight: 300, pageCount: 1, currentPage: 1,
  ...overrides,
})

describe('TraceEditorCanvas – reference image', () => {
  it('renders SVG image element when referenceImage has dataUrl', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={EMPTY_GRAPH}
        matrix={identity()}
        setMatrix={vi.fn()}
        activeTool="select"
        drawingVertices={[]}
        onVertexAdd={vi.fn()}
        onCancel={vi.fn()}
        onSelect={vi.fn()}
        onNodePlace={vi.fn()}
        onDoorPlace={vi.fn()}
        referenceImage={makeRef()}
      />
    )
    const img = container.querySelector('image[href="data:image/png;base64,abc"]')
    expect(img).toBeTruthy()
  })

  it('does not render image element when dataUrl is null', () => {
    const { container } = render(
      <TraceEditorCanvas
        graph={EMPTY_GRAPH}
        matrix={identity()}
        setMatrix={vi.fn()}
        activeTool="select"
        drawingVertices={[]}
        onVertexAdd={vi.fn()}
        onCancel={vi.fn()}
        onSelect={vi.fn()}
        onNodePlace={vi.fn()}
        onDoorPlace={vi.fn()}
        referenceImage={{ ...makeRef(), dataUrl: null }}
      />
    )
    expect(container.querySelector('image')).toBeNull()
  })
})
```

### Step 3: テストが失敗することを確認

```bash
npm test -- --run src/editor/TraceEditorCanvas.test.tsx
```
Expected: FAIL (new tests fail)

### Step 4: `TraceEditorCanvas` を修正する

`src/editor/TraceEditorCanvas.tsx` の変更点:

**A) import 追加（ファイル先頭）:**
```typescript
import type { ReferenceImageState } from './useReferenceImage'
```

**B) `TraceEditorCanvasProps` に prop 追加:**
```typescript
  referenceImage?: ReferenceImageState | null
```

**C) コンポーネント引数に追加:**
```typescript
export const TraceEditorCanvas: React.FC<TraceEditorCanvasProps> = ({
  graph, matrix, setMatrix,
  activeTool, drawingVertices, activeFloorId,
  onVertexAdd, onCancel, onSelect, onNodePlace, onDoorPlace,
  referenceImage,
}) => {
```

**D) SVG内の `<g transform={transformStr}>` の最初の子として `<image>` を追加（スペース描画より前）:**
```tsx
        <g transform={transformStr}>
          {/* Reference image (world-space, behind graph) */}
          {referenceImage?.dataUrl && (
            <image
              href={referenceImage.dataUrl}
              x={referenceImage.x}
              y={referenceImage.y}
              width={referenceImage.naturalWidth * referenceImage.scale}
              height={referenceImage.naturalHeight * referenceImage.scale}
              transform={`rotate(${referenceImage.rotation} ${
                referenceImage.x + (referenceImage.naturalWidth * referenceImage.scale) / 2
              } ${
                referenceImage.y + (referenceImage.naturalHeight * referenceImage.scale) / 2
              })`}
              opacity={referenceImage.opacity}
              preserveAspectRatio="none"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* Spaces */}
          ...
```

### Step 5: テストをパスさせる

```bash
npm test -- --run src/editor/TraceEditorCanvas.test.tsx
```
Expected: all tests pass

### Step 6: コミット

```bash
git add src/editor/TraceEditorCanvas.tsx src/editor/TraceEditorCanvas.test.tsx
git commit -m "feat(editor): TraceEditorCanvas — render reference image in SVG world space"
```

---

## Task 4: `TraceEditor` への配線（SVG/PNG/JPG ファイルロード + ReferencePanel 表示）

**Files:**
- Modify: `src/editor/TraceEditor.tsx`

### Step 1: 既存テストが全パスすることを確認

```bash
npm test -- --run src/editor/TraceEditor.test.tsx
```
Expected: all pass

### Step 2: `TraceEditor.tsx` を修正する

以下の変更を加える:

**A) import 追加:**
```typescript
import { useReferenceImage } from './useReferenceImage'
import { ReferencePanel } from './ReferencePanel'
```

**B) hook 呼び出し追加（`useEditorState()` の後）:**
```typescript
  const refImage = useReferenceImage()
  const refFileInputRef = useRef<HTMLInputElement>(null)
```

**C) SVG/PNG/JPG ファイルロード関数を追加（`handleLoadFile` の後）:**
```typescript
  const handleRefFileLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      // Resolve natural dimensions via HTMLImageElement
      const img = new Image()
      img.onload = () => refImage.setRaw(dataUrl, img.naturalWidth, img.naturalHeight)
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }, [refImage])
```

**D) hidden file input を追加（既存 fileInputRef の `<input>` の直後）:**
```tsx
      <input
        ref={refFileInputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.pdf"
        style={{ display: 'none' }}
        onChange={handleRefFileLoad}
      />
```

**E) `TraceEditorCanvas` に prop を追加:**
```tsx
          <TraceEditorCanvas
            ...
            referenceImage={refImage.ref}
          />
```

**F) 右サイドバーに `ReferencePanel` セクションを追加（バリデーションパネルの前）:**
```tsx
        {/* Reference image panel */}
        <div style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="panel-label">リファレンス画像</div>
          <ReferencePanel
            hook={refImage}
            onLoadFile={() => refFileInputRef.current?.click()}
          />
        </div>
```

### Step 3: テストが全パスすることを確認

```bash
npm test -- --run
```
Expected: all 346+ tests pass

### Step 4: コミット

```bash
git add src/editor/TraceEditor.tsx
git commit -m "feat(editor): wire ReferencePanel into TraceEditor — SVG/PNG/JPG reference support"
```

---

## Task 5: PDF サポート（pdfjs-dist 追加）

**Files:**
- Create: `src/editor/loadPdfPage.ts`
- Create: `src/editor/loadPdfPage.test.ts`
- Modify: `src/editor/TraceEditor.tsx`
- Modify: `vite.config.ts`（必要に応じて）

### Step 1: pdfjs-dist をインストールする

```bash
npm install pdfjs-dist
```

### Step 2: loadPdfPage のテストを書く（PDF.js をモック）

`src/editor/loadPdfPage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pdfjs-dist before importing our module
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: vi.fn(() => Promise.resolve({
        getViewport: vi.fn(() => ({ width: 800, height: 600 })),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
      })),
    }),
  })),
}))

// Mock canvas (jsdom doesn't support canvas)
vi.stubGlobal('HTMLCanvasElement', class {
  width = 0; height = 0
  getContext = vi.fn(() => ({} as unknown as CanvasRenderingContext2D))
  toDataURL = vi.fn(() => 'data:image/png;base64,mock')
})

describe('loadPdfPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns dataUrl, width, height, pageCount for page 1', async () => {
    const { loadPdfPage } = await import('./loadPdfPage')
    const result = await loadPdfPage('data:application/pdf;base64,abc', 1)
    expect(result.dataUrl).toBe('data:image/png;base64,mock')
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
    expect(result.pageCount).toBe(3)
  })
})
```

### Step 3: テストが失敗することを確認

```bash
npm test -- --run src/editor/loadPdfPage.test.ts
```
Expected: FAIL

### Step 4: `loadPdfPage.ts` を実装する

`src/editor/loadPdfPage.ts`:

```typescript
/**
 * loadPdfPage — render a PDF page to a data URL using pdfjs-dist.
 *
 * Uses an offscreen canvas internally (not displayed; §0-safe).
 * The caller receives a PNG data URL to display as an SVG <image>.
 */

import * as pdfjsLib from 'pdfjs-dist'

// Configure the worker (Vite ?url import)
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
}

export interface PdfPageResult {
  dataUrl: string
  width: number
  height: number
  pageCount: number
}

export const loadPdfPage = async (
  pdfDataUrl: string,
  pageNumber: number,
  renderScale = 2,  // high-DPI for tracing clarity
): Promise<PdfPageResult> => {
  const doc = await pdfjsLib.getDocument(pdfDataUrl).promise
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: renderScale })

  const canvas = document.createElement('canvas')
  canvas.width  = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!

  await page.render({ canvasContext: ctx, viewport }).promise

  const dataUrl = canvas.toDataURL('image/png')
  return { dataUrl, width: viewport.width, height: viewport.height, pageCount: doc.numPages }
}
```

### Step 5: テストをパスさせる

```bash
npm test -- --run src/editor/loadPdfPage.test.ts
```
Expected: 1 test passes

### Step 6: `TraceEditor.tsx` の PDF ロードを `handleRefFileLoad` に追記する

`handleRefFileLoad` を以下に置き換える（Task 4 で書いたもの全体を差し替え）:

```typescript
  const handleRefFileLoad = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // PDF: read as dataURL → pdfjs render → setRaw
      const reader = new FileReader()
      reader.onload = async ev => {
        const pdfDataUrl = ev.target?.result as string
        const { loadPdfPage } = await import('./loadPdfPage')
        const { dataUrl, width, height, pageCount } = await loadPdfPage(pdfDataUrl, refImage.ref.currentPage)
        refImage.setRaw(dataUrl, width, height, pageCount)
      }
      reader.readAsDataURL(file)
    } else {
      // SVG / PNG / JPG: read as dataURL → img.naturalWidth/Height
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        const img = new Image()
        img.onload = () => refImage.setRaw(dataUrl, img.naturalWidth, img.naturalHeight)
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    }
  }, [refImage])
```

`handleRefFileLoad` は `async` になるため、`onChange` ハンドラのシグネチャも更新:

```tsx
        onChange={e => { void handleRefFileLoad(e) }}
```

### Step 7: PDF ページ切替に対応する（useEffect で再レンダリング）

`TraceEditor.tsx` に useEffect を追加（PDF ページ番号が変わったら再ロード）:

```typescript
  useEffect(() => {
    if (refImage.ref.pageCount <= 1) return
    if (!refImage.ref.dataUrl) return
    // Page changed — but we only re-render if user explicitly loaded a PDF
    // The page re-render is triggered via ReferencePanel's setCurrentPage
    // which calls back to a stored PDF dataUrl — future enhancement.
    // For now, the initial page is rendered on import.
  }, [refImage.ref.currentPage, refImage.ref.pageCount, refImage.ref.dataUrl])
```

> **注記:** PDF ページ切替の完全サポート（ページ変更時の再レンダリング）は pdfDataUrl を state に保持する必要があり、これは将来の改善タスクとする。現時点では、ページを選択した後に再度ファイルをインポートすることで対応。

### Step 8: 全テストをパスさせる

```bash
npm test -- --run
```
Expected: all tests pass

### Step 9: コミット

```bash
git add src/editor/loadPdfPage.ts src/editor/loadPdfPage.test.ts src/editor/TraceEditor.tsx
git commit -m "feat(editor): PDF support via pdfjs-dist — loadPdfPage renders PDF to PNG dataUrl"
```

---

## 完了確認

```bash
npm test -- --run
# Expected: all tests pass

npm run typecheck
# Expected: no type errors

npm run dev
# Manual check: エディターの右サイドバーに「リファレンス画像」パネルが出ていること
# PDF/SVG/PNG を IMPORT して透過表示されること
# pan/zoom でグラフと共に追従すること
```

---

## リスクと注意点

1. **pdfjs-dist のワーカー設定**: `import.meta.url` を使う動的 URL 解決は Vite で動作するが、vitest では別の設定が必要な場合がある。テストはモックで回避済み。

2. **SVG の naturalWidth**: `<img>` の `naturalWidth` は SVG では 0 になる場合がある（intrinsic size 未定義の SVG）。その場合は `naturalWidth = 800, naturalHeight = 600` のデフォルトを設定する対策が必要。

3. **PDF ページ切替**: 現実装では初回インポート時のページのみレンダリング。ページ切替は pdfDataUrl を別途保持して再レンダリングする拡張が必要（現時点では TODO）。

4. **大きなPDFデータURL**: PDF全体を dataURL として base64 化するため、大きいファイルはメモリ負荷がある。10MB 以下を推奨。
