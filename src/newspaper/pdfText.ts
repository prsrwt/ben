// Reads every page's words, with their position and size, from a PDF using Mozilla's PDF.js. The PDF.js module
// is passed in, so the app can load it only when a paper is opened (and tests can use Node's build of it).

import type * as PdfJs from 'pdfjs-dist'

import { PageText } from './layout'

type TextContentItem = { str: string; transform: number[]; width: number }

export async function readPdfText(pdfjs: typeof PdfJs, data: Uint8Array | string): Promise<PageText[]> {
    const task = pdfjs.getDocument(typeof data === 'string' ? { url: data } : { data })
    const doc = await task.promise
    const pages: PageText[] = []
    try {
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n)
            const viewport = page.getViewport({ scale: 1 })
            const content = await page.getTextContent()
            const items = (content.items as TextContentItem[])
                .filter((item) => 'str' in item && item.str)
                .map((item) => {
                    // transform: [scaleX, skewY, skewX, scaleY, x, y], with y measured up from the page bottom.
                    const size = Math.hypot(item.transform[2], item.transform[3])
                    return { str: item.str, x: item.transform[4], y: viewport.height - item.transform[5] - size, width: item.width, size }
                })
            pages.push({ width: viewport.width, height: viewport.height, items })
            page.cleanup()
        }
    } finally {
        void task.destroy()
    }
    return pages
}
