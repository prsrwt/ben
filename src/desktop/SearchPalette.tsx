// Search, Raycast / Spotlight style: Ctrl+G (or Ctrl+K, or clicking the pill on Ben Island) brings a large
// search box to the middle of the screen, over everything. A link opens in a new Reader window; plain text
// does nothing yet (searching comes later), which the hint under the box says. Esc, a click outside, or the
// shortcut again closes it.

import { useActions } from 'kea'
import { useEffect, useRef, useState } from 'react'

import { toArticleUrl } from '~/reader/fetchArticle'
import { readerLogic } from '~/reader/readerLogic'

import { IconSearch } from './icons'

/** Ctrl+G (easy to reach from either Ctrl key), and Ctrl+K as before. ⌘ on a Mac. */
const isShortcut = (event: KeyboardEvent): boolean =>
    (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && ['g', 'k'].includes(event.key.toLowerCase())

/** The pill on Ben Island, and the box it opens. */
export function SearchPill(): JSX.Element {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (isShortcut(event)) {
                // Also stops the browser engine's own Ctrl+G ("find next").
                event.preventDefault()
                setOpen((isOpen) => !isOpen)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        <>
            <button
                type="button"
                className="desktop-searchbar w-full flex items-center gap-1.5 h-6 px-3 rounded-full text-xs text-tertiary cursor-default"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                data-attr="island-search"
            >
                <IconSearch className="size-3 shrink-0" />
                <span className="flex-1 min-w-0 text-left truncate">Search or paste a link</span>
                <kbd className="hidden sm:block text-xxs font-sans">Ctrl G</kbd>
            </button>
            {open && <SearchPalette onClose={() => setOpen(false)} />}
        </>
    )
}

function SearchPalette({ onClose }: { onClose: () => void }): JSX.Element {
    const { openLinkInNewWindow } = useActions(readerLogic)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    return (
        <div
            className="fixed inset-0 z-[1300]"
            onPointerDown={(e) => e.target === e.currentTarget && onClose()}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            role="dialog"
            aria-label="Search"
        >
            <form
                role="search"
                className="search-palette absolute left-1/2 top-[22vh] w-[min(680px,90vw)] -translate-x-1/2 rounded-2xl"
                onSubmit={(e) => {
                    e.preventDefault()
                    const url = toArticleUrl(inputRef.current?.value ?? '')
                    if (url) {
                        openLinkInNewWindow(url)
                        onClose()
                    }
                }}
            >
                <label className="flex items-center gap-3.5 h-16 px-6">
                    <IconSearch className="size-6 shrink-0 text-secondary" />
                    <input
                        ref={inputRef}
                        type="search"
                        placeholder="Search or paste a link"
                        aria-label="Search or paste a link"
                        className="flex-1 min-w-0 bg-transparent outline-none text-xl font-medium text-primary placeholder:text-tertiary placeholder:font-normal"
                        data-attr="search-palette-input"
                    />
                </label>
                <p className="m-0 px-6 py-2.5 border-t border-subtle text-xs text-secondary">
                    Paste a link and press Enter to read it. Searching the web comes later. Esc closes.
                </p>
            </form>
        </div>
    )
}
