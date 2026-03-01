/**
 * One-off script to analyze page_1.svg group structure for semi-manual grouping.
 * Run: pnpm exec vitest run src/importer/svg/analyzePage1Groups.test.ts
 */
import { describe, it } from 'vitest'
import { groupSvgPaths } from './groupSvgPaths'
import page1SvgRaw from '../../../docs/reference/page_1.svg?raw'

describe('analyze page_1 groups (run with --reporter=verbose to see output)', () => {
  it('prints group structure for semi-manual mapping', () => {
    const { groups } = groupSvgPaths(page1SvgRaw)

    console.log('\n=== page_1.svg Group Structure ===\n')
    console.log('Total groups:', groups.length)

    groups.forEach((g, i) => {
      const totalPaths = g.shapes.reduce((a, s) => a + s.paths.length, 0)
      console.log(`\nGroup ${i}: count=${g.count} shapes=${g.shapes.length} paths=${totalPaths}`)
      console.log(`  stroke: ${g.strokeColor} | stroke-width: ${g.strokeWidth} | fill: ${g.fillColor}`)

      if (g.shapes.length <= 15) {
        g.shapes.forEach((s, si) => {
          const pathRange =
            s.paths.length > 0
              ? `${s.paths[0]!.pathIndex}-${s.paths[s.paths.length - 1]!.pathIndex}`
              : '-'
          console.log(`    shape ${si}: ${s.paths.length} paths [${pathRange}] closed=${s.isClosed}`)
        })
      } else {
        const first = g.shapes.slice(0, 5)
        const last = g.shapes.slice(-5)
        first.forEach((s, si) => {
          const pathRange =
            s.paths.length > 0
              ? `${s.paths[0]!.pathIndex}-${s.paths[s.paths.length - 1]!.pathIndex}`
              : '-'
          console.log(`    shape ${si}: ${s.paths.length} paths [${pathRange}] closed=${s.isClosed}`)
        })
        console.log(`    ... (${g.shapes.length - 10} more shapes)`)
        last.forEach((s, si) => {
          const pathRange =
            s.paths.length > 0
              ? `${s.paths[0]!.pathIndex}-${s.paths[s.paths.length - 1]!.pathIndex}`
              : '-'
          console.log(
            `    shape ${g.shapes.length - 5 + si}: ${s.paths.length} paths [${pathRange}] closed=${s.isClosed}`,
          )
        })
      }
    })
  })
})
