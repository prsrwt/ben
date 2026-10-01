// A Reader window: a clean article laid out as a book (useBook.ts), or what to do when there isn't one.
// Article styles: reader.css.

import './reader.css'
// Literata (SIL Open Font Licence), bundled with the app: upright and italic, every weight. The browser
// downloads only the character sets a page actually uses.
import '@fontsource-variable/literata'
import '@fontsource-variable/literata/wght-italic.css'

import { useActions, useValues } from 'kea'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '~/desktop/cn'
import { ContextMenu, MenuAt, MenuItem } from '~/desktop/ContextMenu'
import { hostOf } from '~/desktop/windowSummaries'
import { WindowId, windowsLogic } from '~/desktop/windowsLogic'
import { isPaperUrl } from '~/newspaper/paperFile'

import { Article, toArticleUrl } from './fetchArticle'
import { ContentsEntry, openBook, registerBook, setCurrentSection } from './openBooks'
import { readerLogic, readerWindowState } from './readerLogic'
import { BOTTOM_MARGIN, PAGE_GAP, TOP_MARGIN, useBook } from './useBook'

/** Where each article was being read (a block index, see useBook), by page id, so back and forward
 *  return to the same passage. */
const readingPlaces = new Map<number, number>()

/** Centred message for the states without an article. */
function Notice({ title, children }: { title: string; children?: ReactNode }): JSX.Element {
    return (
        <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <h2 className="text-lg font-semibold m-0">{title}</h2>
            {children}
        </div>
    )
}

export function ReaderView({ windowId }: { windowId: WindowId }): JSX.Element {
    return (
        <div className="h-full">
            <ReaderPageView windowId={windowId} />
        </div>
    )
}

function ReaderPageView({ windowId }: { windowId: WindowId }): JSX.Element {
    const { current } = readerWindowState(useValues(readerLogic).histories, windowId)
    const { reload } = useActions(readerLogic)

    if (current?.status === 'loading') {
        return (
            <Notice title="Opening…">
                <p className="text-tertiary text-sm m-0">{hostOf(current.url)}</p>
            </Notice>
        )
    }
    if (current?.status === 'failed') {
        return (
            <Notice title="Couldn't open this page">
                <p className="text-secondary text-sm m-0 max-w-sm">{current.error}</p>
                {!isPaperUrl(current.url) && <p className="text-tertiary text-xs m-0 max-w-sm break-all">{current.url}</p>}
                <button
                    type="button"
                    onClick={() => reload(windowId)}
                    className="mt-3 px-3 py-1 rounded-md text-sm font-semibold text-primary bg-hover hover:bg-[color-mix(in_oklab,currentColor_12%,transparent)]"
                >
                    Try again
                </button>
            </Notice>
        )
    }
    if (!current?.article) {
        return (
            <Notice title="Reader">
                <p className="text-tertiary text-sm m-0">Paste a link into the search bar at the top (Ctrl K).</p>
            </Notice>
        )
    }
    // Keyed by page, so each article opens on its first page.
    return <ArticleBook key={current.id} pageId={current.id} article={current.article} windowId={windowId} />
}

/** Keys that turn pages, unless focus is somewhere they mean something else (a text field, an open menu,
 *  Ben View). A button that merely kept focus after being clicked doesn't count. */
function turnDirection(event: KeyboardEvent): 1 | -1 | null {
    if (event.altKey || event.ctrlKey || event.metaKey) {
        return null
    }
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"]')) {
        return null
    }
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
        return 1
    }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
        return -1
    }
    return null
}

function ArticleBook({ pageId, article, windowId }: { pageId: number; article: Article; windowId: WindowId }): JSX.Element {
    const { focusedId } = useValues(windowsLogic)
    const { histories } = useValues(readerLogic)
    const { canGoBack, canGoForward } = readerWindowState(histories, windowId)
    const { openLink, openLinkBeside, openLinkInNewWindow, back, forward } = useActions(readerLogic)
    const bookRef = useRef<HTMLDivElement>(null)
    const articleRef = useRef<HTMLElement>(null)
    const { layout, page, pageCount, turning, turn, showElement, pageOf } = useBook(bookRef, articleRef, {
        initial: readingPlaces.get(pageId) ?? null,
        onChange: (place) => readingPlaces.set(pageId, place),
    })
    // The right-click (or middle-click) menu, where it was opened and what it offers.
    const [menu, setMenu] = useState<MenuAt | null>(null)
    const closeMenu = useCallback(() => setMenu(null), [])
    const isFront = focusedId === windowId

    // The keys turn pages in the Reader window in front only.
    useEffect(() => {
        if (!isFront) {
            return
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            const direction = turnDirection(event)
            if (direction) {
                event.preventDefault()
                // Let go of a button still focused from an earlier click, so Space can't also press it.
                if (document.activeElement instanceof HTMLButtonElement) {
                    document.activeElement.blur()
                }
                turn(direction)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isFront, turn])

    // The Contents menu on the island reads this window's sections and turns to them. Re-registered on every
    // render, so it always sees the current page and page size.
    useEffect(() => {
        const sections = (): Element[] => {
            const article = articleRef.current
            if (!article) {
                return []
            }
            const headings = [...article.querySelectorAll('.reader-article__body :is(h1, h2, h3, h4)')].filter(
                (heading) => heading.textContent?.trim()
            )
            const header = article.querySelector('.reader-article__header')
            const details = article.querySelector('.reader-article__details')
            return [...(header ? [header] : []), ...headings, ...(details ? [details] : [])]
        }
        return registerBook(windowId, {
            contents: (): ContentsEntry[] => {
                const found = sections()
                const levels = found.map((el) => (/^H[1-4]$/.test(el.tagName) ? Number(el.tagName[1]) : 0))
                const top = Math.min(...levels.filter((level) => level > 0))
                // The reader is in the last section that has begun by the last page showing.
                const lastShowing = page + (layout?.perSpread ?? 1) - 1
                const entries = found.map((el, i) => ({
                    title: el.matches('.reader-article__header')
                        ? article.title
                        : el.matches('.reader-article__details')
                          ? 'Details'
                          : (el.textContent ?? '').trim(),
                    depth: levels[i] > 0 ? Math.min(2, levels[i] - top) : 0,
                    page: pageOf(el),
                    current: false,
                }))
                const current = entries.findLastIndex((entry) => entry.page <= lastShowing)
                return entries.map((entry, i) => ({ ...entry, current: i === current }))
            },
            goTo: (index) => {
                const el = sections()[index]
                if (el) {
                    showElement(el)
                }
            },
        })
    })

    // Tell the Contents pill which section is being read, whenever the pages move.
    useEffect(() => {
        const current = openBook(windowId)?.contents().find((entry) => entry.current)
        setCurrentSection(windowId, current?.title ?? null)
    }, [windowId, page, layout, pageCount])
    useEffect(() => () => setCurrentSection(windowId, null), [windowId])

    /** Where a link in the article leads: a part of this page, another web page, or nowhere Ben opens. */
    const linkTarget = (link: HTMLAnchorElement): { section: Element } | { url: string } | null => {
        const href = link.getAttribute('href')
        if (!href) {
            return null
        }
        const target = new URL(href, article.url)
        const current = new URL(article.url)
        if (target.hash && target.origin + target.pathname + target.search === current.origin + current.pathname + current.search) {
            const id = decodeURIComponent(target.hash.slice(1))
            const section = articleRef.current?.querySelector(`[id="${CSS.escape(id)}"], [name="${CSS.escape(id)}"]`)
            return section ? { section } : null
        }
        const url = toArticleUrl(target.href)
        return url ? { url } : null
    }

    const linkItems = (url: string): MenuItem[] => [
        { label: 'Open', choose: () => openLink(windowId, url) },
        { label: 'Open in new window', hint: 'Ctrl+click', choose: () => openLinkInNewWindow(url) },
        { label: 'Open side by side', choose: () => openLinkBeside(windowId, url) },
        { label: 'Copy link', divider: true, choose: () => void navigator.clipboard.writeText(url) },
    ]

    // Links inside the article never navigate Ben itself: links to a part of this page turn to it, other web
    // links open in the Reader (this window; a new one with Ctrl+click; the middle button and right-click
    // offer the choices), anything else does nothing.
    const onLinkClick = (e: React.MouseEvent<HTMLElement>): void => {
        const link = (e.target as HTMLElement).closest('a')
        if (!link) {
            return
        }
        e.preventDefault()
        const middle = e.type === 'auxclick' && e.button === 1
        if (e.type !== 'click' && !middle) {
            return
        }
        const target = linkTarget(link)
        if (!target) {
            return
        }
        if ('section' in target) {
            showElement(target.section)
        } else if (middle) {
            setMenu({ x: e.clientX, y: e.clientY, items: linkItems(target.url) })
        } else if (e.ctrlKey || e.metaKey) {
            openLinkInNewWindow(target.url)
        } else {
            openLink(windowId, target.url)
        }
    }

    // Right-click anywhere on the book: what's offered depends on what's under the pointer (a link, selected
    // text), followed by the page's own options. Works on trackpads, where there's no middle button.
    const onContextMenu = (e: React.MouseEvent<HTMLElement>): void => {
        e.preventDefault()
        const items: MenuItem[] = []
        const link = (e.target as HTMLElement).closest('a')
        const target = link ? linkTarget(link) : null
        if (target && 'url' in target) {
            items.push(...linkItems(target.url))
        } else if (target) {
            items.push({ label: 'Go to section', choose: () => showElement(target.section) })
        }
        const selection = window.getSelection()
        const selected = selection && articleRef.current?.contains(selection.anchorNode) ? selection.toString().trim() : ''
        if (selected) {
            const short = selected.length > 24 ? `${selected.slice(0, 24)}…` : selected
            items.push(
                { label: 'Copy', hint: 'Ctrl+C', divider: items.length > 0, choose: () => void navigator.clipboard.writeText(selected) },
                { label: `Search for “${short}”`, choose: () => window.dispatchEvent(new CustomEvent('ben:search', { detail: selected })) }
            )
        }
        const lastSpread = layout ? page + layout.perSpread >= pageCount : true
        items.push(
            { label: 'Previous page', hint: '←', divider: items.length > 0, disabled: page === 0, choose: () => turn(-1) },
            { label: 'Next page', hint: '→', disabled: lastSpread, choose: () => turn(1) },
            { label: 'Back', hint: 'Alt+←', divider: true, disabled: !canGoBack, choose: () => back(windowId) },
            { label: 'Forward', hint: 'Alt+→', disabled: !canGoForward, choose: () => forward(windowId) },
            ...(isPaperUrl(article.url)
                ? []
                : [{ label: 'Copy page link', divider: true, choose: () => void navigator.clipboard.writeText(article.url) }])
        )
        setMenu({ x: e.clientX, y: e.clientY, items })
    }

    // Pressing the middle button on a link would start the browser's auto-scroll (the round scroll
    // cursor) before the menu could open.
    const onMouseDown = (e: React.MouseEvent<HTMLElement>): void => {
        if (e.button === 1 && (e.target as HTMLElement).closest('a')) {
            e.preventDefault()
        }
    }

    const stride = layout ? layout.pageWidth + PAGE_GAP : 0
    const visiblePages = layout
        ? Array.from({ length: layout.perSpread }, (_, i) => page + i).filter((p) => p < pageCount)
        : []

    return (
        <div ref={bookRef} className="reader-book relative h-full overflow-hidden" onContextMenu={onContextMenu}>
            {layout && (
                <>
                    {/* The margins either side of the pages turn back and forward. */}
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="Previous page"
                        className="reader-book__edge reader-book__edge--back absolute inset-y-0 left-0"
                        style={{ width: layout.left }}
                        // Clicking a margin shouldn't take focus: it would stop the keys meaning "turn".
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => turn(-1)}
                        disabled={page === 0}
                    />
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="Next page"
                        className="reader-book__edge reader-book__edge--next absolute inset-y-0 right-0"
                        style={{ left: layout.left + layout.spreadWidth }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => turn(1)}
                        disabled={page + layout.perSpread >= pageCount}
                    />
                </>
            )}
            {/* A frame exactly as wide as the pages showing: the pages before and after sit in the row
                too (that's how the columns flow), and it hides them. */}
            <div
                className="absolute overflow-hidden"
                style={
                    layout
                        ? { left: layout.left, top: TOP_MARGIN, width: layout.spreadWidth, height: layout.pageHeight }
                        : { visibility: 'hidden' }
                }
            >
                <article
                    ref={articleRef}
                    className={cn('reader-article reader-article--paged', turning && 'reader-article--turning')}
                    style={
                        layout
                            ? ({
                                  left: 0,
                                  top: 0,
                                  width: layout.spreadWidth,
                                  height: layout.pageHeight,
                                  columnCount: layout.perSpread,
                                  columnGap: PAGE_GAP,
                                  transform: `translateX(${-page * stride}px)`,
                                  '--page-height': `${layout.pageHeight}px`,
                              } as React.CSSProperties)
                            : { visibility: 'hidden' }
                    }
                    onClick={onLinkClick}
                    onAuxClick={onLinkClick}
                    onMouseDown={onMouseDown}
                >
                    <header className="reader-article__header">
                        <p className="reader-article__site">{article.site ?? hostOf(article.url)}</p>
                        <h1>{article.title}</h1>
                        {article.byline && <p className="reader-article__byline">{article.byline}</p>}
                    </header>
                    {/* Sanitised in extractArticle (DOMPurify): no scripts, forms, embeds or inline styles. */}
                    <div className="reader-article__body" dangerouslySetInnerHTML={{ __html: article.html }} />
                    {article.details && (
                        <details className="reader-article__details">
                            <summary>Details</summary>
                            <div className="reader-article__body" dangerouslySetInnerHTML={{ __html: article.details }} />
                        </details>
                    )}
                </article>
            </div>
            {/* Page numbers at the foot of each page showing, as in a printed book. */}
            {layout &&
                visiblePages.map((p, i) => (
                    <span
                        key={i}
                        className="reader-book__folio absolute text-xs tabular-nums text-tertiary"
                        style={{ left: layout.left + i * stride, width: layout.pageWidth, bottom: BOTTOM_MARGIN / 2 - 8 }}
                    >
                        {p + 1}
                    </span>
                ))}
            {menu && <ContextMenu {...menu} onClose={closeMenu} />}
        </div>
    )
}
