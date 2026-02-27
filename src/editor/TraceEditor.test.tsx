import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TraceEditor } from './TraceEditor'

describe('TraceEditor', () => {
  it('renders the editor root element', () => {
    const { container } = render(<TraceEditor />)
    expect(container.querySelector('[data-editor-root]')).not.toBeNull()
  })

  it('has a toolbar with tool buttons', () => {
    const { container } = render(<TraceEditor />)
    expect(container.querySelector('[data-tool="select"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="space"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="node"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="door"]')).not.toBeNull()
  })

  it('has a canvas area', () => {
    const { container } = render(<TraceEditor />)
    expect(container.querySelector('[data-editor-canvas]')).not.toBeNull()
  })

  it('shows 選択なし in attribute panel by default', () => {
    const { container } = render(<TraceEditor />)
    expect(container.textContent).toContain('選択なし')
  })

  it('switches tool when toolbar button is clicked', () => {
    const { container } = render(<TraceEditor />)
    fireEvent.click(container.querySelector('[data-tool="space"]')!)
    const spaceBtn = container.querySelector('[data-tool="space"]') as HTMLElement
    expect(spaceBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders reference panel import action', () => {
    const { container } = render(<TraceEditor />)
    expect(container.querySelector('[data-ref-import]')).not.toBeNull()
  })
})
