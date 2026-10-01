// Reads a scanned paper (or one whose fonts give scrambled letters) by looking at it: each page is drawn with
// PDF.js, about 2,400 pixels wide, and read by Windows' own text recognition (src/ocr/ocrApi.ts). The words come
// back with their boxes, in the same form as a PDF's own text, so the layout reads columns and headlines the
// same way. Runs only in the Ben app; a page takes a second or two.

import type * as PdfJs from 'pdfjs-dist'

import { ocrImage } from '~/ocr/ocrApi'

import type { PageText } from './layout'
import { ocrPageText } from './ocrPage'

/** Page width to draw at, in pixels: newspaper body text then stands about 25 pixels tall, which reads well. */
const TARGET_WIDTH = 2400

export async function readScannedPages(
    pdfjs: typeof PdfJs,
    data: Uint8Array,
    onProgress?: (done: number, total: number) => void
): Promise<PageText[]> {
    const task = pdfjs.getDocument({ data })
    const doc = await task.promise
    const pages: PageText[] = []
    try {
        for (let n = 1; n <= doc.numPages; n++) {
            onProgress?.(n - 1, doc.numPages)
            const page = await doc.getPage(n)
            const scale = Math.min(4, Math.max(1, TARGET_WIDTH / page.getViewport({ scale: 1 }).width))
            const viewport = page.getViewport({ scale })
            const canvas = document.createElement('canvas')
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            await page.render({ canvas, viewport, background: 'white' }).promise
            const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
            // Let go of the page's pixels at once: a drawn broadsheet page is tens of megabytes.
            canvas.width = canvas.height = 0
            page.cleanup()
            if (!image) {
                throw new Error("Ben couldn't draw this paper's pages to read them.")
            }
            try {
                pages.push(ocrPageText(await ocrImage(new Uint8Array(await image.arrayBuffer())), scale))
            } catch (e) {
                // The Rust side answers with a message for the student ("Windows can't read text in your language…").
                throw e instanceof Error ? e : new Error(String(e))
            }
        }
        onProgress?.(doc.numPages, doc.numPages)
    } finally {
        void task.destroy()
    }
    return pages
}
