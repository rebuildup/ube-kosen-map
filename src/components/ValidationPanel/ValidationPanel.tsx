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

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  warning: { bg: '#fefce8', border: '#fcd34d', text: '#d97706' },
}

const IssueRow: React.FC<{
  issue: ValidationIssue
  onFocus?: (ids: string[]) => void
}> = ({ issue, onFocus }) => {
  const colors = SEVERITY_COLORS[issue.severity] ?? { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' }

  return (
    <div
      role="listitem"
      data-rule-id={issue.ruleId}
      data-severity={issue.severity}
      onClick={() => onFocus?.(issue.targetIds)}
      style={{
        padding: '6px 10px',
        marginBottom: 4,
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        cursor: onFocus ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 11,
          color: colors.text,
          padding: '1px 5px',
          borderRadius: 3,
          background: colors.border,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {issue.ruleId}
      </span>
      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
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
          padding: 12,
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 6,
          color: '#15803d',
          fontWeight: 600,
          fontSize: 13,
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
          padding: '6px 10px',
          background: '#f9fafb',
          borderRadius: 4,
          marginBottom: 4,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {errors.length > 0 && (
          <span style={{ color: '#dc2626' }}>
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span style={{ color: '#d97706' }}>
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
