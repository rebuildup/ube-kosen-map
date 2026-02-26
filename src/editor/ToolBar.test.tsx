import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ToolBar } from './ToolBar'

describe('ToolBar', () => {
  it('renders buttons for select, space, node, door tools', () => {
    const { container } = render(<ToolBar activeTool="select" onToolChange={vi.fn()} />)
    expect(container.querySelector('[data-tool="select"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="space"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="node"]')).not.toBeNull()
    expect(container.querySelector('[data-tool="door"]')).not.toBeNull()
  })

  it('marks active tool with aria-pressed', () => {
    const { container } = render(<ToolBar activeTool="node" onToolChange={vi.fn()} />)
    const btn = container.querySelector('[data-tool="node"]')!
    expect((btn as HTMLElement).getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onToolChange when a tool button is clicked', () => {
    const onChange = vi.fn()
    const { container } = render(<ToolBar activeTool="select" onToolChange={onChange} />)
    fireEvent.click(container.querySelector('[data-tool="space"]')!)
    expect(onChange).toHaveBeenCalledWith('space')
  })

  it('renders undo/redo buttons', () => {
    const { container } = render(
      <ToolBar activeTool="select" onToolChange={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()} />,
    )
    expect(container.querySelector('[data-action="undo"]')).not.toBeNull()
    expect(container.querySelector('[data-action="redo"]')).not.toBeNull()
  })

  it('disables undo when canUndo=false', () => {
    const { container } = render(
      <ToolBar activeTool="select" onToolChange={vi.fn()} canUndo={false} onUndo={vi.fn()} />,
    )
    const btn = container.querySelector('[data-action="undo"]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })
})
