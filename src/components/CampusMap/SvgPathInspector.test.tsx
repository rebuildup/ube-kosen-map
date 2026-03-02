// src/components/CampusMap/SvgPathInspector.test.tsx
import { describe, expect, it } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SvgPathInspector } from './SvgPathInspector'

const RAW = [
  '<svg viewBox="0 0 100 100">',
  '<path style="fill:none;stroke:#111;stroke-width:0.5;" d="M0 0 L10 10"/>',
  '<path style="fill:none;stroke:#111;stroke-width:0.5;" d="M10 10 L20 0"/>',
  '<path style="fill:none;stroke:#888;stroke-width:2;" d="M0 50 L100 50"/>',
  '</svg>',
].join('')

describe('SvgPathInspector', () => {
  it('renders the SVG canvas area', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    expect(container.querySelector('[data-inspector-svg]')).not.toBeNull()
  })

  it('renders a row per path (flat list)', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const rows = container.querySelectorAll('[data-path-row]')
    expect(rows.length).toBe(3) // three paths
  })

  it('toggles a path off when its button is clicked', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const toggleBtn = container.querySelector('button[data-path-toggle]') as HTMLButtonElement
    fireEvent.click(toggleBtn)
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toContain('display:none')
  })

  it('HIDE ALL hides all paths', () => {
    const { container, getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    fireEvent.click(getByText('HIDE ALL'))
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toContain('data-sp=')
    expect(style?.textContent).toContain('display:none')
  })

  it('SHOW ALL re-enables all groups', () => {
    const { container, getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    fireEvent.click(getByText('HIDE ALL'))
    fireEvent.click(getByText('SHOW ALL'))
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toBe('')
  })

  it('hovering a path row generates cyan highlight CSS', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const row = container.querySelector('[data-path-row="0"]')
    expect(row).toBeTruthy()
    fireEvent.mouseEnter(row!)
    const highlightStyle = container.querySelector('[data-inspector-style="highlight"]')
    expect(highlightStyle?.textContent).toContain('stroke:cyan')
    fireEvent.mouseLeave(row!)
    expect(container.querySelector('[data-inspector-style="highlight"]')?.textContent).not.toContain('stroke:cyan')
  })

  it('shows path rows with g/p labels', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const rows = container.querySelectorAll('[data-path-row]')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]?.textContent).toMatch(/g\d+p\d+/)
  })

  it('shows 完了 and 未完了 filter toggles', () => {
    const { getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    expect(getByText('完了')).toBeTruthy()
    expect(getByText('未完了')).toBeTruthy()
  })

  it('path status button exists and cycles on click', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const pathRow = container.querySelector('[data-path-row]')
    expect(pathRow).toBeTruthy()
    const statusBtn = pathRow!.querySelector('[data-path-status]') as HTMLButtonElement
    expect(statusBtn).toBeTruthy()
    expect(statusBtn.textContent).toMatch(/^[未完削]$/)
    fireEvent.click(statusBtn)
    const btnAfter = container.querySelector('[data-path-status]')
    expect(btnAfter?.textContent).toMatch(/^[未完削]$/)
  })

  it('shows バックアップ and 保存 buttons', () => {
    const { getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    expect(getByText('バックアップ')).toBeTruthy()
    expect(getByText('保存')).toBeTruthy()
  })

  it('shows 削除 button when paths are selected', () => {
    const { container, getByRole } = render(<SvgPathInspector rawSvg={RAW} />)
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    const deleteBtn = getByRole('button', { name: /削除 \(\d+\)/ })
    expect(deleteBtn).toBeTruthy()
  })

  it('shows 元に戻す and やり直す buttons', () => {
    const { getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    expect(getByText('元に戻す')).toBeTruthy()
    expect(getByText('やり直す')).toBeTruthy()
  })

  it('applies shapeEdits (split) to displayed shape list from initial config', () => {
    const { container, getByText } = render(
      <SvgPathInspector
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          customShapes: [
            { id: 'seed', pathIndices: [0, 1], isClosed: true, hasFill: true, fillColor: '#00ff00' },
          ],
          hiddenShapeIds: [],
          shapeEdits: {
            splits: [
              {
                id: 'split-1',
                sourceShapeId: 'seed',
                parts: [
                  { id: 'seed-a', pathIndices: [0] },
                  { id: 'seed-b', pathIndices: [1] },
                ],
              },
            ],
          },
        }}
      />,
    )

    fireEvent.click(getByText('シェイプ'))
    const rows = container.querySelectorAll('[data-shape-row]')
    expect(rows.length).toBe(2)
  })

  it('adds a bridge by selecting two dangling vertices in shape mode', () => {
    const { container, getByText } = render(
      <SvgPathInspector
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          shapeStatus: {},
          customShapes: [
            { id: 'seed', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          hiddenShapeIds: [],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    const shapeModeBtn = container.querySelector('button[data-editor-mode="shape"]') as HTMLButtonElement
    fireEvent.click(shapeModeBtn)
    fireEvent.click(getByText('シェイプ'))
    const shapeRow = container.querySelector('[data-shape-row="seed"]') as HTMLDivElement
    fireEvent.click(shapeRow)

    const points = container.querySelectorAll('[data-dangling-vertex]')
    expect(points.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(points[0] as Element)
    fireEvent.click(points[1] as Element)

    const addBridgeBtn = container.querySelector('button[data-add-bridge="true"]') as HTMLButtonElement
    expect(addBridgeBtn.disabled).toBe(false)
    fireEvent.click(addBridgeBtn)

    const overlayLines = container.querySelectorAll('[data-shape-editor-overlay] line')
    expect(overlayLines.length).toBe(1)
  })

  it('shows dangling vertices only after a shape is selected in shape mode', () => {
    const { container, getByText } = render(
      <SvgPathInspector
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          shapeStatus: {},
          customShapes: [
            { id: 'seed', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          hiddenShapeIds: [],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    fireEvent.click(container.querySelector('button[data-editor-mode="shape"]') as HTMLButtonElement)
    fireEvent.click(getByText('シェイプ'))
    expect(container.querySelectorAll('[data-dangling-vertex]').length).toBe(0)

    fireEvent.click(container.querySelector('[data-shape-row="seed"]') as HTMLDivElement)
    expect(container.querySelectorAll('[data-dangling-vertex]').length).toBeGreaterThanOrEqual(2)
  })

  it('assigns height to selected shape in shape mode', () => {
    const { container, getByText } = render(
      <SvgPathInspector
        rawSvg={RAW}
        initialConfig={{
          keepGroups: [],
          hiddenPathRanges: [],
          pathStatus: {},
          shapeStatus: {},
          customShapes: [
            { id: 'seed', pathIndices: [0, 1], isClosed: false, hasFill: false },
          ],
          hiddenShapeIds: [],
          shapeEdits: { bridges: [], relations: [], merges: [], splits: [] },
        }}
      />,
    )

    fireEvent.click(container.querySelector('button[data-editor-mode="shape"]') as HTMLButtonElement)
    fireEvent.click(getByText('シェイプ'))
    fireEvent.click(container.querySelector('[data-shape-row="seed"]') as HTMLDivElement)

    const input = container.querySelector('input[data-shape-height-input="true"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.click(container.querySelector('button[data-apply-shape-height="true"]') as HTMLButtonElement)

    expect(container.querySelector('[data-shape-row="seed"]')?.textContent).toContain('z:42')
  })
})
