import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ReferencePanel } from './ReferencePanel'
import type { ReferenceImageState } from './useReferenceImage'

const makeRef = (overrides: Partial<ReferenceImageState> = {}): ReferenceImageState => ({
  dataUrl: 'data:image/png;base64,x',
  opacity: 0.5,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  naturalWidth: 1000,
  naturalHeight: 800,
  cropX: 0,
  cropY: 0,
  cropWidth: 1000,
  cropHeight: 800,
  pageCount: 1,
  currentPage: 1,
  ...overrides,
})

const makeProps = () => ({
  references: [{ id: 'r1', name: 'ref-1', ref: makeRef() }],
  activeId: 'r1',
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onRemoveActive: vi.fn(),
  actions: {
    setOpacity: vi.fn(),
    setX: vi.fn(),
    setY: vi.fn(),
    setScale: vi.fn(),
    setRotation: vi.fn(),
    setCrop: vi.fn(),
    setCurrentPage: vi.fn(),
  },
})

describe('ReferencePanel', () => {
  it('renders add/import button', () => {
    const props = makeProps()
    const { container } = render(<ReferencePanel {...props} />)
    expect(container.querySelector('[data-ref-import]')).not.toBeNull()
  })

  it('renders selector when multiple references exist', () => {
    const props = makeProps()
    props.references.push({ id: 'r2', name: 'ref-2', ref: makeRef() })
    const { container } = render(<ReferencePanel {...props} />)
    expect(container.querySelector('[data-ref-select]')).not.toBeNull()
  })

  it('invokes setCrop when crop width changes', () => {
    const props = makeProps()
    const { container } = render(<ReferencePanel {...props} />)
    fireEvent.change(container.querySelector('[data-ref-crop-width]')!, {
      target: { value: '640' },
    })
    expect(props.actions.setCrop).toHaveBeenCalled()
  })
})
