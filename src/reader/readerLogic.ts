// The Reader's state: which link is open and its article, or why it couldn't be read. Mounted for the
// whole session, because links arrive from the island's search bar before the Reader window exists.

import { MakeLogicType, actions, connect, kea, listeners, path, reducers } from 'kea'

import { windowsLogic, windowsLogicActions } from '~/desktop/windowsLogic'

import { Article, fetchArticle } from './fetchArticle'

export type ReaderStatus = 'empty' | 'loading' | 'ready' | 'failed'

export interface readerLogicValues {
    status: ReaderStatus
    /** The link being read (as asked for, before redirects). */
    url: string | null
    article: Article | null
    error: string | null
}

export interface readerLogicActions {
    openLink: (url: string) => { url: string }
    articleLoaded: (url: string, article: Article) => { url: string; article: Article }
    articleFailed: (url: string, error: string) => { url: string; error: string }
    clear: () => { value: true }
    // Borrowed from windowsLogic (connect below).
    openApp: windowsLogicActions['openApp']
    closeWindow: windowsLogicActions['closeWindow']
}

export type readerLogicType = MakeLogicType<readerLogicValues, readerLogicActions>

export const readerLogic = kea<readerLogicType>([
    path(['reader', 'readerLogic']),
    connect({ actions: [windowsLogic, ['openApp', 'closeWindow']] }),
    actions({
        openLink: (url: string) => ({ url }),
        articleLoaded: (url: string, article: Article) => ({ url, article }),
        articleFailed: (url: string, error: string) => ({ url, error }),
        clear: true,
    }),
    reducers({
        status: [
            'empty' as ReaderStatus,
            { openLink: () => 'loading', articleLoaded: () => 'ready', articleFailed: () => 'failed', clear: () => 'empty' },
        ],
        url: [null as string | null, { openLink: (_, { url }) => url, clear: () => null }],
        article: [null as Article | null, { openLink: () => null, articleLoaded: (_, { article }) => article, clear: () => null }],
        error: [null as string | null, { openLink: () => null, articleFailed: (_, { error }) => error, clear: () => null }],
    }),
    listeners(({ actions, values }) => ({
        openLink: async ({ url }) => {
            actions.openApp('reader')
            let result: { article: Article } | { error: string }
            try {
                result = { article: await fetchArticle(url) }
            } catch (e) {
                result = { error: e instanceof Error ? e.message : String(e) }
            }
            // Drop the result if another link was opened, or the window closed, while this one loaded.
            if (values.status !== 'loading' || values.url !== url) {
                return
            }
            if ('article' in result) {
                actions.articleLoaded(url, result.article)
            } else {
                actions.articleFailed(url, result.error)
            }
        },
        // Closing the window discards the article (minimising keeps it, as for every window).
        closeWindow: ({ id }) => {
            if (id === 'reader') {
                actions.clear()
            }
        },
    })),
])
