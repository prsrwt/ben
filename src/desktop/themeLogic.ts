// Light / dark / follow-the-system theme. The choice is remembered in localStorage; "system"
// follows Windows' own setting live. ThemeSync applies the result to <body>.

import { MakeLogicType, actions, afterMount, beforeUnmount, kea, path, reducers, selectors } from 'kea'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ben.theme'
const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)')

/** Where Ben kept the theme before it was slimmed down: PostHog's userLogic, persisted by
 *  kea-localstorage as a JSON user object with a `theme_mode` field. Read once, then carried over. */
const LEGACY_STORAGE_KEY = 'scenes.userLogic.user'

const isThemeMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark' || value === 'system'

function storedMode(): ThemeMode {
    try {
        const value = localStorage.getItem(STORAGE_KEY)
        if (isThemeMode(value)) {
            return value
        }
        // No choice under the new key yet: keep the one made before, so nobody's theme resets.
        const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null') as { theme_mode?: unknown } | null
        if (isThemeMode(legacy?.theme_mode)) {
            localStorage.setItem(STORAGE_KEY, legacy.theme_mode)
            return legacy.theme_mode
        }
    } catch {
        // Storage unavailable, or the old value isn't valid JSON: fall back to the default.
    }
    return 'system'
}

export interface themeLogicValues {
    themeMode: ThemeMode
    systemIsDark: boolean
    isDark: boolean
}

export interface themeLogicActions {
    setThemeMode: (mode: ThemeMode) => { mode: ThemeMode }
    setSystemIsDark: (dark: boolean) => { dark: boolean }
}

export type themeLogicType = MakeLogicType<themeLogicValues, themeLogicActions>

export const themeLogic = kea<themeLogicType>([
    path(['desktop', 'themeLogic']),
    actions({
        setThemeMode: (mode: ThemeMode) => {
            try {
                localStorage.setItem(STORAGE_KEY, mode)
            } catch {
                // Storage can be unavailable; the choice then lasts until Ben closes.
            }
            return { mode }
        },
        setSystemIsDark: (dark: boolean) => ({ dark }),
    }),
    reducers({
        themeMode: [storedMode(), { setThemeMode: (_, { mode }) => mode }],
        systemIsDark: [darkQuery().matches, { setSystemIsDark: (_, { dark }) => dark }],
    }),
    selectors({
        isDark: [
            (s) => [s.themeMode, s.systemIsDark],
            (mode: ThemeMode, systemIsDark: boolean): boolean => mode === 'dark' || (mode === 'system' && systemIsDark),
        ],
    }),
    afterMount(({ actions, cache }) => {
        cache.onChange = (event: MediaQueryListEvent): void => actions.setSystemIsDark(event.matches)
        darkQuery().addEventListener('change', cache.onChange)
    }),
    beforeUnmount(({ cache }) => {
        darkQuery().removeEventListener('change', cache.onChange)
    }),
])
