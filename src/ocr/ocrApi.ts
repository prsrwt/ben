// Reading text from pictures with Windows' own text recognition (src-tauri/src/ocr.rs): offline, nothing to
// download. Each word comes with its box in the image's pixels, so layouts (newspaper columns) can be read too.
// Rejects with a message fit to show the student (no language for text recognition, not a picture…).

import { invoke } from '@tauri-apps/api/core'

import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'

export interface OcrWord {
    text: string
    x: number
    y: number
    width: number
    height: number
}

export interface OcrPage {
    /** The image's size in pixels; word boxes are in the same pixels. */
    width: number
    height: number
    lines: { words: OcrWord[] }[]
    /** The language read in, e.g. "en-US". */
    language: string
}

const NOT_IN_APP = 'Reading text from pictures works in the Ben app, not in a browser tab.'

/** The text in an image's bytes (PNG, JPEG…), such as a scanned page rendered by PDF.js. `language` ("hi") asks
 *  for that language rather than the student's own; it rejects if Windows can't read it. */
export const ocrImage = (image: Uint8Array, language?: string): Promise<OcrPage> =>
    IS_DESKTOP_APP
        ? invoke('ocr_image', image, language ? { headers: { 'Ocr-Language': language } } : undefined)
        : Promise.reject(new Error(NOT_IN_APP))

/** The text in a picture file inside one of the Library's folders. */
export const ocrFile = (path: string): Promise<OcrPage> =>
    IS_DESKTOP_APP ? invoke('ocr_file', { path }) : Promise.reject(new Error(NOT_IN_APP))

/** A page's text as plain lines, top to bottom as Windows read them. */
export const ocrText = (page: OcrPage): string => page.lines.map((line) => line.words.map((w) => w.text).join(' ')).join('\n')
