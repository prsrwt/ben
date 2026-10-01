// The Newspaper windows: one per paper, each with its paper (which file, its sections and stories once read), the
// section showing, and the story being read on its own sheet, if any. Opening a paper from the Library opens it in
// a new Newspaper window, or brings forward the window already showing it, and reads the PDF there (layout code and
// PDF.js load only then). A Newspaper window opened from its desktop icon starts empty.

import { MakeLogicType, actions, connect, kea, listeners, path, reducers } from 'kea'

import { WindowId, newWindowId, windowsLogic, windowsLogicActions } from '~/desktop/windowsLogic'

import type { Paper } from './layout'
import { PaperFile } from './paperFile'

export interface OpenPaper {
    file: PaperFile
    status: 'loading' | 'ready' | 'failed'
    paper: Paper | null
    /** How many pages the PDF has. */
    pages: number
    /** A scanned paper being read page by page. */
    progress: { done: number; total: number } | null
    error: string | null
}

/** What one Newspaper window shows. */
export interface PaperWindow {
    open: OpenPaper | null
    /** The section showing, by its place in the paper (0 is the front page). */
    section: number
    /** The story being read on its own sheet, by its number in the paper; null for the broadsheet. */
    reading: number | null
}

const EMPTY: PaperWindow = { open: null, section: 0, reading: null }

/** A window's paper, section and story (an empty window has none). */
export const paperWindow = (windows: Record<WindowId, PaperWindow>, windowId: WindowId): PaperWindow => windows[windowId] ?? EMPTY

export interface newspaperLogicValues {
    windows: Record<WindowId, PaperWindow>
}

export interface newspaperLogicActions {
    /** Opens a paper in a new Newspaper window, or brings forward the one already showing it. */
    openPaper: (file: PaperFile) => { file: PaperFile; windowId: WindowId }
    /** Reads a paper (again) in a window: "Try again". */
    loadPaper: (windowId: WindowId, file: PaperFile) => { windowId: WindowId; file: PaperFile }
    paperLoaded: (windowId: WindowId, path: string, paper: Paper, pages: number) => { windowId: WindowId; path: string; paper: Paper; pages: number }
    paperFailed: (windowId: WindowId, path: string, error: string) => { windowId: WindowId; path: string; error: string }
    paperProgress: (windowId: WindowId, path: string, done: number, total: number) => { windowId: WindowId; path: string; done: number; total: number }
    showSection: (windowId: WindowId, section: number) => { windowId: WindowId; section: number }
    /** Opens a story (by its number in the paper) on its own sheet, or goes back to the broadsheet (null). */
    openStory: (windowId: WindowId, story: number | null) => { windowId: WindowId; story: number | null }
    openWindow: windowsLogicActions['openWindow']
    focusWindow: windowsLogicActions['focusWindow']
    closeWindow: windowsLogicActions['closeWindow']
}

export type newspaperLogicType = MakeLogicType<newspaperLogicValues, newspaperLogicActions>

/** Changes one window's state, leaving the others as they are. */
const change = (
    windows: Record<WindowId, PaperWindow>,
    windowId: WindowId,
    update: (window: PaperWindow) => PaperWindow
): Record<WindowId, PaperWindow> => ({ ...windows, [windowId]: update(paperWindow(windows, windowId)) })

/** The window already showing a paper, if any. */
const showing = (windows: Record<WindowId, PaperWindow>, path: string): WindowId | undefined =>
    Object.entries(windows).find(([, w]) => w.open?.file.path === path)?.[0]

/** Changes a window's paper, if it's still the one asked for (a paper finishing after another was opened in the
 *  same window finds no match and changes nothing). */
const forPaper = (path: string, update: (open: OpenPaper) => OpenPaper) => (window: PaperWindow): PaperWindow =>
    window.open?.file.path === path ? { ...window, open: update(window.open) } : window

const loading = (file: PaperFile): PaperWindow => ({
    open: { file, status: 'loading', paper: null, pages: 0, progress: null, error: null },
    section: 0,
    reading: null,
})

export const newspaperLogic = kea<newspaperLogicType>([
    path(['newspaper', 'newspaperLogic']),
    connect({ actions: [windowsLogic, ['openWindow', 'focusWindow', 'closeWindow']] }),
    actions({
        // The id is made here (not in the reducer) so reducers stay pure; it's used only if the paper isn't open.
        openPaper: (file: PaperFile) => ({ file, windowId: newWindowId('newspaper') }),
        loadPaper: (windowId: WindowId, file: PaperFile) => ({ windowId, file }),
        paperLoaded: (windowId: WindowId, path: string, paper: Paper, pages: number) => ({ windowId, path, paper, pages }),
        paperFailed: (windowId: WindowId, path: string, error: string) => ({ windowId, path, error }),
        paperProgress: (windowId: WindowId, path: string, done: number, total: number) => ({ windowId, path, done, total }),
        showSection: (windowId: WindowId, section: number) => ({ windowId, section }),
        openStory: (windowId: WindowId, story: number | null) => ({ windowId, story }),
    }),
    reducers({
        windows: [
            {} as Record<WindowId, PaperWindow>,
            {
                openPaper: (state, { file, windowId }) => (showing(state, file.path) ? state : { ...state, [windowId]: loading(file) }),
                loadPaper: (state, { windowId, file }) => ({ ...state, [windowId]: loading(file) }),
                paperProgress: (state, { windowId, path, done, total }) =>
                    state[windowId]
                        ? change(state, windowId, forPaper(path, (open) => (open.status === 'loading' ? { ...open, progress: { done, total } } : open)))
                        : state,
                paperLoaded: (state, { windowId, path, paper, pages }) =>
                    state[windowId] ? change(state, windowId, forPaper(path, (open) => ({ ...open, status: 'ready', paper, pages }))) : state,
                paperFailed: (state, { windowId, path, error }) =>
                    state[windowId] ? change(state, windowId, forPaper(path, (open) => ({ ...open, status: 'failed', error }))) : state,
                showSection: (state, { windowId, section }) => change(state, windowId, (w) => ({ ...w, section, reading: null })),
                openStory: (state, { windowId, story }) => change(state, windowId, (w) => ({ ...w, reading: story })),
                // Closing a window lets its paper go (minimising keeps it, as for every window).
                closeWindow: (state, { id }) => {
                    if (!(id in state)) {
                        return state
                    }
                    const { [id]: _closed, ...rest } = state
                    return rest
                },
            },
        ],
    }),
    listeners(({ actions, values }) => {
        const read = async (windowId: WindowId, file: PaperFile): Promise<void> => {
            try {
                const { loadPaper } = await import('./openPaper')
                const { paper, pages } = await loadPaper(file, (done, total) => actions.paperProgress(windowId, file.path, done, total))
                actions.paperLoaded(windowId, file.path, paper, pages)
            } catch (e) {
                actions.paperFailed(windowId, file.path, e instanceof Error ? e.message : String(e))
            }
        }
        return {
            openPaper: async ({ file, windowId }) => {
                const already = showing(values.windows, file.path)
                if (already && already !== windowId) {
                    actions.focusWindow(already)
                    return
                }
                actions.openWindow('newspaper', windowId)
                await read(windowId, file)
            },
            loadPaper: async ({ windowId, file }) => {
                await read(windowId, file)
            },
        }
    }),
])
