// Reads a newspaper PDF from the Library into sections and stories (layout.ts). Imported only when a paper is
// opened, so PDF.js (and its worker, a separate file) cost nothing until then. A scanned paper (or one whose fonts
// give scrambled letters) is read page by page with Windows' text recognition (scanText.ts); a Hindi paper set in the
// old Kruti Dev font is turned into real Hindi (krutiDev.ts). The last few papers read are kept, so opening one of
// their stories in the Reader doesn't read the PDF again.

import { convertFileSrc } from '@tauri-apps/api/core'
// PDF.js's "legacy" build: the same code with fallbacks for features newer than some WebView2 versions have
// (drawing a page uses Map.getOrInsertComputed, which the modern build expects the browser to have). Its worker
// is built by Vite (?worker), so it takes Ben's word-space setting (vite.config.ts).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker&url'

import type { Article } from '~/reader/extractArticle'

import { krutiToUnicode, looksLikeHindi } from './krutiDev'
import { PageText, Paper, isReadable, readPaper } from './layout'
import { paperFile } from './paperFile'
import { readPdfText } from './pdfText'
import { readScannedPages } from './scanText'
import { storyArticle } from './stories'

// A worker per document (a shared one is shut down when any document closes).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Papers read, by path; the oldest is forgotten beyond this many. */
const KEPT = 3
const papers = new Map<string, Promise<{ paper: Paper; pages: number }>>()

export type Progress = (done: number, total: number) => void

/** The words of a paper's first pages, to judge them by. */
const allText = (pages: PageText[]): string =>
    pages
        .slice(0, 4)
        .flatMap((p) => p.items.map((i) => i.str))
        .join(' ')

/** Papers printed in Hindi (as the Library names them): their text must be Devanagari, and a scan is read as Hindi. */
const HINDI_PAPERS = new Set(['Dainik Jagran', 'Amar Ujala', 'Dainik Bhaskar', 'Navbharat Times', 'Hindustan', 'Jansatta', 'Rajasthan Patrika', 'Prabhat Khabar'])
const isHindi = (paper: string | null, title: string): boolean => (paper !== null && HINDI_PAPERS.has(paper)) || /[\u0900-\u097F]/.test(title)

async function read(path: string, hindi: boolean, onProgress?: Progress): Promise<{ paper: Paper; pages: number }> {
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
    // PDF.js takes over the bytes it's given, so the first reading gets a copy.
    let pages = await readPdfText(pdfjs, bytes.slice())
    if (hindi && !isReadable(pages, { devanagari: true }) && isReadable(pages)) {
        // Text, but not Hindi letters: a Hindi paper set in an old font. Kruti Dev's is the common one.
        const converted = pages.map((page) => ({ ...page, items: page.items.map((item) => ({ ...item, str: krutiToUnicode(item.str) })) }))
        if (isReadable(converted, { devanagari: true }) && looksLikeHindi(allText(converted))) {
            pages = converted
        } else {
            throw new Error(
                "This Hindi paper is set in an old font Ben doesn't know yet, so its words come out scrambled. Open it from the Library to see the PDF."
            )
        }
    }
    if (!isReadable(pages, { devanagari: hindi })) {
        pages = await readScannedPages(pdfjs, bytes, onProgress, hindi ? 'hi' : undefined)
        if (!isReadable(pages, { devanagari: hindi })) {
            throw new Error("Ben couldn't make out the words on this paper's pages. Open it from the Library to see the PDF.")
        }
    }
    const paper = readPaper(pages)
    if (paper.sections.length === 0) {
        throw new Error("Ben couldn't find any stories in this paper. Open it from the Library to see the PDF.")
    }
    return { paper, pages: pages.length }
}

/** A paper's sections and stories, and how many pages it has. Rejects with a message fit to show the student.
 *  `paper` and `title` are what the Library knows of it (a Hindi paper is read as Hindi); `onProgress` hears how
 *  many pages of a scanned paper have been read. */
export function loadPaper(
    { path, paper, title }: { path: string; paper: string | null; title: string },
    onProgress?: Progress
): Promise<{ paper: Paper; pages: number }> {
    let reading = papers.get(path)
    if (!reading) {
        reading = read(path, isHindi(paper, title), onProgress)
        // A paper that failed is read again next time (the file may have been fixed or moved back).
        reading.catch(() => papers.delete(path))
        papers.set(path, reading)
        if (papers.size > KEPT) {
            papers.delete(papers.keys().next().value!)
        }
    }
    return reading
}

/** One of a paper's stories as a Reader article (the address names the story). */
export async function openPaper(url: string): Promise<Article> {
    const file = paperFile(url)
    const { paper } = await loadPaper(file)
    return storyArticle(paper, file.story ?? 0, { url, site: file.paper ?? file.title })
}
