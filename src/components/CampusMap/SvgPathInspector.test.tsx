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

  it('renders a row per style group', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const rows = container.querySelectorAll('[data-group-row]')
    expect(rows.length).toBe(2) // two unique styles
  })

  it('toggles a group off when its button is clicked', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const rows = container.querySelectorAll('[data-group-row]')
    const toggleBtn = rows[0]!.querySelector('button[data-toggle]') as HTMLButtonElement
    fireEvent.click(toggleBtn)
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toContain('display:none')
  })

  it('HIDE ALL hides all groups', () => {
    const { container, getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    fireEvent.click(getByText('HIDE ALL'))
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toContain('data-sg="0"')
    expect(style?.textContent).toContain('data-sg="1"')
  })

  it('SHOW ALL re-enables all groups', () => {
    const { container, getByText } = render(<SvgPathInspector rawSvg={RAW} />)
    fireEvent.click(getByText('HIDE ALL'))
    fireEvent.click(getByText('SHOW ALL'))
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toBe('')
  })

  it('hovering a row generates orange highlight CSS', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const row = container.querySelector('[data-group-row="0"]')!
    fireEvent.mouseEnter(row)
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toContain('stroke:orange')
    fireEvent.mouseLeave(row)
    expect(style?.textContent).not.toContain('stroke:orange')
  })

  it('shows expand indicator in each group row', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const rows = container.querySelectorAll('[data-group-row]')
    expect(rows[0]?.textContent).toContain('▶')
  })

  it('expands a group to show path rows when header is clicked', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    const row = container.querySelector('[data-group-row="0"]')!
    fireEvent.click(row)
    const pathRows = container.querySelectorAll('[data-path-row]')
    expect(pathRows.length).toBeGreaterThan(0)
  })

  it('toggles an individual path off', () => {
    const { container } = render(<SvgPathInspector rawSvg={RAW} />)
    // expand group 0
    fireEvent.click(container.querySelector('[data-group-row="0"]')!)
    // click path toggle
    const pathToggle = container.querySelector('[data-path-toggle]') as HTMLButtonElement
    fireEvent.click(pathToggle)
    const style = container.querySelector('[data-inspector-style]')
    expect(style?.textContent).toContain('data-sp=')
    expect(style?.textContent).toContain('display:none')
  })
})
