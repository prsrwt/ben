// Reading history: every page the Reader opens successfully, newest first, kept across restarts in
// localStorage. Only the link, title and time are stored, never the article; reopening downloads it
// again. A page read again moves to the top rather than appearing twice. Mounted for the whole session,
// so pages are recorded whether or not the History window is open.

import { MakeLogicType, actions, connect, kea, listeners, path, reducers } from 'kea'

import { readerLogic, readerLogicActions } from '~/reader/readerLogic'

export interface HistoryEntry {
    id: string
    /** The page's final address, after redirects. */
    url: string
    title: string
    /** When it was last opened, in ms since 1970. */
    visitedAt: number
}

const STORAGE_KEY = 'ben.history'
/** The oldest entries are dropped beyond this. */
const MAX_ENTRIES = 1000

const isEntry = (value: unknown): value is HistoryEntry => {
    const entry = value as Partial<HistoryEntry> | null
    return (
        typeof entry?.id === 'string' &&
        typeof entry.url === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.visitedAt === 'number'
    )
}

function storedEntries(): HistoryEntry[] {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
        return Array.isArray(value) ? value.filter(isEntry) : []
    } catch {
        // Storage unavailable or the saved value is damaged: start empty rather than fail.
        return []
    }
}

function saveEntries(entries: HistoryEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // Storage can be unavailable or full; history then lasts until Ben closes.
    }
}

export interface historyLogicValues {
    entries: HistoryEntry[]
}

export interface historyLogicActions {
    record: (url: string, title: string) => { entry: HistoryEntry }
    remove: (id: string) => { id: string }
    clear: () => { value: true }
    // Borrowed from readerLogic (connect below): a page finished loading.
    pageLoaded: readerLogicActions['pageLoaded']
}

export type historyLogicType = MakeLogicType<historyLogicValues, historyLogicActions>

export const historyLogic = kea<historyLogicType>([
    path(['history', 'historyLogic']),
    connect({ actions: [readerLogic, ['pageLoaded']] }),
    actions({
        // Id and time are made here (not in the reducer) so reducers stay pure.
        record: (url: string, title: string) => ({ entry: { id: crypto.randomUUID(), url, title, visitedAt: Date.now() } }),
        remove: (id: string) => ({ id }),
        clear: true,
    }),
    reducers({
        entries: [
            storedEntries(),
            {
                record: (entries, { entry }) =>
                    [entry, ...entries.filter((existing) => existing.url !== entry.url)].slice(0, MAX_ENTRIES),
                remove: (entries, { id }) => entries.filter((entry) => entry.id !== id),
                clear: () => [],
            },
        ],
    }),
    listeners(({ actions, values }) => ({
        pageLoaded: ({ article }) => actions.record(article.url, article.title),
        record: () => saveEntries(values.entries),
        remove: () => saveEntries(values.entries),
        clear: () => saveEntries(values.entries),
    })),
])
