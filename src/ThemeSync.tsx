// Applies the active theme to <body>: styles.css and desktop.css switch to dark on [theme="dark"].

import { useValues } from 'kea'
import { useEffect } from 'react'

import { themeLogic } from '~/desktop/themeLogic'

export function ThemeSync(): null {
    const { isDark } = useValues(themeLogic)

    useEffect(() => {
        document.body.setAttribute('theme', isDark ? 'dark' : 'light')
    }, [isDark])

    return null
}
