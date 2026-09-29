// The Reader's Contents pill on Ben Island: the contents icon and the section being read (the article's
// title at the start). Clicking it lists the article's title, its sections (sub-sections indented) and
// Details, each with the page it starts on, the section being read highlighted. Choosing one turns to it.
// Same look and arrow keys as Ben's other menus; closes on a choice, a click anywhere else, or Escape.

import { useEffect, useRef, useState } from 'react'

import { cn } from '~/desktop/cn'
import { PopoverFrame } from '~/desktop/ThemeMenu'
import { useKeyboardNavigation } from '~/desktop/useKeyboardNavigation'
import { WindowId } from '~/desktop/windowsLogic'

import { openBook, useCurrentSection } from './openBooks'

/** A small list icon, drawn inline. */
function IconContents(): JSX.Element {
    return (
        <svg viewBox="0 0 16 16" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M6 4h7M6 8h7M6 12h7" />
            <circle cx="3" cy="4" r="0.4" fill="currentColor" />
            <circle cx="3" cy="8" r="0.4" fill="currentColor" />
            <circle cx="3" cy="12" r="0.4" fill="currentColor" />
        </svg>
    )
}

export function ContentsButton({ windowId, enabled }: { windowId: WindowId; enabled: boolean }): JSX.Element {
    const section = useCurrentSection(windowId)
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

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

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                className="desktop-island-pill flex items-center gap-1.5 h-7 pl-2.5 pr-3.5 rounded-full text-xs text-secondary enabled:hover:text-primary disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-current"
                onClick={() => setOpen((isOpen) => !isOpen)}
                disabled={!enabled}
                aria-haspopup="menu"
                aria-expanded={open}
                title="Contents"
                aria-label={section ? `Contents: reading ${section}` : 'Contents'}
                data-attr="reader-contents"
            >
                <IconContents />
                {section && <span className="max-w-[min(220px,16vw)] truncate font-semibold">{section}</span>}
            </button>
            {open && <ContentsList windowId={windowId} onClose={() => setOpen(false)} />}
        </div>
    )
}

function ContentsList({ windowId, onClose }: { windowId: WindowId; onClose: () => void }): JSX.Element {
    // Worked out once, as the menu opens: pages as they are laid out now.
    const [entries] = useState(() => openBook(windowId)?.contents() ?? [])
    const current = Math.max(0, entries.findIndex((entry) => entry.current))
    const { itemsRef } = useKeyboardNavigation<HTMLButtonElement, HTMLButtonElement>(entries.length, current)

    // Start on the section being read, scrolled into view in a long list, so the arrow keys work at once.
    useEffect(() => {
        itemsRef.current?.[current]?.current?.focus()
    }, [itemsRef, current])

    return (
        <PopoverFrame>
            <div className="Popover__box w-80">
                <div className="Popover__content max-h-[min(70vh,520px)] overflow-y-auto" role="menu" aria-label="Contents">
                    <ul>
                        <li>
                            <section>
                                <h5>Contents</h5>
                                {entries.length === 0 && <p className="m-0 px-2 py-1 text-sm text-tertiary">No sections</p>}
                                <ul>
                                    {entries.map((entry, index) => (
                                        <li key={index}>
                                            <button
                                                ref={itemsRef.current?.[index]}
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                    onClose()
                                                    openBook(windowId)?.goTo(index)
                                                }}
                                                className={cn(
                                                    'LemonButton LemonButton--tertiary LemonButton--small LemonButton--full-width',
                                                    entry.current && 'LemonButton--active'
                                                )}
                                            >
                                                <span className="LemonButton__chrome">
                                                    <span className="LemonButton__content gap-3" style={{ paddingLeft: entry.depth * 14 }}>
                                                        <span className={cn('min-w-0 truncate', entry.depth === 0 && 'font-semibold')}>{entry.title}</span>
                                                        <span className="ml-auto shrink-0 text-xs tabular-nums text-tertiary">{entry.page + 1}</span>
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        </li>
                    </ul>
                </div>
            </div>
        </PopoverFrame>
    )
}
