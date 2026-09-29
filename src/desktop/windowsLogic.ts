// Open windows, their stacking order and positions. Each window has its own id; an app can have several
// (the Reader opens a new window per link), or just one (the other apps, through openApp).

import { MakeLogicType, actions, kea, path, reducers, selectors } from 'kea'

import { AppId } from './apps'

/** Height of Ben Island, the menu bar across the top edge of the screen, in px. */
export const MENU_BAR_HEIGHT = 38
/** Where the desktop area starts: right below Ben Island. Windows never go above it. */
export const DESKTOP_TOP = MENU_BAR_HEIGHT
/** Gap a maximised window keeps from the island and the screen edges, so its rounded corners show. */
export const MAXIMISED_GAP = 8
/** Every window opens at this size (clamped to the screen), whichever icon opened it. */
export const WINDOW_WIDTH = 1000
export const WINDOW_HEIGHT = 700
const WINDOW_MARGIN = 16
const CASCADE_STEP = 28

/** A window's own id, such as "reader-2". */
export type WindowId = string

let windowCount = 0

/** A new, unique window id for an app. */
export const newWindowId = (appId: AppId): WindowId => `${appId}-${++windowCount}`

export interface WindowState {
    id: WindowId
    /** Which app the window belongs to. */
    appId: AppId
    x: number
    y: number
    width: number
    height: number
    maximized: boolean
    /** Hidden by the yellow light, with everything inside kept as it was; its icon brings it back. */
    minimized: boolean
}

export interface windowsLogicValues {
    /** Open windows (including minimised ones), bottom-most first; the last one is in front. */
    windows: WindowState[]
    /** The front-most window that isn't minimised. */
    focusedId: WindowId | null
    focusedWindow: WindowState | null
}

export interface windowsLogicActions {
    /** Brings back the app's most recent window (even minimised), or opens one if it has none. */
    openApp: (appId: AppId) => { appId: AppId; id: WindowId; viewport: { width: number; height: number } }
    /** Always opens a new window for the app. */
    openWindow: (appId: AppId, id?: WindowId) => { appId: AppId; id: WindowId; viewport: { width: number; height: number } }
    /** Brings a window to the front, un-minimising it if needed. */
    focusWindow: (id: WindowId) => { id: WindowId }
    closeWindow: (id: WindowId) => { id: WindowId }
    moveWindow: (id: WindowId, x: number, y: number) => { id: WindowId; x: number; y: number }
    toggleMaximize: (id: WindowId) => { id: WindowId }
    minimizeWindow: (id: WindowId) => { id: WindowId }
}

export type windowsLogicType = MakeLogicType<windowsLogicValues, windowsLogicActions>

/** Where a newly opened window goes: the standard size clamped to the screen, centred, then cascaded. */
function initialPlacement(
    id: WindowId,
    appId: AppId,
    openCount: number,
    viewport: { width: number; height: number }
): WindowState {
    const availableHeight = viewport.height - DESKTOP_TOP - WINDOW_MARGIN * 2
    const width = Math.min(WINDOW_WIDTH, viewport.width - WINDOW_MARGIN * 2)
    const height = Math.min(WINDOW_HEIGHT, availableHeight)
    const cascade = (openCount % 6) * CASCADE_STEP
    return {
        id,
        appId,
        width,
        height,
        x: Math.max(WINDOW_MARGIN, Math.round((viewport.width - width) / 2) + cascade),
        y: DESKTOP_TOP + WINDOW_MARGIN + Math.min(cascade, Math.max(0, availableHeight - height)),
        maximized: false,
        minimized: false,
    }
}

const withoutWindow = (windows: WindowState[], id: WindowId): WindowState[] => windows.filter((w) => w.id !== id)

export const windowsLogic = kea<windowsLogicType>([
    path(['desktop', 'windowsLogic']),
    actions({
        // The id and screen size are made here (not in the reducer) so reducers stay pure. openApp's id is
        // only used if the app has no window yet.
        openApp: (appId: AppId) => ({
            appId,
            id: newWindowId(appId),
            viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
        openWindow: (appId: AppId, id?: WindowId) => ({
            appId,
            id: id ?? newWindowId(appId),
            viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
        focusWindow: (id: WindowId) => ({ id }),
        closeWindow: (id: WindowId) => ({ id }),
        moveWindow: (id: WindowId, x: number, y: number) => ({ id, x, y }),
        toggleMaximize: (id: WindowId) => ({ id }),
        minimizeWindow: (id: WindowId) => ({ id }),
    }),
    reducers({
        windows: [
            [] as WindowState[],
            {
                openApp: (state, { appId, id, viewport }) => {
                    // The app's front-most window (later in the list is further forward), even if minimised:
                    // bring it back to the front, keeping its position.
                    const existing = state.findLast((w) => w.appId === appId)
                    return existing
                        ? [...withoutWindow(state, existing.id), { ...existing, minimized: false }]
                        : [...state, initialPlacement(id, appId, state.length, viewport)]
                },
                openWindow: (state, { appId, id, viewport }) => [...state, initialPlacement(id, appId, state.length, viewport)],
                focusWindow: (state, { id }) => {
                    const existing = state.find((w) => w.id === id)
                    return existing ? [...withoutWindow(state, id), { ...existing, minimized: false }] : state
                },
                closeWindow: (state, { id }) => withoutWindow(state, id),
                moveWindow: (state, { id, x, y }) => state.map((w) => (w.id === id ? { ...w, x, y } : w)),
                toggleMaximize: (state, { id }) =>
                    state.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)),
                minimizeWindow: (state, { id }) => state.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
            },
        ],
    }),
    selectors({
        focusedWindow: [
            (s) => [s.windows],
            (windows: WindowState[]): WindowState | null => windows.findLast((w) => !w.minimized) ?? null,
        ],
        focusedId: [(s) => [s.focusedWindow], (focused: WindowState | null): WindowId | null => focused?.id ?? null],
    }),
])
