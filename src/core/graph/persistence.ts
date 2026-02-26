/**
 * @module graph/persistence
 * JSON serialization / deserialization for CampusGraph.
 *
 * loadCampusGraph applies the autocomplete pipeline after parsing,
 * ensuring all fields are filled even if the JSON was saved without them.
 */

import type { CampusGraph } from '../schema'
import { autoComplete } from '../autocomplete'

export const saveCampusGraph = (graph: CampusGraph): string =>
  JSON.stringify(graph, null, 2)

export const loadCampusGraph = (json: string): CampusGraph => {
  const raw = JSON.parse(json) as CampusGraph
  return autoComplete(raw)
}
