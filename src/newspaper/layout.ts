// Turns a newspaper page's positioned words into articles: words → lines → blocks of text; headlines are the
// blocks set much larger than the body text; each article is a headline plus the body blocks below it, within
// the columns it spans, down to the next headline. Section names come from the strip at the top of the page,
// ads from what they say (missed calls, phone numbers, web addresses, prices off). Plain functions with no app
// dependencies, tested on real e-papers. Scanned and scrambled papers are recognised so they can be sent to OCR.

export interface TextItem {
    str: string
    /** Left and top edge, in PDF units from the page's top-left corner. */
    x: number
    y: number
    width: number
    /** Font size. */
    size: number
}

export interface PageText {
    width: number
    height: number
    items: TextItem[]
}

export interface PaperArticle {
    title: string
    /** A short label above the headline ("WESTERN GHATS"), when the paper prints one. */
    kicker: string | null
    paragraphs: string[]
    /** The printed page it starts on, from 1. */
    page: number
    /** The page it continues on, when the paper says "» PAGE n" at its end. */
    continuesOn: number | null
}

export interface PaperSection {
    name: string
    articles: PaperArticle[]
}

/** A pointer to a story inside. A brief ("GENEVA The recovery of… PAGE 14") also has a few lines of text: its
 *  title is then the dateline ("GENEVA"). */
export interface Teaser {
    title: string
    text: string | null
    page: number
}

export interface Paper {
    sections: PaperSection[]
    /** Front-page pointers to stories inside ("JHIRAM VALLEY CASE … NEWS » PAGE 4"), and briefs. */
    teasers: Teaser[]
}

interface Line {
    text: string
    x: number
    y: number
    right: number
    bottom: number
    size: number
}

interface Block {
    lines: Line[]
    x: number
    y: number
    right: number
    bottom: number
    size: number
    text: string
}

/** Column gutters: the vertical strips of a page that body text never covers. Text is never joined across one,
 *  however wide the word spacing of justified text gets. */
function findGutters(items: TextItem[], width: number, body: number): (from: number, to: number) => boolean {
    const covered = new Uint16Array(Math.ceil(width) + 1)
    for (const item of items) {
        if (Math.abs(item.size - body) < body * 0.25) {
            for (let x = Math.max(0, Math.floor(item.x)); x < Math.min(covered.length, Math.ceil(item.x + item.width)); x++) {
                covered[x]++
            }
        }
    }
    const peak = Math.max(...covered)
    const empty = covered.map((c) => (c <= peak * 0.01 ? 1 : 0))
    // Whether a stretch of a few points of empty page lies between two x positions.
    return (from, to) => {
        let run = 0
        for (let x = Math.max(0, Math.ceil(from)); x < Math.min(empty.length, Math.floor(to)); x++) {
            run = empty[x] ? run + 1 : 0
            if (run >= 3) {
                return true
            }
        }
        return false
    }
}

/** Body text size: the size most of the page's characters are set in. */
function bodySize(items: TextItem[]): number {
    const bySize = new Map<number, number>()
    for (const item of items) {
        const size = Math.round(item.size * 2) / 2
        bySize.set(size, (bySize.get(size) ?? 0) + item.str.length)
    }
    return [...bySize.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 9
}

/** Lines: items at the same height, side by side, of the same size, and not across a column gutter. */
function toLines(items: TextItem[], acrossGutter: (from: number, to: number) => boolean): Line[] {
    const lines: Line[] = []
    const sorted = items.filter((item) => item.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x)
    for (const item of sorted) {
        const line = lines.find(
            (l) =>
                Math.abs(l.y - item.y) < Math.max(l.size, item.size) * 0.35 &&
                Math.abs(l.size - item.size) < Math.max(l.size, item.size) * 0.25 &&
                // Justified text can space words widely, so the gap alone can't tell a word space from a gutter.
                item.x - l.right < item.size * 2.5 &&
                item.x - l.right > -item.size * 0.5 &&
                !(item.size < 15 && acrossGutter(l.right, item.x))
        )
        if (line) {
            const gap = item.x - line.right > item.size * 0.15 && !line.text.endsWith(' ') ? ' ' : ''
            line.text += gap + item.str
            line.right = Math.max(line.right, item.x + item.width)
            line.bottom = Math.max(line.bottom, item.y + item.size)
        } else {
            lines.push({ text: item.str, x: item.x, y: item.y, right: item.x + item.width, bottom: item.y + item.size, size: item.size })
        }
    }
    return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text)
}

function endsInPointer(block: Block, below: Line): boolean {
    const last = block.lines.reduce((a, c) => (c.y > a.y ? c : a))
    return below.y > last.y && POINTER.test(last.text)
}

/** Blocks: lines of the same size stacked closely in the same column. */
function toBlocks(lines: Line[]): Block[] {
    const blocks: Block[] = []
    for (const line of [...lines].sort((a, b) => a.x - b.x || a.y - b.y)) {
        // A lone "NEWS » PAGE 4" pointer is a teaser's last line: never merged into the text around it.
        const pointer = POINTER.test(line.text) && line.text.replace(POINTER, '').length < 25
        const block = pointer ? undefined : blocks.find(
            (b) =>
                // A block ending in "PAGE n" is finished: the next line starts another brief or story.
                !endsInPointer(b, line) &&
                Math.abs(b.size - line.size) < line.size * 0.2 &&
                line.y >= b.bottom - line.size * 0.5 &&
                line.y - b.bottom < line.size * 0.9 &&
                Math.abs(b.x - line.x) < line.size * 2.5 &&
                line.right - b.x > 0 &&
                b.right - line.x > 0
        )
        if (block) {
            block.lines.push(line)
            block.x = Math.min(block.x, line.x)
            block.right = Math.max(block.right, line.right)
            block.bottom = Math.max(block.bottom, line.bottom)
        } else {
            blocks.push({ lines: [line], x: line.x, y: line.y, right: line.right, bottom: line.bottom, size: line.size, text: '' })
        }
    }
    for (const block of blocks) {
        block.lines.sort((a, b) => a.y - b.y)
        // Words broken across lines with a hyphen are joined again.
        block.text = block.lines
            .map((l) => l.text)
            .reduce((all, text) => (all.endsWith('-') && /^[a-z]/.test(text) ? all.slice(0, -1) + text : all ? `${all} ${text}` : text), '')
    }
    return blocks
}

/** Ads and paper furniture: subscription prompts, phone numbers, web addresses, prices with offers, print codes. */
const AD = /(missed call|to subscribe|scan (the )?qr|\b\d{10}\b|\+91|www\.|https?:|\b(off|discount|offer|sale|emi|toll[- ]free|call now|book now|helpline)\b.*₹|₹.*\b(off|onwards|only)\b|printed (at|and published)|regd\.? no|rni no)/i
/** Short codes printed on e-paper pages ("A IN-X", "CM", "YK", "J ND-NDE"). */
const PRINT_CODE = /^([A-Z]{1,3}( [A-Z]{2,3}-[A-Z]{1,4})?|CM|YK|[A-Z] [A-Z]{2}-[A-Z]{1,4})$/
const TEASER = /^(.*?)\s*(?:»\s*[Pp][Aa][Gg][Ee]|\bPAGE)\s*(\d{1,2})\s*$/
/** The section named before a teaser's pointer ("… NEWS » PAGE 4"), not part of its title. */
const POINTER_SECTION = /\s*\b(news|world|business|sport|sports|opinion|editorial|city|states?|life|science|international)\s*$/i
/** A brief's dateline: the place in capitals it starts with ("GENEVA The…", "NEW DELHI The…"). */
const DATELINE = /^([A-Z][A-Z.'’ -]{2,30}?)\s+(?=[A-Z][a-z])/
/** Text that isn't words: icon-font symbols (private-use characters), unknown characters, and ID codes some
 *  e-papers hide in their pages ("da989eb2-7095-4175-8d0f-20d91e5ae8b0"). */
const NOT_TEXT = /[\uE000-\uF8FF\uFFFD]|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

/** Words in a page's running head that aren't the section: the paper's name, days, months, dates, page numbers. */
const RUNNING_HEAD =
    /\b(THE HINDU|HINDU|INDIAN EXPRESS|EXPRESS|MINT|BUSINESS LINE|BUSINESSLINE|TIMES OF INDIA|HINDUSTAN TIMES|(MON|TUES|WEDNES|THURS|FRI|SATUR|SUN)DAY|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|\d+)\b/gi

/** "» PAGE 4" (or "PAGE 4" after an icon, in capitals) at the end of a line: a teaser's pointer, or a story
 *  continuing on that page. */
const POINTER = /(?:»\s*[Pp][Aa][Gg][Ee]|\bPAGE)\s*(\d{1,2})\s*$/

const isUpperLabel = (text: string): boolean => text.length >= 3 && text.length <= 40 && text === text.toUpperCase() && /[A-Z]/.test(text)

export function readPage(page: PageText, pageNumber: number): { section: string | null; articles: PaperArticle[]; teasers: Teaser[] } {
    const items = page.items.map((item) => ({ ...item, str: item.str.replace(NOT_TEXT, '') })).filter((item) => item.str.trim())
    const body = bodySize(items)
    const lines = toLines(items, findGutters(items, page.width, body))
    const blocks = toBlocks(lines).filter((b) => !PRINT_CODE.test(b.text) && !AD.test(b.text))

    // Section: an all-capitals label in the strip at the top of an inner page ("Chennai KERALAM" → "KERALAM").
    let section: string | null = null
    if (pageNumber > 1) {
        // The section name is the largest text in the strip at the top, once the paper's name, the date and the
        // page number are taken out ("THE HINDU · 3 · Saturday, September 26, 2026 · Chennai · News" → "News").
        const top = blocks
            .filter((b) => b.y < page.height * 0.06 && b.size > body * 1.3)
            .map((b) => ({ size: b.size, text: b.text.replace(RUNNING_HEAD, ' ').replace(/[^\p{L} &’'-]/gu, ' ').replace(/\s+/g, ' ').trim() }))
            .filter((b) => b.text.length >= 3 && b.text.length <= 30)
            .sort((a, b) => b.size - a.size)
        section = top[0]?.text ?? null
    }

    // Teasers ("JHIRAM VALLEY CASE All convicts get death penalty … NEWS » PAGE 4"): pointers, not articles.
    const teasers: Teaser[] = []
    const remaining: Block[] = []
    const used = new Set<Block>()
    for (const b of blocks) {
        const teaser = TEASER.exec(b.text)
        if (!teaser || b.size >= body * 3) {
            continue
        }
        used.add(b)
        let title = teaser[1].replace(POINTER_SECTION, '').trim()
        if (title.length < 12) {
            // The pointer stands alone: its title is the block right above it.
            const above = blocks
                .filter((a) => !used.has(a) && a.bottom <= b.y + body && b.y - a.bottom < body * 3 && Math.abs(a.x - b.x) < body * 4)
                .sort((a, c) => c.bottom - a.bottom)[0]
            if (above) {
                used.add(above)
                title = above.text
            }
        }
        if (title) {
            const dateline = title.length > 80 ? DATELINE.exec(title) : null
            teasers.push(
                dateline
                    ? { title: dateline[1].trim(), text: title.slice(dateline[0].length), page: Number(teaser[2]) }
                    : { title, text: null, page: Number(teaser[2]) }
            )
        }
    }
    remaining.push(...blocks.filter((b) => !used.has(b)))
    // A teaser's headline sits in its own block just above the "» PAGE n" line: fold it in.
    const headlines = remaining
        .filter((b) => b.size >= body * 1.6 && b.text.length >= 12 && b.y > page.height * 0.04)
        .sort((a, b) => a.y - b.y || a.x - b.x)
    const bodyBlocks = remaining.filter((b) => b.size < body * 1.35 && !isUpperLabel(b.text))

    // Each body block belongs to the nearest headline above it whose columns cover it.
    const owner = new Map<Block, Block[]>()
    for (const h of headlines) {
        owner.set(h, [])
    }
    for (const b of bodyBlocks) {
        const centre = (b.x + b.right) / 2
        const candidates = headlines.filter((h) => h.y <= b.y + body && centre >= h.x - body * 2 && centre <= h.right + body * 2)
        const nearest = candidates.sort((a, c) => c.y - a.y)[0]
        if (nearest) {
            owner.get(nearest)!.push(b)
        }
    }

    const articles: PaperArticle[] = []
    for (const h of headlines) {
        const parts = inColumns(owner.get(h)!, body)
        let continuesOn: number | null = null
        const text = parts
            .map((p) => {
                const marker = POINTER.exec(p.text)
                if (!marker) {
                    return p.text
                }
                continuesOn = Number(marker[1])
                return p.text.replace(POINTER, '').trim()
            })
            .join(' ')
        if (text.length < 120) {
            continue
        }
        // A kicker: a short all-capitals label right above the headline.
        const kickerBlock = remaining.find(
            (k) => k !== h && isUpperLabel(k.text) && k.bottom <= h.y + body && h.y - k.bottom < body * 2.5 && Math.abs(k.x - h.x) < body * 3
        )
        articles.push({
            title: h.text,
            kicker: kickerBlock?.text ?? null,
            paragraphs: splitParagraphs(text),
            page: pageNumber,
            continuesOn,
        })
    }
    return { section, articles, teasers }
}

/** Reading order: column by column (blocks whose left edges are close share a column), top to bottom in each. */
function inColumns(blocks: Block[], body: number): Block[] {
    const columns: Block[][] = []
    for (const b of [...blocks].sort((a, c) => a.x - c.x)) {
        const column = columns.find((col) => Math.abs(col[0].x - b.x) < body * 3)
        if (column) {
            column.push(b)
        } else {
            columns.push([b])
        }
    }
    return columns.flatMap((col) => col.sort((a, c) => a.y - c.y))
}

/** Long runs of text into readable paragraphs, at sentence ends roughly every few lines. */
function splitParagraphs(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [text]
    const paragraphs: string[] = []
    let current = ''
    for (const sentence of sentences) {
        current += sentence
        if (current.length > 420) {
            paragraphs.push(current.trim())
            current = ''
        }
    }
    if (current.trim()) {
        paragraphs.push(current.trim())
    }
    return paragraphs
}

const FRONT_PAGE = 'Front page'

/** A whole paper: pages read in order, articles grouped under the section their page belongs to. */
export function readPaper(pages: PageText[]): Paper {
    const sections: PaperSection[] = []
    const teasers: Teaser[] = []
    pages.forEach((page, i) => {
        const read = readPage(page, i + 1)
        teasers.push(...read.teasers)
        // An inner page without a section name of its own belongs to the inner section before it.
        const last = sections.at(-1)
        const name = i === 0 ? FRONT_PAGE : read.section ? titleCase(read.section) : last && last.name !== FRONT_PAGE ? last.name : 'Inside'
        if (last && last.name === name) {
            last.articles.push(...read.articles)
        } else {
            sections.push({ name, articles: read.articles })
        }
    })
    return { sections: sections.filter((s) => s.articles.length > 0), teasers }
}

const titleCase = (text: string): string =>
    text
        .toLowerCase()
        .split(' ')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ')

/** Whether a paper's text can be used as it is: enough of it, and mostly real letters. Scanned pages have almost
 *  none; papers with protected fonts give symbols instead of letters ("!\"#$!%%&'("). Either way: needs OCR. */
export function isReadable(pages: PageText[]): boolean {
    const sample = pages.slice(0, 4).flatMap((p) => p.items.map((i) => i.str)).join('')
    const visible = sample.replace(/\s/g, '')
    if (visible.length < 1500) {
        return false
    }
    const letters = visible.match(/\p{L}/gu)?.length ?? 0
    return letters / visible.length > 0.7
}
