// The Newspaper window: a paper from the Library laid out as an old broadsheet (newspaper.css). The paper's name
// as a blackletter masthead, the date between rules, the section's first story as the lead across four columns,
// "In brief" beside it on the front page (pointers and briefs, each leading to its story), the rest of the
// section's stories below, and the sections along the foot. ← and → (or the foot) move between sections. Its index
// (sections and their stories) is the Contents pill on Ben Island, as for a book in the Reader.
// Clicking a story opens it on its own sheet in the same newspaper style (StorySheet), in large, calm type for
// long reading: ← → for the story before or after, Esc (or "Back to …") returns to the page where you were.

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
import { ContentsEntry, registerBook, setCurrentSection } from '~/reader/openBooks'

import type { Paper, PaperArticle, Teaser } from './layout'
import { OpenPaper, newspaperLogic } from './newspaperLogic'
import { longDate } from './paperFile'
import { allStories, continuation, credit, excerpt, storyOn } from './stories'

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
        const { progress } = open
        return (
            <Notice title={progress ? `Reading page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : 'Opening…'}>
                <p className="text-tertiary text-sm m-0">{open.file.title}</p>
                {progress && (
                    <p className="text-tertiary text-xs m-0 mt-2 max-w-sm">
                        This paper is a scan, so Ben reads it by looking at each page. It takes a little while.
                    </p>
                )}
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
    const { section, reading } = useValues(newspaperLogic)
    const { showSection, openStory, readStory } = useActions(newspaperLogic)
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

    const body = (): Element | null | undefined => sheetRef.current?.closest('.desktop-window__body')
    /** A story chosen from Contents, to scroll to once its section shows. */
    const targetRef = useRef<number | null>(null)
    /** Where the page was scrolled to when a story was opened, to return to. */
    const returnRef = useRef<number | null>(null)
    const showStory = (index: number): void => {
        const story = sheetRef.current?.querySelector<HTMLElement>(`[data-story="${index}"]`)
        if (story) {
            story.scrollIntoView({ block: 'start' })
            // A brief glow, so the eye finds it.
            story.classList.remove('np-found')
            void story.offsetWidth
            story.classList.add('np-found')
        }
    }

    // A story's sheet and each section start at the top; back from a story, the page is where it was; a story
    // chosen from Contents is scrolled to.
    useEffect(() => {
        if (reading !== null) {
            body()?.scrollTo({ top: 0 })
        } else if (targetRef.current !== null) {
            showStory(targetRef.current)
            targetRef.current = null
        } else {
            body()?.scrollTo({ top: returnRef.current ?? 0 })
        }
        returnRef.current = reading === null ? null : returnRef.current
    }, [section, reading])

    // The index on Ben Island: each section, then its stories, with the printed page each starts on.
    useEffect(() => {
        const places = paper.sections.flatMap((s, i) => [{ section: i, story: null as number | null }, ...s.articles.map((a) => ({ section: i, story: stories.indexOf(a) }))])
        return registerBook(windowId, {
            contents: (): ContentsEntry[] =>
                paper.sections.flatMap((s, i) => [
                    { title: s.name, depth: 0, page: Math.min(...s.articles.map((a) => a.page)) - 1, current: i === section },
                    ...s.articles.map((a) => ({ title: a.title, depth: 1, page: a.page - 1, current: false })),
                ]),
            goTo: (index) => {
                const place = places[index]
                if (!place) {
                    return
                }
                returnRef.current = null
                if (reading !== null && place.section === section) {
                    // From a story's sheet: back to the page, at the chosen place.
                    targetRef.current = place.story
                    openStory(null)
                } else if (place.section === section) {
                    if (place.story === null) {
                        body()?.scrollTo({ top: 0 })
                    } else {
                        showStory(place.story)
                    }
                } else {
                    targetRef.current = place.story
                    showSection(place.section)
                }
            },
        })
    })
    useEffect(() => setCurrentSection(windowId, current.name), [windowId, current.name])
    useEffect(() => () => setCurrentSection(windowId, null), [windowId])

    // In the Newspaper window in front (not while typing or in a menu): ← and → move between sections, or between
    // stories while one is open on its sheet, and Esc closes the sheet.
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
            if (reading !== null) {
                if (event.key === 'Escape') {
                    openStory(null)
                } else if (step && reading + step >= 0 && reading + step < stories.length) {
                    event.preventDefault()
                    openStory(reading + step)
                }
                return
            }
            const next = section + step
            if (step && next >= 0 && next < paper.sections.length) {
                event.preventDefault()
                showSection(next)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [isFront, section, reading, stories.length, paper.sections.length, showSection, openStory])

    /** Opens a story on its own sheet, remembering where the page was. */
    const read = (story: PaperArticle): void => {
        returnRef.current = body()?.scrollTop ?? 0
        openStory(stories.indexOf(story))
    }

    if (reading !== null && stories[reading]) {
        return (
            <div ref={sheetRef} className="np-sheet">
                <StorySheet
                    paper={paper}
                    index={reading}
                    masthead={open.file.paper ?? open.file.title}
                    date={longDate(open.file.date)}
                    onGo={openStory}
                    onReader={readStory}
                />
            </div>
        )
    }

    /** Where a pointer or brief leads: its story; failing that, the section its page is in. */
    const leadsTo = (teaser: Teaser): { story: PaperArticle } | { section: number } | null => {
        const story = storyOn(stories, teaser.page, teaser.text ?? teaser.title)
        if (story) {
            return { story }
        }
        const target = paper.sections.findIndex((s) => s.articles.some((a) => a.page === teaser.page))
        return target >= 0 ? { section: target } : null
    }
    const follow = (to: { story: PaperArticle } | { section: number }): void => ('story' in to ? read(to.story) : showSection(to.section))

    const headline = (story: PaperArticle, className: string, Tag: 'h1' | 'h2' = 'h2'): JSX.Element => (
        <Tag className={className}>
            <button type="button" className="np-link" onClick={() => read(story)}>
                {story.title}
            </button>
        </Tag>
    )

    const readOn = (story: PaperArticle): JSX.Element => (
        <button type="button" className="np-turn" onClick={() => read(story)}>
            {story.continuesOn !== null ? `Continued on page ${story.continuesOn} →` : 'Read →'}
        </button>
    )

    return (
        <div ref={sheetRef} className="np-sheet">
            <header className="np-top">
                <div className="np-ear">
                    {stories.length} {stories.length === 1 ? 'story' : 'stories'}
                    <br />
                    {open.pages} {open.pages === 1 ? 'page' : 'pages'}
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
                <article
                    data-story={stories.indexOf(lead)}
                    className={cn('np-col np-story', briefs.length > 0 || rest.length > 0 ? 'np-span4' : 'np-span6')}
                    onClick={() => read(lead)}
                >
                    {lead.kicker && <p className="np-kicker">{lead.kicker}</p>}
                    {headline(lead, 'np-lead', 'h1')}
                    {lead.deck && <p className="np-deck">{lead.deck}</p>}
                    {credit(lead) && <p className="np-credit">{credit(lead)}</p>}
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
                            const to = leadsTo(teaser)
                            return (
                                <p key={i} className="np-brief">
                                    <b>{teaser.title}</b>
                                    {teaser.text && <> — {teaser.text}</>}{' '}
                                    {to ? (
                                        <button type="button" className="np-turn" onClick={() => follow(to)}>
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
                        <article key={stories.indexOf(story)} data-story={stories.indexOf(story)} className="np-col np-story np-span2" onClick={() => read(story)}>
                            {story.kicker && <p className="np-kicker">{story.kicker}</p>}
                            {headline(story, 'np-headline')}
                            {credit(story) && <p className="np-credit">{credit(story)}</p>}
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

/** One story on its own sheet, in the paper's style: a small masthead and the date between rules, then the
 *  kicker, headline, summary and byline, then the story in large type in one column of comfortable width, with
 *  its "continued on page n" part joined on. The stories before and after are at the foot. */
function StorySheet({
    paper,
    index,
    masthead,
    date,
    onGo,
    onReader,
}: {
    paper: Paper
    index: number
    masthead: string
    date: string | null
    onGo: (story: number | null) => void
    onReader: (story: number) => void
}): JSX.Element {
    const stories = allStories(paper)
    const story = stories[index]
    const section = paper.sections.find((s) => s.articles.includes(story))
    const next = continuation(stories, story)
    const before = stories[index - 1]
    const after = stories[index + 1]
    const by = credit(story)
    return (
        <article className="np-read">
            <header className="np-read-top">
                <div className="np-read-mast">{masthead}</div>
                <div className="np-date">
                    <button type="button" className="np-back" onClick={() => onGo(null)} title="Back to the page (Esc)">
                        ← {section?.name ?? 'Back'}
                    </button>
                    <span>{date ?? ''}</span>
                    <span>Page {story.page}</span>
                </div>
            </header>

            {story.kicker && <p className="np-kicker">{story.kicker}</p>}
            <h1 className="np-read-title">{story.title}</h1>
            {story.deck && <p className="np-read-deck">{story.deck}</p>}
            {by && <p className="np-read-credit">{by}</p>}

            <div className="np-read-text">
                {story.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                ))}
                {next && (
                    <>
                        <p className="np-read-continues">Continued on page {next.page}</p>
                        {next.paragraphs.map((p, i) => (
                            <p key={`next-${i}`}>{p}</p>
                        ))}
                    </>
                )}
            </div>

            <footer className="np-read-foot">
                {before ? (
                    <button type="button" className="np-read-step" onClick={() => onGo(index - 1)}>
                        <span>← Before</span>
                        {before.title}
                    </button>
                ) : (
                    <span />
                )}
                <button type="button" className="np-turn np-read-reader" onClick={() => onReader(index)}>
                    Open in Reader
                </button>
                {after ? (
                    <button type="button" className="np-read-step np-read-step--after" onClick={() => onGo(index + 1)}>
                        <span>Next →</span>
                        {after.title}
                    </button>
                ) : (
                    <span />
                )}
            </footer>
        </article>
    )
}
