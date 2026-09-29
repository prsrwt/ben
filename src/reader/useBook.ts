// Lays a Reader article out as a book: the text flows into page-sized columns (CSS multi-column, with a
// fixed height, so it overflows sideways into as many pages as it needs), and turning a page slides the
// columns along. Two facing pages when the window is wide enough, one otherwise.

import { RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react'

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
    /** Counts the pages again, after something inside changed size (an image loaded, Details opened). */
    recount: () => void
}

export function useBook(bookRef: RefObject<HTMLElement>, articleRef: RefObject<HTMLElement>): Book {
    const [layout, setLayout] = useState<BookLayout | null>(null)
    const [page, setPage] = useState(0)
    const [pageCount, setPageCount] = useState(1)
    const [turning, setTurning] = useState(false)

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

    // After every new layout, count the pages again (it needs the laid-out article).
    useLayoutEffect(recount, [recount])

    // The first page showing always starts a spread: switching from one page to two could otherwise
    // leave a right-hand page on the left.
    const perSpread = layout?.perSpread ?? 1
    const shownPage = page - (page % perSpread)

    const turn = useCallback(
        (direction: 1 | -1): void => {
            const lastSpread = Math.floor((pageCount - 1) / perSpread) * perSpread
            setTurning(true)
            setPage((p) => Math.min(lastSpread, Math.max(0, p - (p % perSpread) + direction * perSpread)))
        },
        [pageCount, perSpread]
    )

    const showElement = useCallback(
        (element: Element): void => {
            const article = articleRef.current
            if (!article || !layout) {
                return
            }
            // Both boxes carry the same slide, so their difference is the element's place in the book.
            const offset = element.getBoundingClientRect().left - article.getBoundingClientRect().left
            const column = Math.max(0, Math.floor((offset + 1) / stride))
            setTurning(true)
            setPage(column - (column % layout.perSpread))
        },
        [articleRef, layout, stride]
    )

    // Images arriving and Details opening change how many pages there are.
    useEffect(() => {
        const article = articleRef.current
        if (!article) {
            return
        }
        article.addEventListener('load', recount, true)
        article.addEventListener('toggle', recount, true)
        return () => {
            article.removeEventListener('load', recount, true)
            article.removeEventListener('toggle', recount, true)
        }
    }, [articleRef, recount])

    return { layout, page: shownPage, pageCount, turning, turn, showElement, recount }
}
