// Ben View (Ctrl+Space): every app with open windows as a card over the dimmed desktop. An app with several
// windows is a stack; clicking it fans it out into one card per window. Clicking a window's card brings it
// to the front and closes Ben View; its × closes that window. Arrow keys move between cards, Enter picks.
// Esc, Ctrl+Space again, or clicking the background closes it.

import { useActions } from 'kea'
import { useEffect, useRef, useState } from 'react'

import { APPS, APP_LIST, AppId } from './apps'
import { cn } from './cn'
import { AppGlyph } from './GlassIcon'
import { WindowSummary, useWindowSummaries } from './windowSummaries'
import { windowsLogic } from './windowsLogic'

const isToggle = (event: KeyboardEvent): boolean =>
    event.ctrlKey && event.code === 'Space' && !event.altKey && !event.shiftKey && !event.metaKey

export function BenView(): JSX.Element | null {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (isToggle(event)) {
                event.preventDefault()
                setOpen((isOpen) => !isOpen)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return open ? <BenViewOverlay onClose={() => setOpen(false)} /> : null
}

function BenViewOverlay({ onClose }: { onClose: () => void }): JSX.Element {
    const summaries = useWindowSummaries()
    const { focusWindow, closeWindow } = useActions(windowsLogic)
    const [expanded, setExpanded] = useState<AppId | null>(null)
    const gridRef = useRef<HTMLDivElement>(null)

    const groups = APP_LIST.map((app) => ({ appId: app.id, windows: summaries.filter((w) => w.appId === app.id) })).filter(
        (group) => group.windows.length > 0
    )

    // Start on the front window's app (as it was when Ben View opened), so Enter straight away returns
    // to where you were.
    const [frontApp] = useState(() => summaries[0]?.appId)
    useEffect(() => {
        const card = gridRef.current?.querySelector<HTMLElement>(`[data-ben-view-app="${frontApp}"]`)
        ;(card ?? gridRef.current?.querySelector<HTMLElement>('[data-ben-view-card]'))?.focus()
    }, [frontApp])

    // A fanned-out stack starts on its first window.
    useEffect(() => {
        if (expanded) {
            gridRef.current?.querySelector<HTMLElement>(`[data-ben-view-app="${expanded}"]`)?.focus()
        }
    }, [expanded])

    const onKeyDown = (event: React.KeyboardEvent): void => {
        if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
            return
        }
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
        if (!step) {
            return
        }
        event.preventDefault()
        const cards = [...(gridRef.current?.querySelectorAll<HTMLElement>('[data-ben-view-card]') ?? [])]
        const at = cards.indexOf(document.activeElement as HTMLElement)
        cards[Math.min(cards.length - 1, Math.max(0, at + step))]?.focus()
    }

    const choose = (summary: WindowSummary): void => {
        focusWindow(summary.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center" role="dialog" aria-label="Ben View" onKeyDown={onKeyDown}>
            {/* The dim, blurred desktop: beside the cards, not around them, so their own glass still sees
                the windows behind (an ancestor with a blur would cut it off). */}
            <div className="ben-view__backdrop absolute inset-0" onPointerDown={onClose} />
            <div ref={gridRef} className="relative flex flex-wrap items-start justify-center gap-12 max-w-[88vw] max-h-[85vh] p-8 overflow-auto">
                {groups.length === 0 && <p className="m-0 text-sm font-semibold text-white">No windows open</p>}
                {groups.map(({ appId, windows }) =>
                    windows.length > 1 && expanded !== appId ? (
                        <Card
                            key={appId}
                            summary={windows[0]}
                            count={windows.length}
                            onChoose={() => setExpanded(appId)}
                        />
                    ) : (
                        <div key={appId} className={cn('flex flex-wrap justify-center gap-6', windows.length > 1 && 'ben-view__fan')}>
                            {windows.map((summary) => (
                                <Card key={summary.id} summary={summary} onChoose={() => choose(summary)} onCloseWindow={() => closeWindow(summary.id)} />
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

interface CardProps {
    summary: WindowSummary
    /** Set for a stack: how many windows it holds. Clicking it fans the stack out. */
    count?: number
    onChoose: () => void
    /** Offered on single windows only (not on a stack, where it's unclear which window it would close). */
    onCloseWindow?: () => void
}

function Card({ summary, count, onChoose, onCloseWindow }: CardProps): JSX.Element {
    const title = APPS[summary.appId].title
    return (
        <div className="ben-view__card-wrap relative w-60 h-40">
            {count && (
                <>
                    <span className="ben-view__sheet ben-view__sheet--2 desktop-glass absolute inset-0 rounded-2xl" aria-hidden />
                    <span className="ben-view__sheet ben-view__sheet--1 desktop-glass absolute inset-0 rounded-2xl" aria-hidden />
                </>
            )}
            <button
                type="button"
                className="ben-view__card desktop-glass absolute inset-0 flex flex-col gap-1.5 p-4 rounded-2xl text-left"
                onClick={onChoose}
                data-ben-view-card
                data-ben-view-app={summary.appId}
                aria-label={count ? `${title}: ${count} windows. Show them.` : `${summary.title} (${title})`}
            >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
                    <AppGlyph id={summary.appId} className="size-3.5" />
                    {/* Apps whose windows have no title of their own already say their name below. */}
                    {summary.title !== title && title}
                    {count && <span className="desktop-island-count ml-0.5">{count}</span>}
                </span>
                <span className="text-sm font-semibold text-primary line-clamp-3">{summary.title}</span>
                <span className="mt-auto flex items-center gap-2 text-xs text-tertiary">
                    {summary.site && <span className="truncate">{summary.site}</span>}
                    {summary.minimized && <span className="ml-auto shrink-0">Minimised</span>}
                </span>
            </button>
            {onCloseWindow && (
                <button
                    type="button"
                    className="absolute top-2.5 right-2.5 size-6 flex items-center justify-center rounded-full text-tertiary hover:text-primary hover:bg-hover"
                    onClick={onCloseWindow}
                    aria-label={`Close ${summary.title}`}
                    title="Close window"
                >
                    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                        <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                </button>
            )}
        </div>
    )
}
