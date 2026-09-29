// The Reader's state: the pages visited in its window (its history) and which one is showing. Back and
// forward move through pages already loaded, so they show instantly. Mounted for the whole session,
// because links arrive from the island's search bar before the Reader window exists.

import { MakeLogicType, actions, connect, kea, listeners, path, reducers, selectors } from 'kea'

import { windowsLogic, windowsLogicActions } from '~/desktop/windowsLogic'

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

/** Oldest pages are forgotten beyond this, so a long session doesn't hold every article in memory. */
const MAX_HISTORY = 30

let nextPageId = 1

export interface ReaderHistory {
    pages: ReaderPage[]
    index: number
}

export interface readerLogicValues {
    history: ReaderHistory
    pages: ReaderPage[]
    /** Which page is showing; -1 when there are none. */
    index: number
    current: ReaderPage | null
    canGoBack: boolean
    canGoForward: boolean
}

export interface readerLogicActions {
    openLink: (url: string) => { page: ReaderPage }
    back: () => { value: true }
    forward: () => { value: true }
    /** Downloads the showing page again (after an error). */
    reload: () => { value: true }
    pageLoaded: (id: number, article: Article) => { id: number; article: Article }
    pageFailed: (id: number, error: string) => { id: number; error: string }
    clear: () => { value: true }
    // Borrowed from windowsLogic (connect below).
    openApp: windowsLogicActions['openApp']
    closeWindow: windowsLogicActions['closeWindow']
}

export type readerLogicType = MakeLogicType<readerLogicValues, readerLogicActions>

const updatePage = (pages: ReaderPage[], id: number, change: Partial<ReaderPage>): ReaderPage[] =>
    pages.map((page) => (page.id === id ? { ...page, ...change } : page))

export const readerLogic = kea<readerLogicType>([
    path(['reader', 'readerLogic']),
    connect({ actions: [windowsLogic, ['openApp', 'closeWindow']] }),
    actions({
        openLink: (url: string) => ({
            // Created here (not in the reducer) so reducers stay pure.
            page: { id: nextPageId++, url, status: 'loading', article: null, error: null } as ReaderPage,
        }),
        back: true,
        forward: true,
        reload: true,
        pageLoaded: (id: number, article: Article) => ({ id, article }),
        pageFailed: (id: number, error: string) => ({ id, error }),
        clear: true,
    }),
    reducers({
        // Pages and index change together, so they share one reducer and are split by selectors.
        history: [
            { pages: [], index: -1 } as ReaderHistory,
            {
                // A new page replaces any pages ahead of the current one, as in a browser.
                openLink: ({ pages, index }, { page }) => {
                    const kept = [...pages.slice(0, index + 1), page].slice(-MAX_HISTORY)
                    return { pages: kept, index: kept.length - 1 }
                },
                back: (state) => ({ ...state, index: Math.max(0, state.index - 1) }),
                forward: (state) => ({ ...state, index: Math.min(state.pages.length - 1, state.index + 1) }),
                reload: ({ pages, index }) => ({
                    pages: pages[index] ? updatePage(pages, pages[index].id, { status: 'loading', error: null }) : pages,
                    index,
                }),
                // A download that finishes after its page was dropped finds no match and changes nothing.
                pageLoaded: (state, { id, article }) => ({
                    ...state,
                    pages: updatePage(state.pages, id, { status: 'ready', article }),
                }),
                pageFailed: (state, { id, error }) => ({
                    ...state,
                    pages: updatePage(state.pages, id, { status: 'failed', error }),
                }),
                clear: () => ({ pages: [], index: -1 }),
            },
        ],
    }),
    selectors({
        pages: [(s) => [s.history], (history: ReaderHistory): ReaderPage[] => history.pages],
        index: [(s) => [s.history], (history: ReaderHistory): number => history.index],
        current: [(s) => [s.pages, s.index], (pages: ReaderPage[], index: number): ReaderPage | null => pages[index] ?? null],
        canGoBack: [(s) => [s.index], (index: number): boolean => index > 0],
        canGoForward: [(s) => [s.pages, s.index], (pages: ReaderPage[], index: number): boolean => index < pages.length - 1],
    }),
    listeners(({ actions, values }) => {
        const load = async (page: ReaderPage): Promise<void> => {
            try {
                actions.pageLoaded(page.id, await fetchArticle(page.url))
            } catch (e) {
                actions.pageFailed(page.id, e instanceof Error ? e.message : String(e))
            }
        }
        return {
            openLink: async ({ page }) => {
                actions.openApp('reader')
                await load(page)
            },
            reload: async () => {
                if (values.current) {
                    await load(values.current)
                }
            },
            // Closing the window discards its pages (minimising keeps them, as for every window).
            closeWindow: ({ id }) => {
                if (id === 'reader') {
                    actions.clear()
                }
            },
        }
    }),
])
