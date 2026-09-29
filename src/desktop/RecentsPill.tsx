// The recents pill on Ben Island, just left of the search bar: one app at a time ("Reader · 3").
// Scrolling over it switches app (only apps with open windows, one per wheel notch; scrolling never opens
// anything). Clicking lists that app's windows, front-most first; for the Reader also the last few pages
// read that aren't open, and "Show all history". Hidden while no window is open.

import { useActions, useValues } from 'kea'
import { useEffect, useRef, useState } from 'react'

import { historyLogic } from '~/history/historyLogic'
import { readerLogic, readerWindowState } from '~/reader/readerLogic'

import { APPS, APP_LIST, AppId } from './apps'
import { AppGlyph } from './GlassIcon'
import { PopoverFrame } from './ThemeMenu'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { WindowId, windowsLogic } from './windowsLogic'

/** How many pages read (and not open) the Reader's list offers before "Show all history". */
const RECENTLY_READ = 5

type RecentItem =
    | { kind: 'window'; id: WindowId; title: string; minimized: boolean }
    | { kind: 'read'; url: string; title: string }
    | { kind: 'history' }

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** What the pill lists for an app. */
function useRecentItems(appId: AppId): RecentItem[] {
    const { windows } = useValues(windowsLogic)
    const { histories } = useValues(readerLogic)
    const { entries } = useValues(historyLogic)

    const open: RecentItem[] = windows
        .filter((w) => w.appId === appId)
        .reverse()
        .map((w) => {
            if (appId !== 'reader') {
                return { kind: 'window', id: w.id, title: APPS[appId].title, minimized: w.minimized }
            }
            const { current } = readerWindowState(histories, w.id)
            const title = !current
                ? 'Empty Reader'
                : current.article?.title ?? (current.status === 'failed' ? `Couldn't open ${hostOf(current.url)}` : `Opening ${hostOf(current.url)}…`)
            return { kind: 'window', id: w.id, title, minimized: w.minimized }
        })
    if (appId !== 'reader') {
        return open
    }
    const openUrls = new Set(
        windows.flatMap((w) => {
            const { current } = readerWindowState(histories, w.id)
            return current ? [current.url, current.article?.url] : []
        })
    )
    const read: RecentItem[] = entries
        .filter((entry) => !openUrls.has(entry.url))
        .slice(0, RECENTLY_READ)
        .map((entry) => ({ kind: 'read', url: entry.url, title: entry.title }))
    return [...open, ...read, { kind: 'history' }]
}

export function RecentsPill(): JSX.Element | null {
    const { windows, focusedWindow } = useValues(windowsLogic)
    // The app scrolled to, and which window was in front then: once another window comes to the front,
    // the pill follows that window's app again.
    const [choice, setChoice] = useState<{ appId: AppId; frontId: WindowId | null } | null>(null)
    const frontId = focusedWindow?.id ?? null

    const apps = APP_LIST.map((app) => app.id).filter((id) => windows.some((w) => w.appId === id))
    const chosen = choice?.frontId === frontId && apps.includes(choice.appId) ? choice.appId : null
    const appId = chosen ?? focusedWindow?.appId ?? windows.at(-1)?.appId
    if (!appId) {
        return null
    }

    const step = (direction: 1 | -1): void => {
        const next = apps[apps.indexOf(appId) + direction]
        if (next) {
            setChoice({ appId: next, frontId })
        }
    }
    return <Pill key={appId} appId={appId} onStep={step} />
}

function Pill({ appId, onStep }: { appId: AppId; onStep: (direction: 1 | -1) => void }): JSX.Element {
    const items = useRecentItems(appId)
    // Rebuilt when the number of entries changes: PostHog's keyboard hook sizes its list once.
    return <PillWithMenu key={items.length} appId={appId} items={items} onStep={onStep} />
}

function PillWithMenu({ appId, items, onStep }: { appId: AppId; items: RecentItem[]; onStep: (direction: 1 | -1) => void }): JSX.Element {
    const { windows } = useValues(windowsLogic)
    const { focusWindow, openApp } = useActions(windowsLogic)
    const { openLinkInNewWindow } = useActions(readerLogic)
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const wheel = useRef({ total: 0, lastEvent: 0, lastStep: 0 })
    const { referenceRef, itemsRef } = useKeyboardNavigation<HTMLButtonElement, HTMLButtonElement>(items.length, -1, {
        enabled: open,
    })
    const count = windows.filter((w) => w.appId === appId).length

    useEffect(() => {
        if (!open) {
            return
        }
        const onPointerDown = (event: PointerEvent): void => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    // A mouse wheel notch arrives as one large step: switch at once. A touchpad sends a stream of small
    // ones: add them up, and after a switch wait for the swipe to die down, so one swipe moves one app.
    const onWheel = (event: React.WheelEvent): void => {
        const now = performance.now()
        const w = wheel.current
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
        if (now - w.lastEvent > 400) {
            w.total = 0
        }
        w.lastEvent = now
        if (Math.abs(delta) >= 50) {
            onStep(delta > 0 ? 1 : -1)
            return
        }
        if (now - w.lastStep < 300) {
            return
        }
        w.total += delta
        if (Math.abs(w.total) >= 120) {
            onStep(w.total > 0 ? 1 : -1)
            w.total = 0
            w.lastStep = now
        }
    }

    const choose = (item: RecentItem): void => {
        setOpen(false)
        if (item.kind === 'window') {
            focusWindow(item.id)
        } else if (item.kind === 'read') {
            openLinkInNewWindow(item.url)
        } else {
            openApp('history')
        }
    }

    const firstRead = items.findIndex((item) => item.kind === 'read')
    const historyIndex = items.findIndex((item) => item.kind === 'history')
    const button = (item: RecentItem, index: number): JSX.Element => (
        <li key={item.kind === 'window' ? item.id : item.kind === 'read' ? item.url : 'history'}>
            <button
                ref={itemsRef.current?.[index]}
                type="button"
                role="menuitem"
                onClick={() => choose(item)}
                className="LemonButton LemonButton--tertiary LemonButton--small LemonButton--full-width"
            >
                <span className="LemonButton__chrome">
                    {item.kind === 'history' && (
                        <span className="LemonButton__icon">
                            <AppGlyph id="history" className="size-4 opacity-70" />
                        </span>
                    )}
                    <span className="LemonButton__content gap-3">
                        <span className="min-w-0 truncate">{item.kind === 'history' ? 'Show all history' : item.title}</span>
                        {item.kind === 'window' && item.minimized && (
                            <span className="ml-auto shrink-0 text-xs text-tertiary">Minimised</span>
                        )}
                    </span>
                </span>
            </button>
        </li>
    )

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={referenceRef}
                type="button"
                className="desktop-island-pill flex items-center gap-1.5 h-6 pl-2.5 pr-3 rounded-full text-xs text-secondary hover:text-primary"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${APPS[appId].title}: ${count} open. Scroll to switch app.`}
                title="Click to list windows · scroll to switch app"
                onClick={() => setOpen((isOpen) => !isOpen)}
                onWheel={onWheel}
                data-attr="island-recents"
            >
                <AppGlyph id={appId} className="size-3.5" />
                <span className="font-semibold">{APPS[appId].title}</span>
                <span className="text-tertiary">· {count}</span>
            </button>
            {open && (
                <PopoverFrame>
                    <div className="Popover__box w-80">
                        <div className="Popover__content" role="menu" aria-label={APPS[appId].title}>
                            <ul>
                                <li>
                                    <section>
                                        <h5>Open</h5>
                                        <ul>{items.map((item, index) => (item.kind === 'window' ? button(item, index) : null))}</ul>
                                    </section>
                                </li>
                                {firstRead > -1 && (
                                    <li>
                                        <section>
                                            <h5>Recently read</h5>
                                            <ul>{items.map((item, index) => (item.kind === 'read' ? button(item, index) : null))}</ul>
                                        </section>
                                    </li>
                                )}
                                {historyIndex > -1 && (
                                    <li className="mt-1 pt-1 border-t border-subtle">
                                        <ul>{button(items[historyIndex], historyIndex)}</ul>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                </PopoverFrame>
            )}
        </div>
    )
}
