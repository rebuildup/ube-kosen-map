import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('アプリタイトルが表示される', () => {
    render(<App />)
    expect(screen.getByText('宇部高専キャンパスマップ')).toBeDefined()
  })
})
