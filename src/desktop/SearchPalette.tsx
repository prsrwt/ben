// Search on Ben Island. At rest it's the small pill in the middle of the bar. Clicking it, or Ctrl+G (easy
// to reach from either Ctrl key) or Ctrl+K, makes it grow: it widens and drops down out of the bar, the bar
// curving down around it, with the field and its text larger. Esc, clicking elsewhere, or opening a link
// shrinks it back. A link opens in a new Reader window; plain text does nothing yet (searching comes later).
//
// It's drawn just above the island rather than inside it: the island's glass would stop the part hanging
// below the bar from blurring the windows beneath. The island keeps an empty space where the pill sits.

import { useActions } from 'kea'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { toArticleUrl } from '~/reader/fetchArticle'
import { readerLogic } from '~/reader/readerLogic'

import { cn } from './cn'
import { IconSearch } from './icons'

/** Ctrl (⌘ on a Mac) plus a letter, and nothing else held. */
const isCtrlKey = (event: KeyboardEvent, letter: string): boolean =>
    (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === letter

/** The pill's place on the island: keeps the space, while the search itself floats above. */
export function IslandSearchSpace(): JSX.Element {
    return <div className="h-7 w-full" aria-hidden />
}

export function IslandSearch(): JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null)
    const { openLinkInNewWindow } = useActions(readerLogic)
    const [open, setOpen] = useState(false)

    const close = (): void => {
        setOpen(false)
        inputRef.current?.blur()
    }

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (isCtrlKey(event, 'g') || isCtrlKey(event, 'k')) {
                // Also stops the browser engine's own Ctrl+G ("find next").
                event.preventDefault()
                inputRef.current?.focus()
                inputRef.current?.select()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return createPortal(
        <form
            role="search"
            className={cn('island-search', open && 'island-search--open')}
            onSubmit={(e) => {
                e.preventDefault()
                const url = toArticleUrl(inputRef.current?.value ?? '')
                if (url && inputRef.current) {
                    openLinkInNewWindow(url)
                    // The link now lives in its window; a leftover address wouldn't say which one.
                    inputRef.current.value = ''
                    close()
                }
            }}
            onKeyDown={(e) => e.key === 'Escape' && close()}
        >
            {/* The notch dropping out of the bar: glass below the bar only, curving into it at both sides. */}
            <span className="island-search__drop" aria-hidden />
            <span className="island-search__shoulder island-search__shoulder--left" aria-hidden />
            <span className="island-search__shoulder island-search__shoulder--right" aria-hidden />
            <label className="island-search__field">
                <IconSearch className="island-search__icon shrink-0 text-tertiary" />
                <input
                    ref={inputRef}
                    type="search"
                    placeholder="Search or paste a link"
                    aria-label="Search or paste a link"
                    className="flex-1 min-w-0 bg-transparent outline-none text-primary placeholder:text-tertiary"
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    data-attr="island-search"
                />
                <kbd className="island-search__key hidden sm:block text-xxs text-tertiary font-sans">Ctrl G</kbd>
            </label>
            <p className="island-search__hint m-0 text-xs text-secondary">
                Paste a link and press Enter to read it. Searching the web comes later. Esc closes.
            </p>
        </form>,
        document.body
    )
}
