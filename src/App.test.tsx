import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders TraceEditor as root component', () => {
    const { container } = render(<App />)
    expect(container.querySelector('[data-editor-root]')).not.toBeNull()
  })
})
