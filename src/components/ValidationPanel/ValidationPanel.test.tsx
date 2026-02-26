import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ValidationPanel } from './ValidationPanel'
import type { ValidationResult } from '../../core/schema'

const makeResult = (overrides: Partial<ValidationResult> = {}): ValidationResult => ({
  isValid: false,
  issues: [
    {
      ruleId: 'NI-1',
      severity: 'error',
      message: 'Node "abc" is isolated.',
      targetIds: ['abc'],
      policy: 'P-1',
    },
    {
      ruleId: 'EI-3',
      severity: 'warning',
      message: 'Duplicate edge between "x" and "y".',
      targetIds: ['x', 'y'],
      policy: 'P-1',
    },
  ],
  summary: { errors: 1, warnings: 1 },
  ...overrides,
})

describe('ValidationPanel', () => {
  it('renders all issues', () => {
    const result = makeResult()
    const { container } = render(<ValidationPanel result={result} />)
    const items = container.querySelectorAll('[data-rule-id]')
    expect(items.length).toBe(2)
  })

  it('shows rule IDs', () => {
    const result = makeResult()
    const { getAllByText } = render(<ValidationPanel result={result} />)
    expect(getAllByText(/NI-1/).length).toBeGreaterThan(0)
    expect(getAllByText(/EI-3/).length).toBeGreaterThan(0)
  })

  it('marks error items with data-severity="error"', () => {
    const result = makeResult()
    const { container } = render(<ValidationPanel result={result} />)
    const errorEl = container.querySelector('[data-severity="error"]')
    expect(errorEl).toBeTruthy()
  })

  it('marks warning items with data-severity="warning"', () => {
    const result = makeResult()
    const { container } = render(<ValidationPanel result={result} />)
    const warnEl = container.querySelector('[data-severity="warning"]')
    expect(warnEl).toBeTruthy()
  })

  it('calls onFocus with targetIds when clicking an issue', () => {
    const result = makeResult()
    const onFocus = vi.fn()
    const { container } = render(<ValidationPanel result={result} onFocus={onFocus} />)
    const firstIssue = container.querySelector('[data-rule-id]')!
    fireEvent.click(firstIssue)
    expect(onFocus).toHaveBeenCalledWith(['abc'])
  })

  it('shows "valid" state when no issues', () => {
    const result: ValidationResult = {
      isValid: true,
      issues: [],
      summary: { errors: 0, warnings: 0 },
    }
    const { container } = render(<ValidationPanel result={result} />)
    expect(container.querySelector('[data-valid="true"]')).toBeTruthy()
  })

  it('displays the error/warning summary counts', () => {
    const result = makeResult()
    const { getByText } = render(<ValidationPanel result={result} />)
    expect(getByText(/1 error/i)).toBeTruthy()
    expect(getByText(/1 warning/i)).toBeTruthy()
  })
})
