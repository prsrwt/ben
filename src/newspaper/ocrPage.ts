// A page read by text recognition (src/ocr/ocrApi.ts) in the form the newspaper layout reads (layout.ts): every
// word with its position and type size. A word's box is only as tall as its letters: "Nag" (a capital and a
// descender) stands taller than "Award", "on" shorter than both. So each word's type size is worked out from its
// letters with ordinary type proportions (capitals and tall letters reach about 0.7 of the size above the line,
// small letters 0.5, descenders 0.2 below), and every word on a line takes the line's middle value and baseline,
// as set type would.

import type { OcrPage, OcrWord } from '~/ocr/ocrApi'

import { PageText } from './layout'

const TALL = /[\p{Lu}\p{N}bdfhklt'"’”(){}[\]/|!?]/u
const DESCENDS = /[gjpqy,;()[\]{}]|Q/

/** A word's type size and baseline, from its box and its letters. */
function measure(word: OcrWord): { size: number; baseline: number } {
    const above = TALL.test(word.text) ? 0.72 : 0.5
    const below = DESCENDS.test(word.text) ? 0.22 : 0
    const size = word.height / (above + below)
    return { size, baseline: word.y + word.height - below * size }
}

const middle = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** `scale`: image pixels per PDF unit (2 when the page was drawn at twice its size), so sizes match the PDF's. */
export function ocrPageText(page: OcrPage, scale = 1): PageText {
    const items = page.lines.flatMap(({ words }) => {
        const measured = words.map(measure)
        const size = middle(measured.map((m) => m.size))
        const baseline = middle(measured.map((m) => m.baseline))
        // As in a PDF's own text (pdfText.ts): the top is a whole type size above the baseline.
        return words.map((w) => ({ str: w.text, x: w.x / scale, y: (baseline - size) / scale, width: w.width / scale, size: size / scale }))
    })
    return { width: page.width / scale, height: page.height / scale, items }
}
