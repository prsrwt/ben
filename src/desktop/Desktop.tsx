// The whole app: background, Ben Island (the top bar), icon columns, optional decorative scene, and open windows on top.

import './desktop.css'

import { useValues } from 'kea'
import { useEffect, useState } from 'react'

import { EyeBreak } from '~/newspaper/EyeBreak'

import { APP_LIST } from './apps'
import { DESKTOP_ASSETS, useImageAvailable } from './assets'
import { cn } from './cn'
import { DesktopIcon } from './DesktopIcon'
import { BenIsland } from './BenIsland'
import { BenView } from './BenView'
import { Window } from './Window'
import { WindowContent } from './windowContent'
import { DESKTOP_TOP, byOpeningOrder, windowsLogic } from './windowsLogic'

/** Below this width windows go full screen and icons form a grid. */
const NARROW_QUERY = '(max-width: 767px)'

/** Whether the app is narrower than a tablet, kept up to date as the window is resized. */
function useIsNarrow(): boolean {
    const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
    useEffect(() => {
        const query = window.matchMedia(NARROW_QUERY)
        const onChange = (event: MediaQueryListEvent): void => setNarrow(event.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])
    return narrow
}

const LEFT_APPS = APP_LIST.filter((app) => app.side === 'left')
const RIGHT_APPS = APP_LIST.filter((app) => app.side === 'right')

/** Your optional illustration in the bottom-right corner (public/desktop/scene.png); nothing otherwise. */
function SceneSlot(): JSX.Element | null {
    const hasScene = useImageAvailable(DESKTOP_ASSETS.scene)
    return hasScene ? (
        <img
            src={DESKTOP_ASSETS.scene}
            alt=""
            className="absolute bottom-0 right-0 w-[min(40vw,640px)] h-auto pointer-events-none select-none"
        />
    ) : null
}

export function Desktop(): JSX.Element {
    const { windows, focusedId } = useValues(windowsLogic)
    const hasBackground = useImageAvailable(DESKTOP_ASSETS.background)
    const isMobile = useIsNarrow()

    return (
        <div
            className={cn('desktop fixed inset-0 overflow-hidden', !hasBackground && 'desktop--placeholder-bg')}
            style={hasBackground ? { backgroundImage: `url(${DESKTOP_ASSETS.background})` } : undefined}
        >
            <BenIsland />

            {!isMobile && <SceneSlot />}

            {isMobile ? (
                <div
                    className="absolute inset-x-0 bottom-0 overflow-y-auto grid grid-cols-4 gap-2 p-3 content-start justify-items-center"
                    style={{ top: DESKTOP_TOP }}
                >
                    {[...LEFT_APPS, ...RIGHT_APPS].map((app) => (
                        <DesktopIcon key={app.id} app={app} />
                    ))}
                </div>
            ) : (
                <>
                    <nav
                        aria-label="Desktop shortcuts"
                        className="absolute left-2 flex flex-col gap-2"
                        style={{ top: DESKTOP_TOP + 16 }}
                    >
                        {LEFT_APPS.map((app) => (
                            <DesktopIcon key={app.id} app={app} />
                        ))}
                    </nav>
                    {RIGHT_APPS.length > 0 && (
                        <nav
                            aria-label="More shortcuts"
                            className="absolute right-2 flex flex-col gap-2"
                            style={{ top: DESKTOP_TOP + 16 }}
                        >
                            {RIGHT_APPS.map((app) => (
                                <DesktopIcon key={app.id} app={app} />
                            ))}
                        </nav>
                    )}
                </>
            )}

            {/* Drawn in the order they were opened, with only their stacking number following the front-to-back
                order: bringing a window forward then never moves it on the page, which would restart its opening
                animation (a bounce) and lose the click that brought it forward. */}
            {[...windows].sort(byOpeningOrder).map((state) => (
                <Window
                    key={state.id}
                    state={state}
                    zIndex={10 + windows.indexOf(state)}
                    isFocused={state.id === focusedId}
                    isMobile={isMobile}
                >
                    <WindowContent window={state} />
                </Window>
            ))}

            {/* Ctrl+Space: every open window as cards, over everything else. */}
            <BenView />

            {/* The 20-20-20 reminder to rest the eyes, when turned on in the Newspaper's "Aa" menu. */}
            <EyeBreak />
        </div>
    )
}
