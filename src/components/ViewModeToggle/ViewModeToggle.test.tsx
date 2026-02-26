import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ViewModeToggle, VIEW_MODES } from './ViewModeToggle'
import type { ViewMode } from './ViewModeToggle'

describe('ViewModeToggle', () => {
  it('renders a button for each view mode', () => {
    const { container } = render(
      <ViewModeToggle mode="aerial" onChange={vi.fn()} />,
    )
    const buttons = container.querySelectorAll('button[data-mode]')
    expect(buttons.length).toBe(VIEW_MODES.length)
  })

  it('marks active mode with aria-pressed', () => {
    const { container } = render(
      <ViewModeToggle mode="pseudo-3d" onChange={vi.fn()} />,
    )
    const active = container.querySelector('button[aria-pressed="true"]')
    expect(active).not.toBeNull()
    expect((active as HTMLElement).dataset.mode).toBe('pseudo-3d')
  })

  it('calls onChange when a different mode is clicked', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ViewModeToggle mode="aerial" onChange={onChange} />,
    )
    const btn = container.querySelector('[data-mode="cross-section"]') as HTMLElement
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledWith('cross-section' satisfies ViewMode)
  })

  it('does not call onChange when active mode is clicked again', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ViewModeToggle mode="aerial" onChange={onChange} />,
    )
    const btn = container.querySelector('[data-mode="aerial"]') as HTMLElement
    fireEvent.click(btn)
    expect(onChange).not.toHaveBeenCalled()
  })
})
