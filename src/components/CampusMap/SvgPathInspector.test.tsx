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
})
