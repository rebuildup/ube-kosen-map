/**
 * @module core/graph
 * Graph CRUD, validation engine, and JSON persistence.
 *
 * [P-1] Topology First: all CRUD operations enforce graph integrity
 * [P-2] Constraint-Driven: invalid operations return descriptive errors
 */

export type { Result } from './result'
export { ok, err } from './result'

export {
  addNode, updateNode, deleteNode,
  addEdge, updateEdge, deleteEdge,
  addSpace, updateSpace, deleteSpace,
} from './manager'

export { validate } from './validate'
export { saveCampusGraph, loadCampusGraph } from './persistence'
