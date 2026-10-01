// The Newspaper window's paper: which one is open, its sections and stories once read, and the section showing.
// Opening a paper from the Library brings the Newspaper window forward and reads the PDF there (layout code and
// PDF.js load only then). A story opens in the Reader: the Reader window already showing a story from a paper
// if there is one (so back and forward step through the stories read), else a new one.

import { MakeLogicType, actions, connect, kea, listeners, path, reducers } from 'kea'

import { windowsLogic, windowsLogicActions } from '~/desktop/windowsLogic'
import { readerLogic, readerLogicActions, readerWindowState } from '~/reader/readerLogic'

import type { Paper } from './layout'
import { PaperFile, isPaperUrl, paperUrl } from './paperFile'

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

export interface newspaperLogicValues {
    open: OpenPaper | null
    /** The section showing, by its place in the paper (0 is the front page). */
    section: number
}

export interface newspaperLogicActions {
    openPaper: (file: PaperFile) => { file: PaperFile }
    paperLoaded: (path: string, paper: Paper, pages: number) => { path: string; paper: Paper; pages: number }
    paperFailed: (path: string, error: string) => { path: string; error: string }
    paperProgress: (path: string, done: number, total: number) => { path: string; done: number; total: number }
    showSection: (section: number) => { section: number }
    /** Opens a story (by its number in the paper) in the Reader. */
    readStory: (story: number) => { story: number }
    openApp: windowsLogicActions['openApp']
    focusWindow: windowsLogicActions['focusWindow']
    openLink: readerLogicActions['openLink']
    openLinkInNewWindow: readerLogicActions['openLinkInNewWindow']
}

export type newspaperLogicType = MakeLogicType<newspaperLogicValues, newspaperLogicActions>

export const newspaperLogic = kea<newspaperLogicType>([
    path(['newspaper', 'newspaperLogic']),
    connect({
        actions: [windowsLogic, ['openApp', 'focusWindow'], readerLogic, ['openLink', 'openLinkInNewWindow']],
    }),
    actions({
        openPaper: (file: PaperFile) => ({ file }),
        paperLoaded: (path: string, paper: Paper, pages: number) => ({ path, paper, pages }),
        paperFailed: (path: string, error: string) => ({ path, error }),
        paperProgress: (path: string, done: number, total: number) => ({ path, done, total }),
        showSection: (section: number) => ({ section }),
        readStory: (story: number) => ({ story }),
    }),
    reducers({
        open: [
            null as OpenPaper | null,
            {
                openPaper: (_, { file }) => ({ file, status: 'loading', paper: null, pages: 0, progress: null, error: null }),
                paperProgress: (state, { path, done, total }) =>
                    state?.file.path === path && state.status === 'loading' ? { ...state, progress: { done, total } } : state,
                // A paper that finishes after another was opened finds no match and changes nothing.
                paperLoaded: (state, { path, paper, pages }) =>
                    state?.file.path === path ? { ...state, status: 'ready', paper, pages } : state,
                paperFailed: (state, { path, error }) => (state?.file.path === path ? { ...state, status: 'failed', error } : state),
            },
        ],
        section: [0, { openPaper: () => 0, showSection: (_, { section }) => section }],
    }),
    listeners(({ actions, values }) => ({
        openPaper: async ({ file }) => {
            actions.openApp('newspaper')
            try {
                const { loadPaper } = await import('./openPaper')
                const { paper, pages } = await loadPaper(file.path, (done, total) => actions.paperProgress(file.path, done, total))
                actions.paperLoaded(file.path, paper, pages)
            } catch (e) {
                actions.paperFailed(file.path, e instanceof Error ? e.message : String(e))
            }
        },
        readStory: ({ story }) => {
            if (!values.open) {
                return
            }
            const url = paperUrl({ ...values.open.file, story })
            const { histories } = readerLogic.values
            const reading = [...windowsLogic.values.windows]
                .reverse()
                .find((w) => w.appId === 'reader' && isPaperUrl(readerWindowState(histories, w.id).current?.url ?? ''))
            if (reading) {
                actions.openLink(reading.id, url)
                actions.focusWindow(reading.id)
            } else {
                actions.openLinkInNewWindow(url)
            }
        },
    })),
])
