// The Reader window: a clean article, or what to do when there isn't one. Article styles: reader.css.

import './reader.css'

import { useActions, useValues } from 'kea'
import { useEffect, useRef } from 'react'

import { toArticleUrl } from './fetchArticle'
import { readerLogic } from './readerLogic'

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** Centred message for the states without an article. */
function Notice({ title, children }: { title: string; children?: React.ReactNode }): JSX.Element {
    return (
        <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <h2 className="text-lg font-semibold m-0">{title}</h2>
            {children}
        </div>
    )
}

export function ReaderView(): JSX.Element {
    const { status, url, article, error } = useValues(readerLogic)
    const { openLink } = useActions(readerLogic)
    const articleRef = useRef<HTMLElement>(null)

    // A new article starts at the top of the window, not wherever the last one was scrolled to.
    useEffect(() => {
        articleRef.current?.closest('.desktop-window__body')?.scrollTo(0, 0)
    }, [article])

    if (status === 'loading' && url) {
        return (
            <Notice title="Opening…">
                <p className="text-tertiary text-sm m-0">{hostOf(url)}</p>
            </Notice>
        )
    }
    if (status === 'failed' && url) {
        return (
            <Notice title="Couldn't open this page">
                <p className="text-secondary text-sm m-0 max-w-sm">{error}</p>
                <p className="text-tertiary text-xs m-0 max-w-sm break-all">{url}</p>
                <button
                    type="button"
                    onClick={() => openLink(url)}
                    className="mt-3 px-3 py-1 rounded-md text-sm font-semibold text-primary bg-hover hover:bg-[color-mix(in_oklab,currentColor_12%,transparent)]"
                >
                    Try again
                </button>
            </Notice>
        )
    }
    if (status !== 'ready' || !article) {
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
