import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { StructuralSvgPseudo3D } from './StructuralSvgPseudo3D'

const RAW = [
  '<svg viewBox="0 0 20 20">',
  '<g>',
  '<path d="M1 1 L10 1 L10 10" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M10 10 L1 10 L1 1" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M12 2 L18 2" style="fill:none;stroke:#111;stroke-width:1;" />',
  '</g>',
  '</svg>',
].join('')

describe('StructuralSvgPseudo3D (rebuilt)', () => {
  it('renders in flat mode when requested', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW} mode="flat" />)
    const scene = container.querySelector('[data-structural-scene="true"]')
    expect(scene?.getAttribute('data-mode')).toBe('flat')
  })

  it('supports wheel zoom in 3d mode', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW} mode="3d" />)
    const root = container.querySelector('[data-structural-3d="true"]') as HTMLElement
    const scene = container.querySelector('[data-structural-scene="true"]') as HTMLElement
    const before = scene.style.transform
    fireEvent.wheel(root, { deltaY: -100 })
    expect(scene.style.transform).not.toBe(before)
  })

  it('supports drag rotation in 3d mode', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW} mode="3d" />)
    const root = container.querySelector('[data-structural-3d="true"]') as HTMLElement
    const scene = container.querySelector('[data-structural-scene="true"]') as HTMLElement
    const before = scene.style.transform
    fireEvent.mouseDown(root, { clientX: 10, clientY: 10, button: 2 })
    fireEvent.mouseMove(root, { clientX: 50, clientY: 40, buttons: 2 })
    fireEvent.mouseUp(root)
    expect(scene.style.transform).not.toBe(before)
  })

  it('renders shape solid walls from shapeFaces', () => {
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        shapeFaces={[
          { id: 'face-a', pathIndices: [0, 1], height: 24, color: '#22c55e' },
        ]}
      />,
    )

    const walls = container.querySelectorAll('[data-shape-solid-wall="face-a"]')
    expect(walls.length).toBeGreaterThan(0)
  })

  it('renders top edges at assigned height', () => {
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        shapeFaces={[
          { id: 'face-a', pathIndices: [0, 1], baseZ: 12, height: 24, color: '#22c55e' },
        ]}
      />,
    )

    const top = container.querySelector('[data-shape-solid-top]') as HTMLElement | null
    expect(top).not.toBeNull()
    expect(top?.style.transform).toContain('translateZ(36px)')
  })

  it('applies zScale only to Z direction', () => {
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        zScale={8}
        shapeFaces={[
          { id: 'face-a', pathIndices: [0, 1], baseZ: 2, height: 4, color: '#22c55e' },
        ]}
      />,
    )

    const base = container.querySelector('[data-shape-solid-base]') as HTMLElement | null
    const top = container.querySelector('[data-shape-solid-top]') as HTMLElement | null
    expect(base).not.toBeNull()
    expect(top).not.toBeNull()
    expect(base?.style.transform).toContain('translateZ(16px)')
    expect(top?.style.transform).toContain('translateZ(48px)')
  })

  it('renders only base planes in layer-floor mode', () => {
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        renderAsLayerFloors
        shapeFaces={[
          { id: 'face-a', pathIndices: [0, 1], baseZ: 2, height: 10, color: '#22c55e' },
        ]}
      />,
    )

    expect(container.querySelector('[data-shape-solid-base]')).not.toBeNull()
    expect(container.querySelector('[data-shape-solid-top]')).toBeNull()
  })

  it('renders transition guides between two layer heights', () => {
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        shapeTransitions={[
          {
            id: 'tr-1',
            kind: 'stairs',
            fromZ: 0,
            toZ: 20,
            lowerPathIndices: [0],
            upperPathIndices: [1],
            stepCount: 4,
          },
        ]}
      />,
    )
    expect(container.querySelector('[data-shape-transition-lower="tr-1"]')).not.toBeNull()
    expect(container.querySelector('[data-shape-transition-upper="tr-1"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-shape-transition-step="tr-1"]').length).toBe(3)
  })

  it('filters base plane to only visiblePathIndices when provided', () => {
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        visiblePathIndices={[0, 1]}
      />,
    )
    const style = container.querySelector('svg style')?.textContent ?? ''
    expect(style).toContain('display:none')
    expect(style).toContain('[data-sp="0"]')
    expect(style).toContain('[data-sp="1"]')
    expect(style).toContain('text')
  })

  it('emits onPathSelect when clicking a rendered 3d path', () => {
    const onPathSelect = vi.fn()
    const { container } = render(
      <StructuralSvgPseudo3D
        rawSvg={RAW}
        mode="3d"
        onPathSelect={onPathSelect}
        shapeFaces={[{ id: 'face-a', pathIndices: [0, 1], baseZ: 2, height: 4, color: '#22c55e' }]}
      />,
    )
    const path = container.querySelector('svg[data-plane-id] [data-sp="0"]') as SVGElement | null
    expect(path).not.toBeNull()
    fireEvent.click(path as Element)
    expect(onPathSelect).toHaveBeenCalledWith(0, { additive: false, toggle: false })
  })
})
