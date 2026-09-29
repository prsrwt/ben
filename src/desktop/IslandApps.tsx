// The apps pill on Ben Island, just left of the search bar: one icon per app with open windows (in desktop
// order), a small count on top when it has more than one, and the front window's app highlighted.
// Clicking an icon lists that app's windows, front-most first; for the Reader also the last few pages
// read that aren't open, and "Show all history". Hidden while no window is open.

import { useActions, useValues } from 'kea'
import { useEffect, useRef, useState } from 'react'

import { historyLogic } from '~/history/historyLogic'
import { readerLogic } from '~/reader/readerLogic'

import { APPS, APP_LIST, AppId } from './apps'
import { cn } from './cn'
import { AppGlyph } from './GlassIcon'
import { PopoverFrame } from './ThemeMenu'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import { WindowSummary, useWindowSummaries } from './windowSummaries'
import { windowsLogic } from './windowsLogic'

/** How many pages read (and not open) the Reader's list offers before "Show all history". */
const RECENTLY_READ = 5

type ListItem =
    | { kind: 'window'; window: WindowSummary }
    | { kind: 'read'; url: string; title: string }
    | { kind: 'history' }

export function IslandApps(): JSX.Element | null {
    const summaries = useWindowSummaries()
    const { focusedWindow } = useValues(windowsLogic)
    const [openFor, setOpenFor] = useState<AppId | null>(null)

    const apps = APP_LIST.filter((app) => summaries.some((w) => w.appId === app.id)).map((app) => app.id)
    if (apps.length === 0) {
        return null
    }
    return (
        <div className="desktop-island-pill flex items-center gap-0.5 h-7 px-0.5 rounded-full" role="toolbar" aria-label="Open apps">
            {apps.map((appId) => (
                <AppButton
                    key={appId}
                    appId={appId}
                    windows={summaries.filter((w) => w.appId === appId)}
                    isFront={focusedWindow?.appId === appId}
                    open={openFor === appId}
                    setOpen={(open) => setOpenFor(open ? appId : null)}
                />
            ))}
        </div>
    )
}

interface AppButtonProps {
    appId: AppId
    windows: WindowSummary[]
    isFront: boolean
    open: boolean
    setOpen: (open: boolean) => void
}

function AppButton(props: AppButtonProps): JSX.Element {
    const { entries } = useValues(historyLogic)
    let items: ListItem[] = props.windows.map((window) => ({ kind: 'window', window }))
    if (props.appId === 'reader') {
        const openUrls = new Set(props.windows.flatMap((w) => w.urls))
        const read: ListItem[] = entries
            .filter((entry) => !openUrls.has(entry.url))
            .slice(0, RECENTLY_READ)
            .map((entry) => ({ kind: 'read', url: entry.url, title: entry.title }))
        items = [...items, ...read, { kind: 'history' }]
    }
    // Rebuilt when the number of entries changes: PostHog's keyboard hook sizes its list once.
    return <AppButtonWithMenu key={items.length} {...props} items={items} />
}

function AppButtonWithMenu({ appId, windows, isFront, open, setOpen, items }: AppButtonProps & { items: ListItem[] }): JSX.Element {
    const { focusWindow, openApp } = useActions(windowsLogic)
    const { openLinkInNewWindow } = useActions(readerLogic)
    const rootRef = useRef<HTMLDivElement>(null)
    const { referenceRef, itemsRef } = useKeyboardNavigation<HTMLButtonElement, HTMLButtonElement>(items.length, -1, {
        enabled: open,
    })
    const title = APPS[appId].title

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
    }, [open, setOpen])

    const choose = (item: ListItem): void => {
        setOpen(false)
        if (item.kind === 'window') {
            focusWindow(item.window.id)
        } else if (item.kind === 'read') {
            openLinkInNewWindow(item.url)
        } else {
            openApp('history')
        }
    }

    const row = (item: ListItem, index: number): JSX.Element => (
        <li key={item.kind === 'window' ? item.window.id : item.kind === 'read' ? item.url : 'history'}>
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
                        <span className="min-w-0 truncate">
                            {item.kind === 'history' ? 'Show all history' : item.kind === 'read' ? item.title : item.window.title}
                        </span>
                        {item.kind === 'window' && item.window.minimized && (
                            <span className="ml-auto shrink-0 text-xs text-tertiary">Minimised</span>
                        )}
                    </span>
                </span>
            </button>
        </li>
    )
    const section = (heading: string | null, kind: ListItem['kind']): JSX.Element | null =>
        items.some((item) => item.kind === kind) ? (
            <li className={cn(kind === 'history' && 'mt-1 pt-1 border-t border-subtle')}>
                <section>
                    {heading && <h5>{heading}</h5>}
                    <ul>{items.map((item, index) => (item.kind === kind ? row(item, index) : null))}</ul>
                </section>
            </li>
        ) : null

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={referenceRef}
                type="button"
                className={cn(
                    'relative size-6 flex items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-hover',
                    (isFront || open) && 'text-primary bg-hover'
                )}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${title}: ${windows.length} open`}
                title={title}
                onClick={() => setOpen(!open)}
                data-attr={`island-app-${appId}`}
            >
                <AppGlyph id={appId} className="size-4" />
                {windows.length > 1 && (
                    <span className="desktop-island-count absolute -top-1.5 -right-1.5" aria-hidden>
                        {windows.length}
                    </span>
                )}
            </button>
            {open && (
                <PopoverFrame>
                    <div className="Popover__box w-80">
                        <div className="Popover__content" role="menu" aria-label={title}>
                            <ul>
                                {section('Open', 'window')}
                                {section('Recently read', 'read')}
                                {section(null, 'history')}
                            </ul>
                        </div>
                    </div>
                </PopoverFrame>
            )}
        </div>
    )
}
