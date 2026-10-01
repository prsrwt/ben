// Search on Ben Island. At rest it's the small pill in the middle of the bar. Clicking it, or Ctrl+G (easy
// to reach from either Ctrl key) or Ctrl+K, makes the bar drip down into a notch holding a larger field.
// Typing shows results under it (search/useSearch.ts): pages read before, Wikipedia, the web. ↑ ↓ choose,
// Enter opens the chosen one (or the first) in a new Reader window; a pasted link opens directly. Esc,
// clicking elsewhere, or opening something shrinks it back.
//
// It's drawn just above the island rather than inside it: the island's glass would stop the part hanging
// below the bar from blurring the windows beneath. The island keeps an empty space where the pill sits.

import { useActions } from 'kea'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { toArticleUrl } from '~/reader/fetchArticle'
import { readerLogic } from '~/reader/readerLogic'
import { SearchResult } from '~/search/searchSources'
import { useSearch } from '~/search/useSearch'

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
    const [query, setQuery] = useState('')
    const [chosen, setChosen] = useState(0)
    const search = useSearch(open ? query : '')
    const link = toArticleUrl(query)
    const showResults = open && !link && query.trim().length > 0

    const close = (): void => {
        setOpen(false)
        inputRef.current?.blur()
    }

    const openUrl = (url: string): void => {
        openLinkInNewWindow(url)
        // The page now lives in its window; leftover words wouldn't say which one.
        setQuery('')
        close()
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
        // "Search for" in a right-click menu: open the notch with that text typed in.
        const onSearchFor = (event: Event): void => {
            setQuery((event as CustomEvent<string>).detail)
            setChosen(0)
            inputRef.current?.focus()
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('ben:search', onSearchFor)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('ben:search', onSearchFor)
        }
    }, [])

    const onKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === 'Escape') {
            close()
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const count = search.all.length
            if (count > 0) {
                setChosen((i) => (i + (e.key === 'ArrowDown' ? 1 : count - 1)) % count)
            }
        }
    }

    const groups: { label: string; results: SearchResult[] }[] = [
        { label: 'Read before', results: search.history },
        { label: 'Wikipedia', results: search.wikipedia },
        { label: 'Web', results: search.web },
    ]
    let index = 0

    return createPortal(
        <form
            role="search"
            className={cn('island-search', open && 'island-search--open')}
            onSubmit={(e) => {
                e.preventDefault()
                const target = link ?? search.all[Math.min(chosen, search.all.length - 1)]?.url
                if (target) {
                    openUrl(target)
                }
            }}
            onKeyDown={onKeyDown}
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
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setChosen(0)
                    }}
                    placeholder="Search or paste a link"
                    aria-label="Search or paste a link"
                    aria-controls="island-search-results"
                    className="flex-1 min-w-0 bg-transparent outline-none text-primary placeholder:text-tertiary"
                    onFocus={() => setOpen(true)}
                    // Clicking a result must land before the notch closes.
                    onBlur={(e) => !e.currentTarget.form?.contains(e.relatedTarget) && setOpen(false)}
                    data-attr="island-search"
                />
                <kbd className="island-search__key hidden sm:block text-xxs text-tertiary font-sans">Ctrl G</kbd>
            </label>
            {showResults ? (
                <div id="island-search-results" className="island-search__results" role="listbox">
                    {groups.map(({ label, results }) =>
                        results.length === 0 ? null : (
                            <section key={label}>
                                <h5 className="island-search__group">{label}</h5>
                                {results.map((result) => {
                                    const i = index++
                                    return (
                                        <button
                                            key={result.url}
                                            type="button"
                                            role="option"
                                            aria-selected={i === chosen}
                                            tabIndex={-1}
                                            className={cn('island-search__result', i === chosen && 'island-search__result--chosen')}
                                            onMouseEnter={() => setChosen(i)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => openUrl(result.url)}
                                        >
                                            <span className="min-w-0 truncate">{result.title}</span>
                                            <span className="ml-auto shrink-0 text-xs text-tertiary">{result.site}</span>
                                        </button>
                                    )
                                })}
                            </section>
                        )
                    )}
                    {search.loading && <p className="island-search__status">Searching…</p>}
                    {!search.loading && search.all.length === 0 && <p className="island-search__status">No results</p>}
                </div>
            ) : (
                <p className="island-search__hint m-0 text-xs text-secondary">
                    Type to search, or paste a link. ↑ ↓ to choose, Enter to open, Esc to close.
                </p>
            )}
        </form>,
        document.body
    )
}
