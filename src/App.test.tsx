import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders TraceEditor as root component by default', () => {
    const { container } = render(<App />)
    expect(container.querySelector('[data-editor-root]')).not.toBeNull()
  })

  it('switches to viewer mode on button click', () => {
    const { container, getByRole } = render(<App />)
    fireEvent.click(getByRole('button', { name: 'ビューアー' }))
    expect(container.querySelector('[data-testid="campus-viewer"]')).not.toBeNull()
  })

  it('switches back to editor mode', () => {
    const { container, getByRole } = render(<App />)
    fireEvent.click(getByRole('button', { name: 'ビューアー' }))
    fireEvent.click(getByRole('button', { name: 'エディター' }))
    expect(container.querySelector('[data-editor-root]')).not.toBeNull()
  })
})
