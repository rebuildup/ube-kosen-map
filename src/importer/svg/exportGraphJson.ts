import { saveCampusGraph } from '../../core/graph/persistence'
import { validate } from '../../core/graph/validate'
import { buildGraphFromSvg } from './buildGraphFromSvg'

export const exportGraphJson = (rawSvg: string) => {
  const graph = buildGraphFromSvg(rawSvg, { buildingName: 'page-1', floorLevel: 1 })
  const report = validate(graph)

  if (!report.isValid) {
    return { ok: false as const, report, json: '' }
  }

  return {
    ok: true as const,
    report,
    json: saveCampusGraph(graph),
  }
}
