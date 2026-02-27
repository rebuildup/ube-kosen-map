import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRender = vi.fn(async () => undefined)
const mockGetViewport = vi.fn(({ scale }: { scale: number }) => ({
  width: 600 * scale,
  height: 400 * scale,
}))
let seenDataRefs = new WeakSet<Uint8Array>()
const mockGetPage = vi.fn(async () => ({
  getViewport: mockGetViewport,
  render: vi.fn(() => ({ promise: mockRender() })),
}))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(({ data }: { data: Uint8Array }) => {
    if (seenDataRefs.has(data)) {
      throw new Error('ArrayBuffer at index 0 is already detached.')
    }
    seenDataRefs.add(data)
    return {
      promise: Promise.resolve({
        numPages: 4,
        getPage: mockGetPage,
      }),
    }
  }),
}))

describe('loadPdfPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seenDataRefs = new WeakSet<Uint8Array>()
  })

  it('renders selected page and returns data URL metadata', async () => {
    const toDataURL = vi.fn(() => 'data:image/png;base64,pdf')
    const getContext = vi.fn(() => ({} as CanvasRenderingContext2D))
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext,
          toDataURL,
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tagName)
    }) as typeof document.createElement)

    const { loadPdfPage } = await import('./loadPdfPage')
    const result = await loadPdfPage(new Uint8Array([37, 80, 68, 70]), 2)

    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Uint8Array),
        disableWorker: true,
      }),
    )
    expect(mockGetPage).toHaveBeenCalledWith(2)
    expect(mockGetViewport).toHaveBeenCalledWith({ scale: 1 })
    expect(result.dataUrl).toBe('data:image/png;base64,pdf')
    expect(result.width).toBe(4096)
    expect(result.height).toBeCloseTo(2731, 0)
    expect(result.pageCount).toBe(4)
  })

  it('can render the same source bytes multiple times (page switch)', async () => {
    const toDataURL = vi.fn(() => 'data:image/png;base64,pdf')
    const getContext = vi.fn(() => ({} as CanvasRenderingContext2D))
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext,
          toDataURL,
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tagName)
    }) as typeof document.createElement)

    const bytes = new Uint8Array([37, 80, 68, 70])
    const { loadPdfPage } = await import('./loadPdfPage')
    await expect(loadPdfPage(bytes, 1)).resolves.toBeTruthy()
    await expect(loadPdfPage(bytes, 2)).resolves.toBeTruthy()
  })
})
