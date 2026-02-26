/**
 * @module graph/validate
 * Validation engine for CampusGraph invariants.
 *
 * Checks all invariants from graph-schema.md and returns a ValidationResult
 * with ruleId, severity, message, and targetIds for each issue found.
 */

import type { CampusGraph, ValidationResult, ValidationIssue } from '../schema'
import { isSelfIntersecting } from '../../math'

export const validate = (graph: CampusGraph): ValidationResult => {
  const issues: ValidationIssue[] = []

  // Build edge adjacency: nodeId → set of connected nodeIds
  const connectedNodeIds = new Set<string>()
  for (const edge of Object.values(graph.edges)) {
    connectedNodeIds.add(edge.sourceNodeId)
    connectedNodeIds.add(edge.targetNodeId)
  }

  // ── Node invariants ─────────────────────────────────────────────────────────

  for (const node of Object.values(graph.nodes)) {
    // NI-1: Isolated node (Error)
    if (!connectedNodeIds.has(node.id)) {
      issues.push({
        ruleId: 'NI-1',
        severity: 'error',
        message: `Node "${node.id}" has no edges (isolated node).`,
        targetIds: [node.id],
        policy: 'P-1',
      })
    }

    // NI-2: staircase/elevator without verticalLinks (Warning)
    if (
      (node.type === 'staircase' || node.type === 'elevator') &&
      !node.verticalLinks
    ) {
      issues.push({
        ruleId: 'NI-2',
        severity: 'warning',
        message: `Node "${node.id}" (type: ${node.type}) has no verticalLinks.`,
        targetIds: [node.id],
        policy: 'P-1',
      })
    }
  }

  // ── Edge invariants ─────────────────────────────────────────────────────────

  // Track (source, target) pairs for duplicate detection (EI-3)
  const pairSeen = new Map<string, string>() // "src|dst" → edgeId

  for (const edge of Object.values(graph.edges)) {
    // EI-1: Broken references (Error)
    const srcExists = Boolean(graph.nodes[edge.sourceNodeId])
    const dstExists = Boolean(graph.nodes[edge.targetNodeId])
    if (!srcExists || !dstExists) {
      issues.push({
        ruleId: 'EI-1',
        severity: 'error',
        message: `Edge "${edge.id}" references non-existent node(s).`,
        targetIds: [edge.id, edge.sourceNodeId, edge.targetNodeId],
        policy: 'P-1',
      })
      continue // skip further checks for broken edge
    }

    // EI-2: Self-loop (Error)
    if (edge.sourceNodeId === edge.targetNodeId) {
      issues.push({
        ruleId: 'EI-2',
        severity: 'error',
        message: `Edge "${edge.id}" is a self-loop (source === target).`,
        targetIds: [edge.id],
        policy: 'P-1',
      })
    }

    // EI-3: Duplicate edges (Warning)
    // Consider bidirectional: normalize pair as (min, max)
    const a = edge.sourceNodeId < edge.targetNodeId ? edge.sourceNodeId : edge.targetNodeId
    const b = edge.sourceNodeId < edge.targetNodeId ? edge.targetNodeId : edge.sourceNodeId
    const pairKey = `${a}|${b}`
    const existing = pairSeen.get(pairKey)
    if (existing) {
      issues.push({
        ruleId: 'EI-3',
        severity: 'warning',
        message: `Duplicate edge between nodes "${a}" and "${b}" (edges "${existing}" and "${edge.id}").`,
        targetIds: [existing, edge.id],
        policy: 'P-1',
      })
    } else {
      pairSeen.set(pairKey, edge.id)
    }
  }

  // ── Space invariants ────────────────────────────────────────────────────────

  for (const space of Object.values(graph.spaces)) {
    // SI-3: Self-intersecting polygon (Error)
    if (space.polygon && isSelfIntersecting(space.polygon)) {
      issues.push({
        ruleId: 'SI-3',
        severity: 'error',
        message: `Space "${space.id}" has a self-intersecting polygon.`,
        targetIds: [space.id],
        policy: 'P-1',
      })
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const errors   = issues.filter(i => i.severity === 'error').length
  const warnings = issues.filter(i => i.severity === 'warning').length

  return {
    isValid: errors === 0,
    issues,
    summary: { errors, warnings },
  }
}
