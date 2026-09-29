// Root component: the desktop.

import { useMountedLogic } from 'kea'

import { Desktop } from '~/desktop/Desktop'
import { themeLogic } from '~/desktop/themeLogic'
import { windowsLogic } from '~/desktop/windowsLogic'

export function App(): JSX.Element {
    // Mounted for the whole session: open windows, and the theme's live "follow Windows" listener.
    useMountedLogic(windowsLogic)
    useMountedLogic(themeLogic)

    return <Desktop />
}
