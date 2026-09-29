// A Reader window: a clean article laid out as a book (useBook.ts), or what to do when there isn't one.
// Article styles: reader.css.

import './reader.css'
// Literata (SIL Open Font Licence), bundled with the app: upright and italic, every weight. The browser
// downloads only the character sets a page actually uses.
import '@fontsource-variable/literata'
import '@fontsource-variable/literata/wght-italic.css'

import { useActions, useValues } from 'kea'
import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { WindowId, windowsLogic } from '~/desktop/windowsLogic'

import { Article, toArticleUrl } from './fetchArticle'
import { LinkMenu } from './LinkMenu'
import { PageFlip } from './PageFlip'
import { readerLogic, readerWindowState } from './readerLogic'
import { BOTTOM_MARGIN, PAGE_GAP, TOP_MARGIN, useBook } from './useBook'

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** Where each page was scrolled to, by page id, so back and forward return to the same spot. */
const scrollPositions = new Map<number, number>()

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
    const { current } = readerWindowState(useValues(readerLogic).histories, windowId)
    const rootRef = useRef<HTMLDivElement>(null)
    const pageId = current?.status === 'ready' ? current.id : null

    // When a page shows, put it back where it was scrolled to (a new page starts at the top), then keep
    // track of where it's scrolled. One effect, so the previous page stops recording before this one moves.
    useLayoutEffect(() => {
        const scroller = rootRef.current?.closest('.desktop-window__body')
        if (!scroller) {
            return
        }
        scroller.scrollTo(0, pageId === null ? 0 : (scrollPositions.get(pageId) ?? 0))
        if (pageId === null) {
            return
        }
        const onScroll = (): void => void scrollPositions.set(pageId, scroller.scrollTop)
        scroller.addEventListener('scroll', onScroll, { passive: true })
        return () => scroller.removeEventListener('scroll', onScroll)
    }, [pageId])

    return (
        <div ref={rootRef} className="h-full">
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
                <p className="text-tertiary text-xs m-0 max-w-sm break-all">{current.url}</p>
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
    return <ArticleBook key={current.id} article={current.article} windowId={windowId} />
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

function ArticleBook({ article, windowId }: { article: Article; windowId: WindowId }): JSX.Element {
    const { focusedId } = useValues(windowsLogic)
    const { openLink, openLinkBeside, openLinkInNewWindow } = useActions(readerLogic)
    const bookRef = useRef<HTMLDivElement>(null)
    const articleRef = useRef<HTMLElement>(null)
    const { layout, page, pageCount, flip, endFlip, turn, showElement } = useBook(bookRef, articleRef)
    // The middle-click menu: where it was opened, and for which link.
    const [linkMenu, setLinkMenu] = useState<{ x: number; y: number; url: string } | null>(null)
    const closeLinkMenu = useCallback(() => setLinkMenu(null), [])
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

    // Links inside the article never navigate Ben itself: links to a part of this page turn to it,
    // other web links open in the Reader (this window; a new one with Ctrl+click; the middle button asks:
    // new window or side by side), anything else does nothing.
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
        const href = link.getAttribute('href')
        if (!href) {
            return
        }
        const target = new URL(href, article.url)
        const current = new URL(article.url)
        if (target.hash && target.origin + target.pathname + target.search === current.origin + current.pathname + current.search) {
            const id = decodeURIComponent(target.hash.slice(1))
            const element = articleRef.current?.querySelector(`[id="${CSS.escape(id)}"], [name="${CSS.escape(id)}"]`)
            if (element) {
                showElement(element)
            }
            return
        }
        const next = toArticleUrl(target.href)
        if (!next) {
            return
        }
        if (middle) {
            setLinkMenu({ x: e.clientX, y: e.clientY, url: next })
        } else if (e.ctrlKey || e.metaKey) {
            openLinkInNewWindow(next)
        } else {
            openLink(windowId, next)
        }
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
        <div ref={bookRef} className="reader-book relative h-full overflow-hidden">
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
                    className="reader-article reader-article--paged"
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
                                  // While a turn animates, its copies of the pages show instead.
                                  visibility: flip ? 'hidden' : undefined,
                              } as React.CSSProperties)
                            : { visibility: 'hidden' }
                    }
                    onClick={onLinkClick}
                    onAuxClick={onLinkClick}
                    onMouseDown={onMouseDown}
                >
                    <header className="reader-article__header">
                        <p className="reader-article__site">{hostOf(article.url)}</p>
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
            {flip && layout && articleRef.current && (
                <PageFlip key={flip.id} flip={flip} layout={layout} article={articleRef.current} onDone={endFlip} />
            )}
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
            {linkMenu && (
                <LinkMenu
                    x={linkMenu.x}
                    y={linkMenu.y}
                    onNewWindow={() => openLinkInNewWindow(linkMenu.url)}
                    onSideBySide={() => openLinkBeside(windowId, linkMenu.url)}
                    onClose={closeLinkMenu}
                />
            )}
        </div>
    )
}
