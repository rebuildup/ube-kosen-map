import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ShapeLayerEditor } from './ShapeLayerEditor'

const RAW = [
  '<svg viewBox="0 0 100 100">',
  '<path style="fill:none;stroke:#111;stroke-width:1;" d="M0 0 L10 0"/>',
  '<path style="fill:none;stroke:#111;stroke-width:1;" d="M10 0 L20 0"/>',
  '</svg>',
].join('')

describe('ShapeLayerEditor', () => {
  it('renders shape rows from initial customShapes', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    expect(container.querySelector('[data-shape-row="s1"]')).not.toBeNull()
  })

  it('allows creating a new layer', () => {
    const { container, getByText } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
          shapeLayers: [{ id: 'layer-ground', name: 'Ground', baseZ: 0, color: '#64748b' }],
        }}
      />,
    )

    fireEvent.click(getByText('レイヤー追加'))
    const inputs = container.querySelectorAll('input')
    expect(inputs.length).toBeGreaterThan(1)
  })

  it('hides non-assigned paths in canvas css', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: { '1': 'deleted' },
          customShapes: [
            { id: 's1', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const css = container.querySelector('svg style')?.textContent ?? ''
    expect(css).toContain('display:none')
    expect(css).toContain('[data-sp="0"]')
    expect(css).not.toContain('[data-sp="1"]')
  })

  it('toggles layer visibility from the shape list header', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
          shapeLayers: [{ id: 'layer-ground', name: 'Ground', baseZ: 0, color: '#64748b' }],
          shapePlacements: { s1: { shapeId: 's1', layerId: 'layer-ground', height: 10 } },
        }}
      />,
    )

    const before = container.querySelector('svg style')?.textContent ?? ''
    expect(before).toContain('[data-sp="0"]')
    const toggle = container.querySelector('[data-layer-toggle="layer-ground"]') as HTMLButtonElement
    fireEvent.click(toggle)
    const after = container.querySelector('svg style')?.textContent ?? ''
    expect(after).not.toContain('[data-sp="0"]')
  })

  it('orders layer groups by baseZ descending in the shape list', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
          shapeLayers: [
            { id: 'layer-low', name: 'Low', baseZ: 0, color: '#64748b' },
            { id: 'layer-high', name: 'High', baseZ: 100, color: '#334155' },
          ],
          shapePlacements: {
            s1: { shapeId: 's1', layerId: 'layer-low', height: 5 },
          },
        }}
      />,
    )

    const toggles = Array.from(container.querySelectorAll('[data-layer-toggle]'))
    const orderedIds = toggles.map((el) => (el as HTMLElement).getAttribute('data-layer-toggle'))
    expect(orderedIds).toEqual(['layer-high', 'layer-low'])
  })

  it('selects shape by path click and clears selection on empty canvas click', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
            { id: 's2', pathIndices: [1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    const activeLabel = container.querySelector('[data-active-shape-label="true"]') as HTMLDivElement

    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)
    expect(activeLabel.textContent).toBe('s1')

    fireEvent.mouseDown(canvas, { button: 0, clientX: 30, clientY: 30 })
    fireEvent.mouseUp(canvas)
    expect(activeLabel.textContent).toBe('なし')
  })

  it('supports middle-drag panning', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
            { id: 's2', pathIndices: [1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    const svg = container.querySelector('svg') as SVGSVGElement

    fireEvent.mouseDown(path0, { button: 0, clientX: 5, clientY: 5 })
    fireEvent.mouseUp(canvas)

    const before = svg.style.transform
    fireEvent.mouseDown(canvas, { button: 1, clientX: 10, clientY: 10 })
    fireEvent.mouseMove(canvas, { clientX: 30, clientY: 40 })
    fireEvent.mouseUp(canvas)
    const after = svg.style.transform
    expect(before).not.toContain('translate(20px, 30px)')
    expect(after).toContain('translate(20px, 30px)')
  })

  it('highlights hovered shape on map', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    fireEvent.mouseMove(path0, { clientX: 10, clientY: 10 })
    const css = container.querySelector('svg style')?.textContent ?? ''
    expect(css).toContain('stroke:rgb(245,158,11)!important')
  })

  it('keeps previous selection when selecting another shape', () => {
    const { container, getByText } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
            { id: 's2', pathIndices: [1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement

    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)
    expect(getByText('選択へ適用(1)')).not.toBeNull()

    const path1After = container.querySelector('svg path[data-sp="1"]') as SVGPathElement
    fireEvent.mouseDown(path1After, { button: 0, clientX: 20, clientY: 10 })
    fireEvent.mouseUp(canvas)
    expect(getByText('選択へ適用(2)')).not.toBeNull()
  })

  it('deletes selected dangling vertex', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)

    const pointsBefore = container.querySelectorAll('[data-dangling-vertex]')
    expect(pointsBefore.length).toBe(2)
    fireEvent.click(pointsBefore[0] as Element)

    const deleteBtn = container.querySelector('[data-delete-vertex="true"]') as HTMLButtonElement
    fireEvent.click(deleteBtn)

    const pointsAfter = container.querySelectorAll('[data-dangling-vertex]')
    expect(pointsAfter.length).toBe(1)
  })

  it('highlights selected path in red', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)

    const css = container.querySelector('svg style')?.textContent ?? ''
    expect(css).toContain('stroke:rgb(239,68,68)!important')
  })

  it('keeps editor vertices visible even when base paths are filtered', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const css = container.querySelector('svg style')?.textContent ?? ''
    expect(css).toContain('[data-editor-vertex="true"]{display:inline!important}')
  })

  it('shows all vertices including non-dangling ones for selected shape', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)

    const allVertices = container.querySelectorAll('[data-shape-vertex]')
    const danglingVertices = container.querySelectorAll('[data-dangling-vertex]')
    expect(allVertices.length).toBe(3)
    expect(danglingVertices.length).toBe(2)
  })

  it('does not change stroke width for selected/hovered paths', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
            { id: 's2', pathIndices: [1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )
    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const path1 = container.querySelector('svg path[data-sp="1"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement

    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)
    fireEvent.mouseMove(path1, { clientX: 20, clientY: 10 })

    const css = container.querySelector('svg style')?.textContent ?? ''
    expect(css).not.toContain('stroke-width:1.8')
    expect(css).not.toContain('stroke-width:1.6')
  })

  it('renders vertices in compact size', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )
    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)

    const v = container.querySelector('[data-shape-vertex]') as SVGCircleElement
    expect(Number(v.getAttribute('r'))).toBeLessThanOrEqual(1.6)
  })

  it('renders added bridge segment as visible editor line', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )
    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)

    const points = container.querySelectorAll('[data-dangling-vertex]')
    expect(points.length).toBe(2)
    fireEvent.click(points[0] as Element)
    fireEvent.click(points[1] as Element)

    const addBtn = container.querySelector('[data-add-bridge="true"]') as HTMLButtonElement
    fireEvent.click(addBtn)

    const bridgeLines = container.querySelectorAll('svg line[data-sp]')
    expect(bridgeLines.length).toBe(1)
    const css = container.querySelector('svg style')?.textContent ?? ''
    expect(css).toContain('line[data-sp="-1"]')
  })

  it('removes intermediate vertices between two selected vertices', () => {
    const { container } = render(
      <ShapeLayerEditor
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 's1', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          shapeEdits: { bridges: [], removedVertices: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )
    const path0 = container.querySelector('svg path[data-sp="0"]') as SVGPathElement
    const canvas = container.querySelector('[data-map-canvas="true"]') as HTMLDivElement
    fireEvent.mouseDown(path0, { button: 0, clientX: 10, clientY: 10 })
    fireEvent.mouseUp(canvas)

    const beforeAll = container.querySelectorAll('[data-shape-vertex]')
    expect(beforeAll.length).toBe(3)
    fireEvent.click(beforeAll[0] as Element)
    fireEvent.click(beforeAll[2] as Element)

    const btn = container.querySelector('[data-delete-between-vertices="true"]') as HTMLButtonElement
    fireEvent.click(btn)

    const afterAll = container.querySelectorAll('[data-shape-vertex]')
    expect(afterAll.length).toBe(2)
    const bridgeLines = container.querySelectorAll('svg line[data-sp]')
    expect(bridgeLines.length).toBe(1)
  })
})
