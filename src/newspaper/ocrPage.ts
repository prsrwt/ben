// A page read by text recognition (src/ocr/ocrApi.ts) in the form the newspaper layout reads (layout.ts): every
// word with its position and size. A word's box is only as tall as its letters ("on" is shorter than "Thy"), so
// every word on a line takes the line's top and its tallest box as its size, as set type would.

import type { OcrPage } from '~/ocr/ocrApi'

import { PageText } from './layout'

/** `scale`: image pixels per PDF unit (2 when the page was rendered at twice its size), so sizes match the PDF's. */
export function ocrPageText(page: OcrPage, scale = 1): PageText {
    const items = page.lines.flatMap(({ words }) => {
        const top = Math.min(...words.map((w) => w.y))
        const size = Math.max(...words.map((w) => w.height))
        return words.map((w) => ({ str: w.text, x: w.x / scale, y: top / scale, width: w.width / scale, size: size / scale }))
    })
    return { width: page.width / scale, height: page.height / scale, items }
}
