// Open windows, their stacking order and positions.

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

export interface WindowState {
    id: AppId
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
    focusedId: AppId | null
}

export interface windowsLogicActions {
    openApp: (id: AppId) => { id: AppId; viewport: { width: number; height: number } }
    focusWindow: (id: AppId) => { id: AppId }
    closeWindow: (id: AppId) => { id: AppId }
    moveWindow: (id: AppId, x: number, y: number) => { id: AppId; x: number; y: number }
    toggleMaximize: (id: AppId) => { id: AppId }
    minimizeWindow: (id: AppId) => { id: AppId }
}

export type windowsLogicType = MakeLogicType<windowsLogicValues, windowsLogicActions>

/** Where a newly opened window goes: the standard size clamped to the screen, centred, then cascaded. */
function initialPlacement(id: AppId, openCount: number, viewport: { width: number; height: number }): WindowState {
    const availableHeight = viewport.height - DESKTOP_TOP - WINDOW_MARGIN * 2
    const width = Math.min(WINDOW_WIDTH, viewport.width - WINDOW_MARGIN * 2)
    const height = Math.min(WINDOW_HEIGHT, availableHeight)
    const cascade = (openCount % 6) * CASCADE_STEP
    return {
        id,
        width,
        height,
        x: Math.max(WINDOW_MARGIN, Math.round((viewport.width - width) / 2) + cascade),
        y: DESKTOP_TOP + WINDOW_MARGIN + Math.min(cascade, Math.max(0, availableHeight - height)),
        maximized: false,
        minimized: false,
    }
}

const withoutWindow = (windows: WindowState[], id: AppId): WindowState[] => windows.filter((w) => w.id !== id)

export const windowsLogic = kea<windowsLogicType>([
    path(['desktop', 'windowsLogic']),
    actions({
        openApp: (id: AppId) => ({
            id,
            // Read here (not in the reducer) so reducers stay pure.
            viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
        focusWindow: (id: AppId) => ({ id }),
        closeWindow: (id: AppId) => ({ id }),
        moveWindow: (id: AppId, x: number, y: number) => ({ id, x, y }),
        toggleMaximize: (id: AppId) => ({ id }),
        minimizeWindow: (id: AppId) => ({ id }),
    }),
    reducers({
        windows: [
            [] as WindowState[],
            {
                openApp: (state, { id, viewport }) => {
                    const existing = state.find((w) => w.id === id)
                    // Already open (or minimised): bring it back to the front, keeping its position.
                    return existing
                        ? [...withoutWindow(state, id), { ...existing, minimized: false }]
                        : [...state, initialPlacement(id, state.length, viewport)]
                },
                focusWindow: (state, { id }) => {
                    const existing = state.find((w) => w.id === id)
                    return existing ? [...withoutWindow(state, id), existing] : state
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
        focusedId: [
            (s) => [s.windows],
            (windows: WindowState[]): AppId | null => windows.filter((w) => !w.minimized).at(-1)?.id ?? null,
        ],
    }),
])
