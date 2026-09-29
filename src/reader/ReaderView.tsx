// The Reader window: a clean article, or what to do when there isn't one. Article styles: reader.css.

import './reader.css'

import { useActions, useValues } from 'kea'
import { ReactNode, useLayoutEffect, useRef } from 'react'

import { toArticleUrl } from './fetchArticle'
import { readerLogic } from './readerLogic'

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

export function ReaderView(): JSX.Element {
    const { current } = useValues(readerLogic)
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
            <ReaderPageView />
        </div>
    )
}

function ReaderPageView(): JSX.Element {
    const { current } = useValues(readerLogic)
    const { openLink, reload } = useActions(readerLogic)
    const articleRef = useRef<HTMLElement>(null)

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
                    onClick={reload}
                    className="mt-3 px-3 py-1 rounded-md text-sm font-semibold text-primary bg-hover hover:bg-[color-mix(in_oklab,currentColor_12%,transparent)]"
                >
                    Try again
                </button>
            </Notice>
        )
    }
    const article = current?.article
    if (!article) {
        return (
            <Notice title="Reader">
                <p className="text-tertiary text-sm m-0">Paste a link into the search bar at the top (Ctrl K).</p>
            </Notice>
        )
    }

    // Links inside the article never navigate Ben itself: links to a part of this page scroll there,
    // other web links open in the Reader, anything else does nothing.
    const onLinkClick = (e: React.MouseEvent<HTMLElement>): void => {
        const link = (e.target as HTMLElement).closest('a')
        if (!link) {
            return
        }
        e.preventDefault()
        if (e.type !== 'click') {
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
            articleRef.current
                ?.querySelector(`[id="${CSS.escape(id)}"], [name="${CSS.escape(id)}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        const next = toArticleUrl(target.href)
        if (next) {
            openLink(next)
        }
    }

    return (
        <article ref={articleRef} className="reader-article" onClick={onLinkClick} onAuxClick={onLinkClick}>
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
    )
}
