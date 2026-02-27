import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { StructuralSvgPseudo3D } from './StructuralSvgPseudo3D'

const RAW = [
  '<svg viewBox="0 0 20 20">',
  '<g>',
  '<path d="M0 0 L10 0" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 1 L10 1" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 2 L10 2" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 3 L10 3" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 4 L10 4" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 5 L10 5" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 6 L10 6" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 7 L10 7" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 8 L10 8" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 9 L10 9" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 10 L10 10" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 11 L10 11" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 12 L10 12" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 13 L10 13" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 14 L10 14" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 15 L10 15" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 16 L10 16" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 17 L10 17" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 18 L10 18" style="fill:none;stroke:#111;stroke-width:1;" />',
  '<path d="M0 19 L10 19" style="fill:none;stroke:#111;stroke-width:1;" />',
  '</g>',
  '</svg>',
].join('')

const RAW_MULTI = [
  '<svg viewBox="0 0 20 20">',
  '<g>',
  '<path d="M0 0 L10 0 L10 10" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 10 L10 10" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 0 L10 0 L10 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
  '<path d="M0 10 L10 10" style="fill:none;stroke:#444;stroke-width:1.2;" />',
  '<path d="M0 1 L10 1" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 2 L10 2" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 3 L10 3" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 4 L10 4" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 5 L10 5" style="fill:none;stroke:#111;stroke-width:0.2;" />',
  '<path d="M0 6 L10 6" style="fill:none;stroke:#444;stroke-width:1.2;" />',
  '<path d="M0 7 L10 7" style="fill:none;stroke:#444;stroke-width:1.2;" />',
  '<path d="M0 8 L10 8" style="fill:none;stroke:#444;stroke-width:1.2;" />',
  '<path d="M0 9 L10 9" style="fill:none;stroke:#444;stroke-width:1.2;" />',
  '</g>',
  '</svg>',
].join('')

describe('StructuralSvgPseudo3D', () => {
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
    fireEvent.mouseDown(root, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.mouseMove(root, { clientX: 50, clientY: 40, buttons: 1 })
    fireEvent.mouseUp(root)
    expect(scene.style.transform).not.toBe(before)
  })

  it('renders z-axis frame pillars in 3d mode', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW} mode="3d" />)
    const frame = container.querySelector('[data-structural-frame="true"]')
    expect(frame).not.toBeNull()
  })

  it('renders z-links between matching vertices across layers', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW_MULTI} mode="3d" />)
    const links = container.querySelectorAll('[data-structural-z-link="true"]')
    expect(links.length).toBeGreaterThan(0)
  })

  it('renders z-links as true z-axis bars in scene 3d space', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW_MULTI} mode="3d" />)
    const frame = container.querySelector('[data-structural-frame="true"]') as HTMLElement | null
    const link = container.querySelector('[data-structural-z-link="true"]') as HTMLElement | null
    expect(frame).not.toBeNull()
    expect(frame?.style.transformStyle).toBe('preserve-3d')
    expect(link).not.toBeNull()
    expect(link?.style.transform).toContain('translateZ(')
    expect(link?.style.transform).toContain('rotateX(90deg)')
  })

  it('renders endpoint markers for z-links', () => {
    const { container } = render(<StructuralSvgPseudo3D rawSvg={RAW_MULTI} mode="3d" />)
    const starts = container.querySelectorAll('[data-structural-z-point="start"]')
    const ends = container.querySelectorAll('[data-structural-z-point="end"]')
    expect(starts.length).toBeGreaterThan(0)
    expect(ends.length).toBeGreaterThan(0)
  })
})
