// Ben Island: the only bar in the app, stretched across the top edge like the macOS menu bar.
// The name "Ben" on the left, the search bar in the middle, and the theme menu plus traffic lights
// (window controls) on the right, where Windows users expect them. The window has no Windows title bar and no tabs.
// Empty space on the bar drags the whole app window and double-clicking it maximises (Tauri's
// `data-tauri-drag-region`, which only reacts to presses on the bar itself, not on its contents).

import { useActions } from 'kea'
import { useEffect, useRef } from 'react'

import { APP_NAME } from '~/appConfig'
import { toArticleUrl } from '~/reader/fetchArticle'
import { readerLogic } from '~/reader/readerLogic'

import { IconSearch } from './icons'
import { IS_DESKTOP_APP, appWindow } from './nativeWindow'
import { ThemeMenu } from './ThemeMenu'
import { TrafficLights } from './TrafficLights'
import { MENU_BAR_HEIGHT } from './windowsLogic'

function SearchBar(): JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null)
    const { openLink } = useActions(readerLogic)

    // Ctrl+K (⌘K on a Mac) jumps to the search bar from anywhere.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                inputRef.current?.focus()
                inputRef.current?.select()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        // Submitting a link opens it in the Reader. Anything else does nothing yet (search comes later).
        <form
            role="search"
            className="w-full"
            onSubmit={(e) => {
                e.preventDefault()
                const url = toArticleUrl(inputRef.current?.value ?? '')
                if (url && inputRef.current) {
                    openLink(url)
                    // The link now lives in its window; a leftover address wouldn't say which one.
                    inputRef.current.value = ''
                    inputRef.current.blur()
                }
            }}
        >
            <label className="desktop-searchbar flex items-center gap-1.5 h-6 px-3 rounded-full text-xs">
                <IconSearch className="size-3 shrink-0 text-tertiary" />
                <input
                    ref={inputRef}
                    type="search"
                    placeholder="Search or paste a link"
                    aria-label="Search or paste a link"
                    className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-tertiary"
                    data-attr="island-search"
                />
                <kbd className="hidden sm:block text-xxs text-tertiary font-sans">Ctrl K</kbd>
            </label>
        </form>
    )
}

export function BenIsland(): JSX.Element {
    return (
        <header
            data-tauri-drag-region
            aria-label={`${APP_NAME} Island`}
            className="ben-island fixed top-0 inset-x-0 z-[1000] flex items-center gap-4 px-3.5 select-none"
            style={{ height: MENU_BAR_HEIGHT }}
        >
            {/* Icon + name. pointer-events-none lets presses fall through to the bar, so grabbing
                them drags the window like the rest of the island. */}
            <span className="flex items-center gap-2 pointer-events-none">
                <img src="/ben-icon.png" alt="" className="size-5 rounded-[5px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.2)]" />
                <span className="text-[13px] font-bold tracking-tight text-primary">{APP_NAME}</span>
            </span>

            {/* Centred on the bar regardless of what sits either side of it. */}
            <div className="absolute left-1/2 -translate-x-1/2 w-[min(340px,30%)]">
                <SearchBar />
            </div>

            <div className="ml-auto flex items-center gap-3">
                <ThemeMenu />
                {/* The traffic lights only work inside the desktop app, so they're hidden in a browser tab. */}
                {IS_DESKTOP_APP && (
                    <TrafficLights
                        label="Ben window"
                        onMinimise={() => void appWindow().minimize()}
                        onMaximise={() => void appWindow().toggleMaximize()}
                        onClose={() => void appWindow().close()}
                    />
                )}
            </div>
        </header>
    )
}
