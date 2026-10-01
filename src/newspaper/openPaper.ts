// Reads a newspaper PDF from the Library into sections and stories (layout.ts). Imported only when a paper is
// opened, so PDF.js (and its worker, a separate file) cost nothing until then. The last few papers read are kept,
// so opening one of their stories in the Reader doesn't read the PDF again.

import { convertFileSrc } from '@tauri-apps/api/core'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { Article } from '~/reader/extractArticle'

import { Paper, isReadable, readPaper } from './layout'
import { paperFile } from './paperFile'
import { readPdfText } from './pdfText'
import { storyArticle } from './stories'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Papers read, by path; the oldest is forgotten beyond this many. */
const KEPT = 3
const papers = new Map<string, Promise<{ paper: Paper; pages: number }>>()

async function read(path: string): Promise<{ paper: Paper; pages: number }> {
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
    return { paper, pages: pages.length }
}

/** A paper's sections and stories, and how many pages it has. Rejects with a message fit to show the student. */
export function loadPaper(path: string): Promise<{ paper: Paper; pages: number }> {
    let reading = papers.get(path)
    if (!reading) {
        reading = read(path)
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
    const { paper } = await loadPaper(file.path)
    return storyArticle(paper, file.story ?? 0, { url, site: file.paper ?? file.title })
}
