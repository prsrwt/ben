// The Reader's state: for each Reader window, the pages visited in it (its history) and which one is
// showing. Back and forward move through pages already loaded, so they show instantly. Mounted for the
// whole session, because links arrive from the island's search bar before their window exists.

import { MakeLogicType, actions, connect, kea, listeners, path, reducers } from 'kea'

import { WindowId, newWindowId, windowsLogic, windowsLogicActions } from '~/desktop/windowsLogic'

import { Article, fetchArticle } from './fetchArticle'

export interface ReaderPage {
    /** Unique for the session; tells a late download which page it belongs to. */
    id: number
    /** The link as asked for, before redirects. */
    url: string
    status: 'loading' | 'ready' | 'failed'
    article: Article | null
    error: string | null
}

export interface ReaderHistory {
    pages: ReaderPage[]
    /** Which page is showing; -1 when there are none. */
    index: number
}

/** Oldest pages are forgotten beyond this, so a long session doesn't hold every article in memory. */
const MAX_HISTORY = 30

const EMPTY_HISTORY: ReaderHistory = { pages: [], index: -1 }

let nextPageId = 1

const newPage = (url: string): ReaderPage => ({ id: nextPageId++, url, status: 'loading', article: null, error: null })

export interface readerLogicValues {
    /** Each Reader window's history, by window id. A window missing here is empty. */
    histories: Record<WindowId, ReaderHistory>
}

export interface readerLogicActions {
    /** Opens a link in a new Reader window. */
    openLinkInNewWindow: (url: string) => { windowId: WindowId; page: ReaderPage }
    /** Opens a link in a new Reader window on the right half of the desktop, with `besideId` on the left. */
    openLinkBeside: (besideId: WindowId, url: string) => { besideId: WindowId; windowId: WindowId; page: ReaderPage }
    /** Opens a link in an existing Reader window, after its current page. */
    openLink: (windowId: WindowId, url: string) => { windowId: WindowId; page: ReaderPage }
    back: (windowId: WindowId) => { windowId: WindowId }
    forward: (windowId: WindowId) => { windowId: WindowId }
    /** Downloads the window's showing page again (after an error). */
    reload: (windowId: WindowId) => { windowId: WindowId }
    pageLoaded: (windowId: WindowId, pageId: number, article: Article) => { windowId: WindowId; pageId: number; article: Article }
    pageFailed: (windowId: WindowId, pageId: number, error: string) => { windowId: WindowId; pageId: number; error: string }
    // Borrowed from windowsLogic (connect below).
    openWindow: windowsLogicActions['openWindow']
    openBeside: windowsLogicActions['openBeside']
    closeWindow: windowsLogicActions['closeWindow']
}

export type readerLogicType = MakeLogicType<readerLogicValues, readerLogicActions>

/** The history shown in a window, and what its island buttons can do. */
export function readerWindowState(histories: Record<WindowId, ReaderHistory>, windowId: WindowId): {
    current: ReaderPage | null
    canGoBack: boolean
    canGoForward: boolean
} {
    const { pages, index } = histories[windowId] ?? EMPTY_HISTORY
    return { current: pages[index] ?? null, canGoBack: index > 0, canGoForward: index < pages.length - 1 }
}

/** Replaces one window's history, leaving the others as they are. */
const withHistory = (
    histories: Record<WindowId, ReaderHistory>,
    windowId: WindowId,
    change: (history: ReaderHistory) => ReaderHistory
): Record<WindowId, ReaderHistory> => ({ ...histories, [windowId]: change(histories[windowId] ?? EMPTY_HISTORY) })

const updatePage = (history: ReaderHistory, pageId: number, change: Partial<ReaderPage>): ReaderHistory => ({
    ...history,
    pages: history.pages.map((page) => (page.id === pageId ? { ...page, ...change } : page)),
})

/** A new page replaces any pages ahead of the current one, as in a browser. */
const push = ({ pages, index }: ReaderHistory, page: ReaderPage): ReaderHistory => {
    const kept = [...pages.slice(0, index + 1), page].slice(-MAX_HISTORY)
    return { pages: kept, index: kept.length - 1 }
}

export const readerLogic = kea<readerLogicType>([
    path(['reader', 'readerLogic']),
    connect({ actions: [windowsLogic, ['openWindow', 'openBeside', 'closeWindow']] }),
    actions({
        // Ids are made here (not in the reducer) so reducers stay pure.
        openLinkInNewWindow: (url: string) => ({ windowId: newWindowId('reader'), page: newPage(url) }),
        openLinkBeside: (besideId: WindowId, url: string) => ({ besideId, windowId: newWindowId('reader'), page: newPage(url) }),
        openLink: (windowId: WindowId, url: string) => ({ windowId, page: newPage(url) }),
        back: (windowId: WindowId) => ({ windowId }),
        forward: (windowId: WindowId) => ({ windowId }),
        reload: (windowId: WindowId) => ({ windowId }),
        pageLoaded: (windowId: WindowId, pageId: number, article: Article) => ({ windowId, pageId, article }),
        pageFailed: (windowId: WindowId, pageId: number, error: string) => ({ windowId, pageId, error }),
    }),
    reducers({
        histories: [
            {} as Record<WindowId, ReaderHistory>,
            {
                openLinkInNewWindow: (state, { windowId, page }) => withHistory(state, windowId, (h) => push(h, page)),
                openLinkBeside: (state, { windowId, page }) => withHistory(state, windowId, (h) => push(h, page)),
                openLink: (state, { windowId, page }) => withHistory(state, windowId, (h) => push(h, page)),
                back: (state, { windowId }) => withHistory(state, windowId, (h) => ({ ...h, index: Math.max(0, h.index - 1) })),
                forward: (state, { windowId }) =>
                    withHistory(state, windowId, (h) => ({ ...h, index: Math.min(h.pages.length - 1, h.index + 1) })),
                reload: (state, { windowId }) =>
                    withHistory(state, windowId, (h) =>
                        h.pages[h.index] ? updatePage(h, h.pages[h.index].id, { status: 'loading', error: null }) : h
                    ),
                // A download that finishes after its page or window is gone finds no match and changes nothing.
                pageLoaded: (state, { windowId, pageId, article }) =>
                    state[windowId] ? withHistory(state, windowId, (h) => updatePage(h, pageId, { status: 'ready', article })) : state,
                pageFailed: (state, { windowId, pageId, error }) =>
                    state[windowId] ? withHistory(state, windowId, (h) => updatePage(h, pageId, { status: 'failed', error })) : state,
                // Closing a window discards its pages (minimising keeps them, as for every window).
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
        const load = async (windowId: WindowId, page: ReaderPage): Promise<void> => {
            try {
                actions.pageLoaded(windowId, page.id, await fetchArticle(page.url))
            } catch (e) {
                actions.pageFailed(windowId, page.id, e instanceof Error ? e.message : String(e))
            }
        }
        return {
            openLinkInNewWindow: async ({ windowId, page }) => {
                actions.openWindow('reader', windowId)
                await load(windowId, page)
            },
            openLinkBeside: async ({ besideId, windowId, page }) => {
                actions.openBeside('reader', windowId, besideId)
                await load(windowId, page)
            },
            openLink: async ({ windowId, page }) => {
                await load(windowId, page)
            },
            reload: async ({ windowId }) => {
                const { current } = readerWindowState(values.histories, windowId)
                if (current) {
                    await load(windowId, current)
                }
            },
        }
    }),
])
