// Ben Island: the only bar in the app, stretched across the top edge like the macOS menu bar.
// The name "Ben" on the left, the search bar in the middle, and the theme menu plus traffic lights
// (window controls) on the right, where Windows users expect them. The window has no Windows title bar and no tabs.
// Empty space on the bar drags the whole app window and double-clicking it maximises (Tauri's
// `data-tauri-drag-region`, which only reacts to presses on the bar itself, not on its contents).

import { useValues } from 'kea'

import { APP_NAME } from '~/appConfig'
import { ReaderIslandOptions } from '~/reader/ReaderIslandOptions'

import { IS_DESKTOP_APP, appWindow } from './nativeWindow'
import { ThemeMenu } from './ThemeMenu'
import { TrafficLights } from './TrafficLights'
import { IslandApps } from './IslandApps'
import { IslandSearch, IslandSearchSpace } from './SearchPalette'
import { MENU_BAR_HEIGHT, windowsLogic } from './windowsLogic'

export function BenIsland(): JSX.Element {
    const { focusedWindow } = useValues(windowsLogic)

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

            {/* The apps pill, just left of the search bar (whose half-width is min(170px, 15%)). Hidden on
                narrow screens, where there's no room beside the search bar. */}
            <div className="absolute right-[calc(50%+min(170px,15%)+8px)] hidden sm:block">
                <IslandApps />
            </div>

            {/* Centred on the bar regardless of what sits either side of it. */}
            <div className="absolute left-1/2 -translate-x-1/2 w-[min(340px,30%)]">
                <IslandSearchSpace />
                <IslandSearch />
            </div>

            {/* Options for the app in front, just right of the search bar (whose half-width is min(170px, 15%)). */}
            <div className="absolute left-[calc(50%+min(170px,15%)+8px)]">
                {focusedWindow?.appId === 'reader' && <ReaderIslandOptions windowId={focusedWindow.id} />}
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
