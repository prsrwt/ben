// Lays a Reader article out as a book: the text flows into page-sized columns (CSS multi-column, with a
// fixed height, so it overflows sideways into as many pages as it needs), and turning a page slides the
// columns along. Two facing pages when the window is wide enough, one otherwise.

import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Space between two facing pages. */
export const PAGE_GAP = 64
/** At least this much margin either side of the pages; clicking it turns the page. */
export const SIDE_MARGIN = 56
/** Space above the pages, and below them for the page numbers. */
export const TOP_MARGIN = 12
export const BOTTOM_MARGIN = 44
/** Two facing pages from this much room across; a single page is never wider than a comfortable line. */
const TWO_PAGES_FROM = 900
const MAX_SINGLE_PAGE = 680
const MAX_FACING_PAGE = 620

export interface BookLayout {
    /** 1 or 2 pages side by side. */
    perSpread: 1 | 2
    pageWidth: number
    pageHeight: number
    /** Where the pages start, from the book's left edge (they're centred). */
    left: number
    /** The width of the pages shown together, gap included. */
    spreadWidth: number
}

export interface Book {
    layout: BookLayout | null
    /** The first page showing, from 0. */
    page: number
    pageCount: number
    /** Whether the last change was a page turn (animated) rather than a resize (not). */
    turning: boolean
    turn: (direction: 1 | -1) => void
    /** Turns to the page holding an element (for links to a part of the article). */
    showElement: (element: Element) => void
    /** The page (from 0) where an element starts, in the current layout. */
    pageOf: (element: Element) => number
    /** Counts the pages again, after something inside changed size (an image loaded, Details opened). */
    recount: () => void
}

/** The pieces of an article a reading place can point at: its header and its blocks of text. */
const BLOCKS = 'header, p, li, h1, h2, h3, h4, h5, h6, figure, pre, blockquote, tr, dt, dd'

/** Which page (column) a point of the laid-out article is on. Both boxes carry the same slide, so the
 *  difference is the point's place in the book. */
function columnAt(left: number, article: HTMLElement, stride: number): number {
    return Math.max(0, Math.floor((left - article.getBoundingClientRect().left + 1) / stride))
}

/** Where the reader is: the first block that starts on `page` (or, on a page that only continues one long
 *  block, that block). As an index among the article's blocks, it survives any change of page size. */
function placeOnPage(article: HTMLElement, page: number, stride: number): number {
    const blocks = article.querySelectorAll(BLOCKS)
    let continuing = 0
    for (let i = 0; i < blocks.length; i++) {
        const rects = blocks[i].getClientRects()
        if (rects.length === 0) {
            continue
        }
        const startColumn = columnAt(rects[0].left, article, stride)
        if (startColumn >= page) {
            return startColumn === page ? i : continuing
        }
        continuing = i
    }
    return continuing
}

/** The page where the block at a reading place starts. */
function pageOfPlace(article: HTMLElement, place: number, stride: number): number {
    const block = article.querySelectorAll(BLOCKS)[place]
    const rect = block?.getClientRects()[0]
    return rect ? columnAt(rect.left, article, stride) : 0
}

export interface ReadingPlace {
    /** Where to open (after back/forward), or null for the start. */
    initial: number | null
    /** Told the new place after every turn. */
    onChange: (place: number) => void
}

export function useBook(bookRef: RefObject<HTMLElement>, articleRef: RefObject<HTMLElement>, reading: ReadingPlace): Book {
    const [layout, setLayout] = useState<BookLayout | null>(null)
    const [page, setPage] = useState(0)
    const [pageCount, setPageCount] = useState(1)
    const [turning, setTurning] = useState(false)
    // The passage being read. A new page size moves it to another page number, so it's kept as a block.
    const place = useRef(reading.initial)
    // The Reader mounts a new book per article, so the first callback is the one for this article.
    const onPlaceChange = useRef(reading.onChange)

    // Page size follows the space available, re-measured whenever the window changes size.
    useLayoutEffect(() => {
        const book = bookRef.current
        if (!book) {
            return
        }
        const measure = (): void => {
            const room = book.clientWidth - 2 * SIDE_MARGIN
            const perSpread = room >= TWO_PAGES_FROM ? 2 : 1
            const pageWidth = Math.floor(
                perSpread === 2 ? Math.min((room - PAGE_GAP) / 2, MAX_FACING_PAGE) : Math.min(room, MAX_SINGLE_PAGE)
            )
            const spreadWidth = perSpread * pageWidth + (perSpread - 1) * PAGE_GAP
            setTurning(false)
            setLayout({
                perSpread,
                pageWidth,
                pageHeight: Math.max(120, book.clientHeight - TOP_MARGIN - BOTTOM_MARGIN),
                left: Math.round((book.clientWidth - spreadWidth) / 2),
                spreadWidth,
            })
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(book)
        return () => observer.disconnect()
    }, [bookRef])

    const stride = layout ? layout.pageWidth + PAGE_GAP : 1

    const recount = useCallback((): void => {
        const article = articleRef.current
        if (article && layout) {
            setPageCount(Math.max(1, Math.round((article.scrollWidth + PAGE_GAP) / (layout.pageWidth + PAGE_GAP))))
        }
    }, [articleRef, layout])

    /** Shows the page holding the passage being read, in the current page size. */
    const returnToPlace = useCallback((): void => {
        const article = articleRef.current
        if (article && layout && place.current !== null) {
            setPage(pageOfPlace(article, place.current, layout.pageWidth + PAGE_GAP))
        }
    }, [articleRef, layout])

    // After every new layout (opening, resizing, one page to two): count the pages, and put the passage
    // being read back on screen. Both need the laid-out article.
    useLayoutEffect(() => {
        recount()
        returnToPlace()
    }, [recount, returnToPlace])

    // The first page showing always starts a spread: switching from one page to two could otherwise
    // leave a right-hand page on the left.
    const perSpread = layout?.perSpread ?? 1
    const shownPage = page - (page % perSpread)

    /** Moves to a page, and remembers the passage now in view. */
    const goTo = useCallback(
        (target: number): void => {
            const article = articleRef.current
            setTurning(true)
            setPage(target)
            if (article) {
                place.current = placeOnPage(article, target, stride)
                onPlaceChange.current(place.current)
            }
        },
        [articleRef, stride]
    )

    const turn = useCallback(
        (direction: 1 | -1): void => {
            const lastSpread = Math.floor((pageCount - 1) / perSpread) * perSpread
            const target = Math.min(lastSpread, Math.max(0, shownPage + direction * perSpread))
            if (target !== shownPage) {
                goTo(target)
            }
        },
        [goTo, pageCount, perSpread, shownPage]
    )

    const showElement = useCallback(
        (element: Element): void => {
            const article = articleRef.current
            if (!article || !layout) {
                return
            }
            const column = columnAt(element.getBoundingClientRect().left, article, stride)
            goTo(column - (column % layout.perSpread))
        },
        [articleRef, goTo, layout, stride]
    )

    const pageOf = useCallback(
        (element: Element): number => {
            const article = articleRef.current
            const rect = element.getClientRects()[0]
            return article && rect ? columnAt(rect.left, article, stride) : 0
        },
        [articleRef, stride]
    )

    // Images arriving and Details opening move the text onto other pages: count them again, and keep the
    // passage being read on screen.
    useEffect(() => {
        const article = articleRef.current
        if (!article) {
            return
        }
        const onResized = (): void => {
            recount()
            returnToPlace()
        }
        article.addEventListener('load', onResized, true)
        article.addEventListener('toggle', onResized, true)
        return () => {
            article.removeEventListener('load', onResized, true)
            article.removeEventListener('toggle', onResized, true)
        }
    }, [articleRef, recount, returnToPlace])

    return { layout, page: shownPage, pageCount, turning, turn, showElement, pageOf, recount }
}
