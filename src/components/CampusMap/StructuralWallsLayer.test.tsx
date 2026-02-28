// src/components/CampusMap/StructuralWallsLayer.test.tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { StructuralWallsLayer } from './StructuralWallsLayer'
import type { Segment } from '../../importer/svg/parseSvgSegments'

const vb = { minX: 0, minY: 0, width: 100, height: 100 }

const seg = (ax: number, ay: number, bx: number, by: number, kind = 'building'): Segment => ({
  a: { x: ax, y: ay }, b: { x: bx, y: by }, kind: kind as any, featureId: 'B001',
})

describe('StructuralWallsLayer', () => {
  it('renders one wall div per segment', () => {
    const { container } = render(
      <StructuralWallsLayer
        segments={[seg(0, 0, 10, 0), seg(20, 0, 30, 20)]}
        viewBox={vb}
        defaultWallHeight={30}
        heights={{}}
        mode="3d"
      />
    )
    const walls = container.querySelectorAll('[data-wall]')
    expect(walls.length).toBe(2)
  })

  it('does not render walls in flat mode', () => {
    const { container } = render(
      <StructuralWallsLayer
        segments={[seg(0, 0, 10, 0)]}
        viewBox={vb}
        defaultWallHeight={30}
        heights={{}}
        mode="flat"
      />
    )
    const walls = container.querySelectorAll('[data-wall]')
    expect(walls.length).toBe(0)
  })

  it('applies rotateX(90deg) transform to each wall', () => {
    const { container } = render(
      <StructuralWallsLayer
        segments={[seg(0, 0, 50, 0)]}
        viewBox={vb}
        defaultWallHeight={30}
        heights={{}}
        mode="3d"
      />
    )
    const wall = container.querySelector('[data-wall]') as HTMLElement
    expect(wall?.style.transform).toContain('rotateX(90deg)')
  })

  it('applies rotateZ for diagonal segments', () => {
    const { container } = render(
      <StructuralWallsLayer
        segments={[seg(0, 0, 10, 10)]}
        viewBox={vb}
        defaultWallHeight={30}
        heights={{}}
        mode="3d"
      />
    )
    const wall = container.querySelector('[data-wall]') as HTMLElement
    expect(wall?.style.transform).toContain('rotateZ(')
  })

  it('uses height from heights map when featureId matches', () => {
    const { container } = render(
      <StructuralWallsLayer
        segments={[seg(0, 0, 10, 0)]}
        viewBox={vb}
        defaultWallHeight={20}
        heights={{ B001: 50 }}
        mode="3d"
      />
    )
    const wall = container.querySelector('[data-wall]') as HTMLElement
    expect(wall?.style.height).toBe('50px')
  })

  it('filters segments by visible kinds', () => {
    const segs = [seg(0, 0, 10, 0, 'building'), seg(10, 0, 20, 0, 'road')]
    const { container } = render(
      <StructuralWallsLayer
        segments={segs}
        viewBox={vb}
        defaultWallHeight={30}
        heights={{}}
        mode="3d"
        visibleKinds={new Set(['building'])}
      />
    )
    const walls = container.querySelectorAll('[data-wall]')
    expect(walls.length).toBe(1)
  })
})
