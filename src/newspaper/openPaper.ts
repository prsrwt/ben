// Opens a newspaper PDF from the Library as a Reader article. Imported only when a paper is opened, so PDF.js
// (and its worker, a separate file) cost nothing until then.

import { convertFileSrc } from '@tauri-apps/api/core'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { Article } from '~/reader/extractArticle'

import { isReadable, readPaper } from './layout'
import { paperToArticle } from './paperArticle'
import { paperFile } from './paperFile'
import { readPdfText } from './pdfText'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function openPaper(url: string): Promise<Article> {
    const { path, title } = paperFile(url)
    let bytes: Uint8Array
    try {
        // Through the asset protocol, which the Library allows for the folders the student chose.
        const response = await fetch(convertFileSrc(path))
        if (!response.ok) {
            throw new Error(String(response.status))
        }
        bytes = new Uint8Array(await response.arrayBuffer())
    } catch {
        throw new Error("Couldn't open this file. It may have been moved, or its folder is no longer in the Library.")
    }
    const pages = await readPdfText(pdfjs, bytes)
    if (!isReadable(pages)) {
        throw new Error(
            "This paper is a scan (or its letters are scrambled), so Ben can't read its text yet. Open it from the Library to see the PDF."
        )
    }
    const paper = readPaper(pages)
    if (paper.sections.length === 0) {
        throw new Error("Ben couldn't find any stories in this paper. Open it from the Library to see the PDF.")
    }
    return paperToArticle(paper, { url, title, site: 'Newspaper' })
}
