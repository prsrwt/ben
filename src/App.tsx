// Root component: the desktop.

import { useMountedLogic } from 'kea'

import { Desktop } from '~/desktop/Desktop'
import { useNoBrowserMenu } from '~/desktop/useNoBrowserMenu'
import { themeLogic } from '~/desktop/themeLogic'
import { windowsLogic } from '~/desktop/windowsLogic'
import { historyLogic } from '~/history/historyLogic'
import { readerLogic } from '~/reader/readerLogic'

export function App(): JSX.Element {
    // Mounted for the whole session: open windows, and the theme's live "follow Windows" listener.
    useMountedLogic(windowsLogic)
    useMountedLogic(themeLogic)
    // The Reader's article, which links from the search bar open even before its window exists.
    useMountedLogic(readerLogic)
    // Reading history, recorded whether or not its window is open.
    useMountedLogic(historyLogic)
    // Ben's own right-click menus only: the browser's would offer Reload, which wipes every open window.
    useNoBrowserMenu()

    return <Desktop />
}
