import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()
}

export interface PdfPageImage {
  dataUrl: string
  width: number
  height: number
  pageCount: number
}

export const loadPdfPage = async (
  pdfBytes: Uint8Array,
  pageNumber: number,
  minScale = 1.5,
): Promise<PdfPageImage> => {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), disableWorker: true })
  const documentProxy = await loadingTask.promise
  const safePage = Math.max(1, Math.min(pageNumber, documentProxy.numPages))
  const page = await documentProxy.getPage(safePage)
  const baseViewport = page.getViewport({ scale: 1 })
  const maxLongEdge = 4096
  const maxPixels = 32_000_000
  const edgeScale = maxLongEdge / Math.max(baseViewport.width, baseViewport.height)
  const pixelScale = Math.sqrt(maxPixels / Math.max(1, baseViewport.width * baseViewport.height))
  const autoScale = Math.max(1, Math.min(edgeScale, pixelScale))
  const renderScale = Math.max(minScale, autoScale)
  const viewport = page.getViewport({ scale: renderScale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to create 2D context for PDF rendering')
  }

  await page.render({ canvas, canvasContext: context, viewport }).promise

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    pageCount: documentProxy.numPages,
  }
}
