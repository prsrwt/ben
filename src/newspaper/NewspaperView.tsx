// The Newspaper window: a paper from the Library laid out as an old broadsheet (newspaper.css). The paper's name
// as a blackletter masthead, the date between rules, the section's first story as the lead across four columns,
// "In brief" beside it on the front page (pointers and briefs, each leading to its story), the rest of the
// section's stories below, and the sections along the foot. ← and → (or the foot) move between sections. Its index
// (sections and their stories) is the Contents pill on Ben Island, as for a book in the Reader.
// Clicking a story opens it on its own sheet in the same newspaper style (StorySheet), in large, calm type for
// long reading, laid out as pages that turn like a book in the Reader: ← → (or the margins) turn them, and past
// its last page come the next story and then the next section's. Esc (or "← Section") returns to the page where
// you were. Text size, paper tone and the break reminder come from the "Aa" menu on Ben Island (comfortLogic).

import './newspaper.css'
// Old Standard TT (headlines) and UnifrakturMaguntia (the masthead), SIL Open Font Licence. The browser downloads
// them only when a paper is showing.
import '@fontsource/old-standard-tt/400.css'
import '@fontsource/old-standard-tt/400-italic.css'
import '@fontsource/old-standard-tt/700.css'
import '@fontsource/unifrakturmaguntia/400.css'

import { useActions, useValues } from 'kea'
import { CSSProperties, ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { cn } from '~/desktop/cn'
import { WindowId, windowsLogic } from '~/desktop/windowsLogic'
import { ContentsEntry, registerBook, setCurrentSection } from '~/reader/openBooks'
import { BOTTOM_MARGIN, PAGE_GAP, TOP_MARGIN, useBook } from '~/reader/useBook'

import { comfortLogic, textScale } from './comfortLogic'
import type { Paper, PaperArticle, Teaser } from './layout'
import { OpenPaper, newspaperLogic, paperWindow } from './newspaperLogic'
import { longDate } from './paperFile'
import { allStories, continuation, credit, excerpt, readingMinutes, storyOn } from './stories'

function Notice({ title, children }: { title: string; children?: ReactNode }): JSX.Element {
    return (
        <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <h2 className="text-lg font-semibold m-0">{title}</h2>
            {children}
        </div>
    )
}

export function NewspaperView({ windowId }: { windowId: WindowId }): JSX.Element {
    const { open } = paperWindow(useValues(newspaperLogic).windows, windowId)
    const { loadPaper } = useActions(newspaperLogic)

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
                    onClick={() => loadPaper(windowId, open.file)}
                    className="mt-3 px-3 py-1 rounded-md text-sm font-semibold text-primary bg-hover hover:bg-[color-mix(in_oklab,currentColor_12%,transparent)]"
                >
                    Try again
                </button>
            </Notice>
        )
    }
    return <Broadsheet open={open} windowId={windowId} />
}

/** The sheet's tone and text size, from the "Aa" menu. */
function useSheetLook(): { className: string; style: CSSProperties } {
    const { comfort } = useValues(comfortLogic)
    return {
        className: cn('np-sheet', comfort.tone !== 'theme' && `np-tone-${comfort.tone}`),
        style: { '--np-scale': textScale(comfort.textStep) } as CSSProperties,
    }
}

/** The sheet's text grows with the window: 1 up to ~1100px wide, then in step with it, to 1.35 (~1500px). Set on
 *  the sheet as --np-fit, which every size in newspaper.css is multiplied by. */
function useFit(ref: React.RefObject<HTMLElement>, key: unknown): void {
    useLayoutEffect(() => {
        const sheet = ref.current
        if (!sheet) {
            return
        }
        const fit = (): void => sheet.style.setProperty('--np-fit', String(Math.min(1.35, Math.max(1, sheet.clientWidth / 1100))))
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(sheet)
        return () => observer.disconnect()
    }, [ref, key])
}

/** "Saurabh Trivedi · New Delhi · 4 min read". */
const creditLine = (stories: PaperArticle[], story: PaperArticle): string =>
    [credit(story), `${readingMinutes(stories, story)} min read`].filter(Boolean).join(' · ')

/** Rows of three, for the stories below the lead. */
const inRows = <T,>(items: T[]): T[][] => Array.from({ length: Math.ceil(items.length / 3) }, (_, i) => items.slice(i * 3, i * 3 + 3))

function Broadsheet({ open, windowId }: { open: OpenPaper; windowId: WindowId }): JSX.Element {
    const { section, reading } = paperWindow(useValues(newspaperLogic).windows, windowId)
    const actions = useActions(newspaperLogic)
    // This window's section and story.
    const showSection = useCallback((n: number) => actions.showSection(windowId, n), [actions, windowId])
    const openStory = useCallback((n: number | null) => actions.openStory(windowId, n), [actions, windowId])
    const { focusedId } = useValues(windowsLogic)
    const sheetRef = useRef<HTMLDivElement>(null)
    const look = useSheetLook()
    useFit(sheetRef, reading)
    const paper = open.paper!
    const stories = allStories(paper)
    const current = paper.sections[Math.min(section, paper.sections.length - 1)]
    // The lead: the longest story on the section's first page (an advert's big slogan has little text under it).
    const firstPage = Math.min(...current.articles.map((a) => a.page))
    const textLength = (a: PaperArticle): number => a.paragraphs.join(' ').length
    const lead = current.articles.filter((a) => a.page === firstPage).reduce((best, a) => (textLength(a) > textLength(best) ? a : best))
    const rest = current.articles.filter((a) => a !== lead)
    const briefs = section === 0 ? paper.teasers : []
    const isFront = focusedId === windowId
    const first = Math.min(...current.articles.map((a) => a.page))
    const last = Math.max(...current.articles.map((a) => a.page))
    const printedPages = first === last ? `page ${first}` : `pages ${first}–${last}`
    const prevSection = paper.sections[section - 1]
    const nextSection = paper.sections[section + 1]

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
                    // The section showing is current, or, while a story is open, that story.
                    { title: s.name, depth: 0, page: Math.min(...s.articles.map((a) => a.page)) - 1, current: reading === null && i === section },
                    ...s.articles.map((a) => ({ title: a.title, depth: 1, page: a.page - 1, current: reading !== null && stories[reading] === a })),
                ]),
            goTo: (index) => {
                const place = places[index]
                if (!place) {
                    return
                }
                returnRef.current = null
                if (place.story !== null) {
                    // A story opens straight on its sheet; closing it returns to it on its section's page.
                    if (place.section !== section) {
                        showSection(place.section)
                    }
                    openStory(place.story)
                } else if (place.section !== section) {
                    showSection(place.section)
                } else if (reading !== null) {
                    openStory(null)
                } else {
                    body()?.scrollTo({ top: 0 })
                }
            },
        })
    })
    // The section the reader is in: the page's, or the open story's (← → can carry it into the next section).
    const sectionOfStory = (index: number): number => paper.sections.findIndex((s) => s.articles.includes(stories[index]))
    const readingSection = reading !== null && stories[reading] ? paper.sections[sectionOfStory(reading)] : current
    useEffect(() => setCurrentSection(windowId, readingSection.name), [windowId, readingSection.name])
    useEffect(() => () => setCurrentSection(windowId, null), [windowId])

    // In the Newspaper window in front (not while typing or in a menu): ← and → move between sections. A story
    // open on its sheet has its own keys (StorySheet).
    useEffect(() => {
        if (!isFront || reading !== null) {
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
    }, [isFront, section, reading, paper.sections.length, showSection])

    /** Back from a story to the page: where you were, or, if reading carried on into another section, that
     *  section's page at the story. */
    const back = (): void => {
        const storySection = reading === null ? section : sectionOfStory(reading)
        // Opened from Contents (no place on the page to return to), or read on into another section: back to the
        // story itself on its section's page.
        if (reading !== null && (storySection !== section || returnRef.current === null)) {
            targetRef.current = reading
            returnRef.current = null
            if (storySection !== section) {
                showSection(storySection)
            } else {
                openStory(null)
            }
        } else {
            openStory(null)
        }
    }

    /** Opens a story on its own sheet, remembering where the page was. */
    const read = (story: PaperArticle): void => {
        returnRef.current = body()?.scrollTop ?? 0
        openStory(stories.indexOf(story))
    }

    if (reading !== null && stories[reading]) {
        return (
            <div ref={sheetRef} className={cn(look.className, 'np-sheet--book')} style={look.style}>
                <StorySheet
                    // A new book for each story, opening on its first page.
                    key={reading}
                    paper={paper}
                    index={reading}
                    masthead={open.file.paper ?? open.file.title}
                    date={longDate(open.file.date)}
                    isFront={isFront}
                    onGo={(story) => (story === null ? back() : openStory(story))}
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
        <div ref={sheetRef} className={look.className} style={look.style}>
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
                    {current.name} · {printedPages}
                </div>
            </header>
            {/* The section before and after, named, either side of the date. */}
            <div className="np-date">
                {prevSection ? (
                    <button type="button" className="np-nav" onClick={() => showSection(section - 1)} title="Previous section (←)">
                        ‹ {prevSection.name}
                    </button>
                ) : (
                    <span className="np-nav-none">{current.name}</span>
                )}
                <span>{longDate(open.file.date) ?? ''}</span>
                {nextSection ? (
                    <button type="button" className="np-nav" onClick={() => showSection(section + 1)} title="Next section (→)">
                        {nextSection.name} ›
                    </button>
                ) : (
                    <span className="np-nav-none">Last section</span>
                )}
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
                    <p className="np-credit">{creditLine(stories, lead)}</p>
                    <div className="np-text np-text--3">
                        {/* Longer beside a long "In brief", so the lead fills its side of the page. */}
                        {excerpt(lead, Math.min(3200, 1400 + Math.max(0, (section === 0 ? paper.teasers.length : rest.length) - 4) * 220))
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
                            <p className="np-credit">{creditLine(stories, story)}</p>
                            <div className="np-text">
                                <p>{excerpt(story, 420)}</p>
                                <p>{readOn(story)}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ))}

            {/* The foot: the section before, every section, the section after. */}
            <nav className="np-foot" aria-label="Sections">
                {prevSection ? (
                    <button type="button" className="np-foot-step" onClick={() => showSection(section - 1)}>
                        <span>‹ Previous section</span>
                        {prevSection.name}
                    </button>
                ) : (
                    <span />
                )}
                <div className="np-sections">
                    {paper.sections.map((s, i) => (
                        <button key={i} type="button" className={cn('np-section', i === section && 'np-section--current')} onClick={() => showSection(i)}>
                            {s.name}
                        </button>
                    ))}
                </div>
                {nextSection ? (
                    <button type="button" className="np-foot-step np-foot-step--next" onClick={() => showSection(section + 1)}>
                        <span>Next section ›</span>
                        {nextSection.name}
                    </button>
                ) : (
                    <span />
                )}
            </nav>
        </div>
    )
}

/** The paper's end mark, after a story's last word. */
const EndMark = (): JSX.Element => (
    <span className="np-read-end" aria-hidden>
        {' '}■
    </span>
)

/** The story before or after, in the margin beside the first or last page where the page arrow would be: a round
 *  arrow; in a wide margin, what it is ("Next story", "Next section · Sport") and its headline under it; in a narrow
 *  one, both on a card that slides out over the page edge under the pointer. */
function StoryStep({
    side,
    story,
    label,
    width,
    onClick,
}: {
    side: 'back' | 'next'
    story: PaperArticle
    label: string
    width: number
    onClick: () => void
}): JSX.Element {
    const roomy = width >= 190
    return (
        <button
            type="button"
            className={cn('np-step', side === 'next' ? 'np-step--next' : 'np-step--back')}
            style={side === 'next' ? { right: 0, width } : { left: 0, width }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            aria-label={`${label}: ${story.title}`}
        >
            <span className="np-step__arrow" aria-hidden>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d={side === 'next' ? 'M6 3.5 10.5 8 6 12.5' : 'M10 3.5 5.5 8l4.5 4.5'} />
                </svg>
            </span>
            {roomy && <span className="np-step__label">{label}</span>}
            {roomy && <span className="np-step__title">{story.title}</span>}
            {!roomy && (
                <span className="np-step__peek" aria-hidden>
                    <span className="np-step__label">{label}</span>
                    <span className="np-step__title">{story.title}</span>
                </span>
            )}
        </button>
    )
}

/** Keys that turn a story's pages, unless focus is somewhere they mean something else (a field, a menu). */
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

/** One story on its own sheet, in the paper's style: a small masthead and the date between rules stay at the top;
 *  below, the story is a book (useBook, as in the Reader): kicker, headline, summary and byline, then the text in
 *  large type, its "continued on page n" part joined on, flowing into pages that turn. Past the last page come
 *  the next story and then the next section's; the foot of the last page names them. */
function StorySheet({
    paper,
    index,
    masthead,
    date,
    isFront,
    onGo,
}: {
    paper: Paper
    index: number
    masthead: string
    date: string | null
    isFront: boolean
    onGo: (story: number | null) => void
}): JSX.Element {
    const { comfort } = useValues(comfortLogic)
    const stories = allStories(paper)
    const story = stories[index]
    const sectionOf = (s: PaperArticle | undefined): string | undefined => paper.sections.find((x) => x.articles.includes(s!))?.name
    const section = sectionOf(story)
    const next = continuation(stories, story)
    const before = stories[index - 1]
    const after = stories[index + 1]
    const afterSection = sectionOf(after)
    const beforeSection = sectionOf(before)
    const sectionArticles = paper.sections.find((x) => x.articles.includes(story))?.articles ?? [story]
    const inSection = sectionArticles.indexOf(story)
    const sectionStories = sectionArticles.length
    const bookRef = useRef<HTMLDivElement>(null)
    const articleRef = useRef<HTMLElement>(null)
    const { layout, page, pageCount, turning, turn, recount } = useBook(bookRef, articleRef, { initial: null, onChange: () => {} })
    const atEnd = layout ? page + layout.perSpread >= pageCount : true

    // A new text size, and the paper's fonts arriving, change how many pages there are.
    useEffect(() => recount(), [comfort.textStep, recount])
    useEffect(() => {
        void document.fonts.ready.then(recount)
    }, [recount])

    /** A turn forward past the last page goes on to the next story; back from the first, to the one before. */
    const step = (direction: 1 | -1): void => {
        if (direction === 1 && atEnd) {
            if (after) {
                onGo(index + 1)
            }
        } else if (direction === -1 && page === 0) {
            if (before) {
                onGo(index - 1)
            }
        } else {
            turn(direction)
        }
    }

    useEffect(() => {
        if (!isFront) {
            return
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape' && !(event.target instanceof Element && event.target.closest('[role="menu"], [role="dialog"]'))) {
                onGo(null)
                return
            }
            const direction = turnDirection(event)
            if (direction) {
                event.preventDefault()
                if (document.activeElement instanceof HTMLButtonElement) {
                    document.activeElement.blur()
                }
                step(direction)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    })

    const stride = layout ? layout.pageWidth + PAGE_GAP : 0
    const visiblePages = layout ? Array.from({ length: layout.perSpread }, (_, i) => page + i).filter((p) => p < pageCount) : []

    return (
        <>
            <button type="button" className="np-close" onClick={() => onGo(null)} title="Close the story (Esc)" aria-label="Close the story">
                ×
            </button>
            <header className="np-read-top">
                <div className="np-read-mast">{masthead}</div>
                <div className="np-date">
                    <button type="button" className="np-nav" onClick={() => onGo(null)} title="Back to the page (Esc)">
                        ‹ Back to {section ?? 'the paper'}
                    </button>
                    <span>{date ?? ''}</span>
                    <span>
                        Page {story.page} · {readingMinutes(stories, story)} min read
                    </span>
                </div>
            </header>

            <div ref={bookRef} className="np-book reader-book">
                {layout && (
                    <>
                        {/* The margins turn pages; at the first page the left one is the story before, at the last
                            the right one is the next story, named. */}
                        {page === 0 && before ? (
                            <StoryStep side="back" story={before} label={beforeSection !== section ? `Previous section · ${beforeSection}` : 'Previous story'} width={layout.left} onClick={() => step(-1)} />
                        ) : (
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label="Previous page"
                                className="reader-book__edge reader-book__edge--back absolute inset-y-0 left-0"
                                style={{ width: layout.left }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => step(-1)}
                                disabled={page === 0}
                            />
                        )}
                        {atEnd && after ? (
                            <StoryStep side="next" story={after} label={afterSection !== section ? `Next section · ${afterSection}` : 'Next story'} width={layout.left} onClick={() => step(1)} />
                        ) : (
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label="Next page"
                                className="reader-book__edge reader-book__edge--next absolute inset-y-0 right-0"
                                style={{ left: layout.left + layout.spreadWidth }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => step(1)}
                                disabled={atEnd}
                            />
                        )}
                    </>
                )}
                <div
                    className="absolute overflow-hidden"
                    style={layout ? { left: layout.left, top: TOP_MARGIN, width: layout.spreadWidth, height: layout.pageHeight } : { visibility: 'hidden' }}
                >
                    <article
                        ref={articleRef}
                        className={cn('np-read-pages reader-article--paged', turning && 'reader-article--turning')}
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
                                  } as CSSProperties)
                                : { visibility: 'hidden' }
                        }
                    >
                        <header className="np-read-head">
                            {story.kicker && <p className="np-kicker">{story.kicker}</p>}
                            <h1 className="np-read-title">{story.title}</h1>
                            {story.deck && <p className="np-read-deck">{story.deck}</p>}
                            {credit(story) && <p className="np-read-credit">{credit(story)}</p>}
                        </header>
                        <div className="np-read-text">
                            {story.paragraphs.map((p, i) => (
                                <p key={i}>
                                    {p}
                                    {!next && i === story.paragraphs.length - 1 && <EndMark />}
                                </p>
                            ))}
                            {next && (
                                <>
                                    <p className="np-read-continues">Continued on page {next.page}</p>
                                    {next.paragraphs.map((p, i) => (
                                        <p key={`next-${i}`}>
                                            {p}
                                            {i === next.paragraphs.length - 1 && <EndMark />}
                                        </p>
                                    ))}
                                </>
                            )}
                        </div>
                    </article>
                </div>
                {layout &&
                    visiblePages.map((p, i) => (
                        <span
                            key={i}
                            className="reader-book__folio absolute text-xs tabular-nums"
                            style={{ left: layout.left + i * stride, width: layout.pageWidth, bottom: BOTTOM_MARGIN / 2 - 8 }}
                        >
                            {p + 1}
                        </span>
                    ))}
            </div>

            {/* Where you are: the pages of this story, and the story among its section's. */}
            <div className="np-read-nav">
                {layout && pageCount > 1
                    ? `Page ${page + 1}${layout.perSpread === 2 && page + 2 <= pageCount ? `–${page + 2}` : ''} of ${pageCount}`
                    : 'One page'}
                {' · '}Story {inSection + 1} of {sectionStories} in {section}
                {!after && atEnd ? ' · The end of the paper' : ''}
            </div>
        </>
    )
}
