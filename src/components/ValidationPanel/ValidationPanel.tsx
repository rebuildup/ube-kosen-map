/**
 * ValidationPanel — Displays validation errors and warnings in a side panel.
 *
 * [P-2] Constraint-Driven: visual feedback for all graph integrity violations.
 */

import React from 'react'
import type { ValidationResult, ValidationIssue } from '../../core/schema'

export interface ValidationPanelProps {
  result: ValidationResult
  /** Called when user clicks an issue to focus the related entity */
  onFocus?: (targetIds: string[]) => void
}

const SEVERITY_COLORS: Record<string, { border: string; text: string; badgeBg: string }> = {
  error:   { border: 'rgba(248,113,113,0.3)', text: 'var(--red)',    badgeBg: 'rgba(248,113,113,0.15)' },
  warning: { border: 'rgba(251,191,36,0.3)',  text: 'var(--amber)',  badgeBg: 'rgba(251,191,36,0.15)' },
}

const IssueRow: React.FC<{
  issue: ValidationIssue
  onFocus?: (ids: string[]) => void
}> = ({ issue, onFocus }) => {
  const colors = SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.error

  return (
    <div
      role="listitem"
      data-rule-id={issue.ruleId}
      data-severity={issue.severity}
      onClick={() => onFocus?.(issue.targetIds)}
      style={{
        padding: '6px 10px',
        marginBottom: 4,
        borderRadius: 3,
        border: `1px solid ${colors.border}`,
        background: colors.badgeBg,
        cursor: onFocus ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 9,
          color: colors.text,
          padding: '1px 5px',
          borderRadius: 2,
          background: colors.badgeBg,
          border: `1px solid ${colors.border}`,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
        }}
      >
        {issue.ruleId}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {issue.message}
      </span>
    </div>
  )
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ result, onFocus }) => {
  if (result.isValid) {
    return (
      <div
        data-valid="true"
        style={{
          padding: '8px 12px',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 3,
          color: 'var(--green)',
          fontWeight: 600,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}
      >
        No issues found
      </div>
    )
  }

  const errors   = result.issues.filter(i => i.severity === 'error')
  const warnings = result.issues.filter(i => i.severity === 'warning')

  return (
    <div
      role="list"
      aria-label="validation issues"
      style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {/* Summary */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '5px 10px',
          background: 'var(--bg-2)',
          borderRadius: 3,
          marginBottom: 4,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {errors.length > 0 && (
          <span style={{ color: 'var(--red)' }}>
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span style={{ color: 'var(--amber)' }}>
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Errors first */}
      {errors.map((issue, i) => (
        <IssueRow key={`e-${i}`} issue={issue} onFocus={onFocus} />
      ))}
      {/* Then warnings */}
      {warnings.map((issue, i) => (
        <IssueRow key={`w-${i}`} issue={issue} onFocus={onFocus} />
      ))}
    </div>
  )
}
