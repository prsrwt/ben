// The Newspaper window: a paper from the Library laid out as an old broadsheet (newspaper.css). The paper's name
// as a blackletter masthead, the date between rules, the section's first story as the lead across four columns,
// "In brief" beside it on the front page (pointers and briefs, each leading to its story), the rest of the
// section's stories below, and the sections along the foot. A story opens in the Reader to be read in full.
// ← and → (or the foot) move between sections.

import './newspaper.css'
// Old Standard TT (headlines) and UnifrakturMaguntia (the masthead), SIL Open Font Licence. The browser downloads
// them only when a paper is showing.
import '@fontsource/old-standard-tt/400.css'
import '@fontsource/old-standard-tt/400-italic.css'
import '@fontsource/old-standard-tt/700.css'
import '@fontsource/unifrakturmaguntia/400.css'

import { useActions, useValues } from 'kea'
import { ReactNode, useEffect, useRef } from 'react'

import { cn } from '~/desktop/cn'
import { WindowId, windowsLogic } from '~/desktop/windowsLogic'

import type { PaperArticle, Teaser } from './layout'
import { OpenPaper, newspaperLogic } from './newspaperLogic'
import { longDate } from './paperFile'
import { allStories, excerpt, storyOn } from './stories'

function Notice({ title, children }: { title: string; children?: ReactNode }): JSX.Element {
    return (
        <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <h2 className="text-lg font-semibold m-0">{title}</h2>
            {children}
        </div>
    )
}

export function NewspaperView({ windowId }: { windowId: WindowId }): JSX.Element {
    const { open } = useValues(newspaperLogic)
    const { openPaper } = useActions(newspaperLogic)

    if (!open) {
        return (
            <Notice title="Newspaper">
                <p className="text-tertiary text-sm m-0">Open a newspaper from the Library.</p>
            </Notice>
        )
    }
    if (open.status === 'loading') {
        return (
            <Notice title="Opening…">
                <p className="text-tertiary text-sm m-0">{open.file.title}</p>
            </Notice>
        )
    }
    if (open.status === 'failed' || !open.paper) {
        return (
            <Notice title="Couldn't open this paper">
                <p className="text-secondary text-sm m-0 max-w-sm">{open.error}</p>
                <button
                    type="button"
                    onClick={() => openPaper(open.file)}
                    className="mt-3 px-3 py-1 rounded-md text-sm font-semibold text-primary bg-hover hover:bg-[color-mix(in_oklab,currentColor_12%,transparent)]"
                >
                    Try again
                </button>
            </Notice>
        )
    }
    return <Broadsheet open={open} windowId={windowId} />
}

/** Rows of three, for the stories below the lead. */
const inRows = <T,>(items: T[]): T[][] => Array.from({ length: Math.ceil(items.length / 3) }, (_, i) => items.slice(i * 3, i * 3 + 3))

function Broadsheet({ open, windowId }: { open: OpenPaper; windowId: WindowId }): JSX.Element {
    const { section } = useValues(newspaperLogic)
    const { showSection, readStory } = useActions(newspaperLogic)
    const { focusedId } = useValues(windowsLogic)
    const sheetRef = useRef<HTMLDivElement>(null)
    const paper = open.paper!
    const stories = allStories(paper)
    const current = paper.sections[Math.min(section, paper.sections.length - 1)]
    const [lead, ...rest] = current.articles
    const briefs = section === 0 ? paper.teasers : []
    const isFront = focusedId === windowId
    const first = Math.min(...current.articles.map((a) => a.page))
    const last = Math.max(...current.articles.map((a) => a.page))
    const printedPages = first === last ? `Page ${first}` : `Pages ${first}–${last}`

    // Each section starts at the top of its page.
    useEffect(() => {
        sheetRef.current?.closest('.desktop-window__body')?.scrollTo({ top: 0 })
    }, [section])

    // ← and → move between sections in the Newspaper window in front (not while typing or in a menu).
    useEffect(() => {
        if (!isFront) {
            return
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            const target = event.target instanceof Element ? event.target : null
            if (event.altKey || event.ctrlKey || event.metaKey || target?.closest('input, textarea, [role="menu"], [role="dialog"]')) {
                return
            }
            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            const next = section + step
            if (step && next >= 0 && next < paper.sections.length) {
                event.preventDefault()
                showSection(next)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isFront, section, paper.sections.length, showSection])

    const read = (story: PaperArticle): void => readStory(stories.indexOf(story))

    /** A pointer or brief leads to its story; failing that, to the section its page is in. */
    const follow = (teaser: Teaser): (() => void) | null => {
        const story = storyOn(stories, teaser.page, teaser.text ?? teaser.title)
        if (story) {
            return () => read(story)
        }
        const target = paper.sections.findIndex((s) => s.articles.some((a) => a.page === teaser.page))
        return target >= 0 ? () => showSection(target) : null
    }

    const headline = (story: PaperArticle, className: string, Tag: 'h1' | 'h2' = 'h2'): JSX.Element => (
        <Tag className={className}>
            <button type="button" className="np-link" onClick={() => read(story)}>
                {story.title}
            </button>
        </Tag>
    )

    const readOn = (story: PaperArticle): JSX.Element => (
        <button type="button" className="np-turn" onClick={() => read(story)}>
            {story.continuesOn !== null ? `Continued on page ${story.continuesOn} →` : 'Read on →'}
        </button>
    )

    return (
        <div ref={sheetRef} className="np-sheet">
            <header className="np-top">
                <div className="np-ear">
                    {stories.length} stories
                    <br />
                    {open.pages} pages
                </div>
                <div className="np-mast">{open.file.paper ?? open.file.title}</div>
                <div className="np-ear">
                    Section {section + 1} of {paper.sections.length}
                    <br />
                    {current.name}
                </div>
            </header>
            <div className="np-date">
                <span>{printedPages}</span>
                <span>{longDate(open.file.date) ?? ''}</span>
                <span>{current.name}</span>
            </div>

            <div className="np-grid">
                <article className={cn('np-col', briefs.length > 0 || rest.length > 0 ? 'np-span4' : 'np-span6')}>
                    {lead.kicker && <p className="np-kicker">{lead.kicker}</p>}
                    {headline(lead, 'np-lead', 'h1')}
                    <div className="np-text np-text--3">
                        {excerpt(lead, 1400)
                            .split(/(?<=[.!?][”"’)]?)\s+(?=\S)/)
                            .reduce<string[]>((paragraphs, sentence) => {
                                // Paragraphs of a few sentences, as the paper's own column text.
                                const last = paragraphs.at(-1)
                                return last && last.length < 320 ? [...paragraphs.slice(0, -1), `${last} ${sentence}`] : [...paragraphs, sentence]
                            }, [])
                            .map((p, i) => (
                                <p key={i}>{p}</p>
                            ))}
                        <p>{readOn(lead)}</p>
                    </div>
                </article>
                {briefs.length > 0 ? (
                    <aside className="np-col np-span2">
                        <h2 className="np-side-title">In brief</h2>
                        {briefs.map((teaser, i) => {
                            const go = follow(teaser)
                            return (
                                <p key={i} className="np-brief">
                                    <b>{teaser.title}</b>
                                    {teaser.text && <> — {teaser.text}</>}{' '}
                                    {go ? (
                                        <button type="button" className="np-turn" onClick={go}>
                                            Page {teaser.page} →
                                        </button>
                                    ) : (
                                        <span className="np-turn">Page {teaser.page}</span>
                                    )}
                                </p>
                            )
                        })}
                    </aside>
                ) : (
                    rest.length > 0 && (
                        <aside className="np-col np-span2">
                            <h2 className="np-side-title">In this section</h2>
                            {rest.slice(0, 10).map((story) => (
                                <p key={stories.indexOf(story)} className="np-brief">
                                    <button type="button" className="np-link" onClick={() => read(story)}>
                                        {story.title}
                                    </button>{' '}
                                    <span className="np-page">p. {story.page}</span>
                                </p>
                            ))}
                        </aside>
                    )
                )}
            </div>

            {inRows(rest).map((row, r) => (
                <div key={r} className="np-grid np-row">
                    {row.map((story) => (
                        <article key={stories.indexOf(story)} className="np-col np-span2">
                            {story.kicker && <p className="np-kicker">{story.kicker}</p>}
                            {headline(story, 'np-headline')}
                            <div className="np-text">
                                <p>{excerpt(story, 420)}</p>
                                <p>{readOn(story)}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ))}

            <nav className="np-sections" aria-label="Sections">
                {paper.sections.map((s, i) => (
                    <button key={i} type="button" className={cn('np-section', i === section && 'np-section--current')} onClick={() => showSection(i)}>
                        {s.name}
                    </button>
                ))}
            </nav>
        </div>
    )
}
