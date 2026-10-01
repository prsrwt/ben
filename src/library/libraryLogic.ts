// The Library's state: the folders the student keeps study material in, who they are (to spot their own work),
// every file found there with what it was recognised as, and their corrections. Kept in an index file in Ben's
// app data (library.json), so a restart doesn't read everything again: only new or changed files are read.
// Files themselves are never moved or changed.

import { listen } from '@tauri-apps/api/event'
import { MakeLogicType, actions, afterMount, beforeUnmount, kea, listeners, path, reducers, selectors } from 'kea'

import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'

import { FileKind, Identity, Recognised, learnCourseCodes, recognise, stem } from './classify'
import { listFiles, loadIndex, readFile, saveIndex, watchFolders } from './libraryApi'

export interface LibraryFile {
    path: string
    name: string
    folder: string
    size: number
    modified: number
    pages: number | null
    /** The start of the text, kept so files can be recognised again (rules improve) without reading again. */
    text: string
}

export interface Correction {
    kind?: FileKind
    subject?: string | null
}

export interface LibrarySettings {
    folders: string[]
    identity: Identity
    /** Whether the first-run setup has been completed. */
    setUp: boolean
}

/** One shelf entry: a file with its copies and other formats ("NR SE Notes.pdf" + "NR SE Notes (1).pdf"). */
export interface LibraryItem {
    key: string
    title: string
    /** The first file of the group, the one opened. */
    file: LibraryFile
    files: LibraryFile[]
    recognised: Recognised
    corrected: boolean
}

interface SavedIndex {
    version: 1
    settings: LibrarySettings
    files: LibraryFile[]
    corrections: Record<string, Correction>
}

/** How much text is kept per file in the index. */
const KEPT_TEXT = 1500

const DEFAULT_SETTINGS: LibrarySettings = { folders: [], identity: { name: '', rollNumbers: [] }, setUp: false }

export interface libraryLogicValues {
    loaded: boolean
    settings: LibrarySettings
    files: Record<string, LibraryFile>
    corrections: Record<string, Correction>
    /** Reading progress while importing; null when idle. */
    progress: { done: number; total: number } | null
    items: LibraryItem[]
    subjects: string[]
}

export interface libraryLogicActions {
    loadIndex: () => { value: true }
    indexLoaded: (index: SavedIndex | null) => { index: SavedIndex | null }
    finishSetup: (folders: string[], identity: Identity) => { folders: string[]; identity: Identity }
    setFolders: (folders: string[]) => { folders: string[] }
    setIdentity: (identity: Identity) => { identity: Identity }
    scan: () => { value: true }
    filesListed: (keep: string[]) => { keep: string[] }
    fileRead: (file: LibraryFile) => { file: LibraryFile }
    setProgress: (progress: { done: number; total: number } | null) => { progress: { done: number; total: number } | null }
    correct: (key: string, correction: Correction) => { key: string; correction: Correction }
}

export type libraryLogicType = MakeLogicType<libraryLogicValues, libraryLogicActions>

/** Files that are the same item: same name once copy markers and format are dropped, in any folder. */
const groupKey = (file: { name: string }): string => stem(file.name).toLowerCase()

export const libraryLogic = kea<libraryLogicType>([
    path(['library', 'libraryLogic']),
    actions({
        loadIndex: true,
        indexLoaded: (index: SavedIndex | null) => ({ index }),
        finishSetup: (folders: string[], identity: Identity) => ({ folders, identity }),
        setFolders: (folders: string[]) => ({ folders }),
        setIdentity: (identity: Identity) => ({ identity }),
        scan: true,
        filesListed: (keep: string[]) => ({ keep }),
        fileRead: (file: LibraryFile) => ({ file }),
        setProgress: (progress) => ({ progress }),
        correct: (key: string, correction: Correction) => ({ key, correction }),
    }),
    reducers({
        loaded: [false, { indexLoaded: () => true }],
        settings: [
            DEFAULT_SETTINGS as LibrarySettings,
            {
                indexLoaded: (state, { index }) => index?.settings ?? state,
                finishSetup: (_, { folders, identity }) => ({ folders, identity, setUp: true }),
                setFolders: (state, { folders }) => ({ ...state, folders }),
                setIdentity: (state, { identity }) => ({ ...state, identity }),
            },
        ],
        files: [
            {} as Record<string, LibraryFile>,
            {
                indexLoaded: (state, { index }) =>
                    index ? Object.fromEntries(index.files.map((file) => [file.path, file])) : state,
                // Files no longer in the folders leave the Library.
                filesListed: (state, { keep }) => {
                    const kept = new Set(keep)
                    return Object.fromEntries(Object.entries(state).filter(([filePath]) => kept.has(filePath)))
                },
                fileRead: (state, { file }) => ({ ...state, [file.path]: file }),
            },
        ],
        corrections: [
            {} as Record<string, Correction>,
            {
                indexLoaded: (state, { index }) => index?.corrections ?? state,
                correct: (state, { key, correction }) => ({ ...state, [key]: { ...state[key], ...correction } }),
            },
        ],
        progress: [null as { done: number; total: number } | null, { setProgress: (_, { progress }) => progress }],
    }),
    selectors({
        items: [
            (s) => [s.files, s.corrections, s.settings],
            (files: Record<string, LibraryFile>, corrections: Record<string, Correction>, settings: LibrarySettings): LibraryItem[] => {
                const all = Object.values(files)
                const codes = learnCourseCodes(all.map((file) => file.name))
                // One item per document: the same name in the same folder (other formats of it, "(1)" downloads),
                // or anywhere with the same size (true copies). Same name alone isn't enough: "README" or
                // "Assignment1" in two folders are different files.
                const groups = new Map<string, LibraryFile[]>()
                const keysByName = new Map<string, string[]>()
                for (const file of all) {
                    const name = groupKey(file)
                    const sameName = keysByName.get(name) ?? []
                    const copyOf = sameName.find((k) => groups.get(k)!.some((m) => m.size === file.size))
                    const key = copyOf ?? `${name}\u0000${file.folder}`
                    if (!groups.has(key)) {
                        groups.set(key, [])
                        keysByName.set(name, [...sameName, key])
                    }
                    groups.get(key)!.push(file)
                }
                return [...groups.entries()].map(([key, members]) => {
                    // Open a PDF when there is one: it shows inside Ben.
                    const sorted = [...members].sort((a, b) => Number(b.name.endsWith('.pdf')) - Number(a.name.endsWith('.pdf')))
                    const file = sorted[0]
                    const found = recognise(
                        { name: file.name, folder: file.folder, pages: file.pages ?? undefined, text: file.text },
                        settings.identity,
                        codes
                    )
                    const correction = corrections[key]
                    const recognised: Recognised = correction
                        ? {
                              ...found,
                              kind: correction.kind ?? found.kind,
                              subject: correction.subject !== undefined ? correction.subject : found.subject,
                              confidence: 1,
                          }
                        : found
                    return { key, title: stem(file.name), file, files: sorted, recognised, corrected: Boolean(correction) }
                })
            },
        ],
        subjects: [
            (s) => [s.items],
            (items: LibraryItem[]): string[] =>
                [...new Set(items.map((item) => item.recognised.subject).filter((subject): subject is string => Boolean(subject)))].sort(),
        ],
    }),
    listeners(({ actions, values, cache }) => {
        /** Saves the index a moment after the last change, so a busy import writes it once. */
        const save = (): void => {
            clearTimeout(cache.saveTimer)
            cache.saveTimer = setTimeout(() => {
                const index: SavedIndex = {
                    version: 1,
                    settings: values.settings,
                    files: Object.values(values.files),
                    corrections: values.corrections,
                }
                void saveIndex(JSON.stringify(index))
            }, 800)
        }
        return {
            loadIndex: async () => {
                let index: SavedIndex | null = null
                try {
                    const json = await loadIndex()
                    index = json ? (JSON.parse(json) as SavedIndex) : null
                } catch {
                    // A damaged index: start again rather than fail (files are only read, never changed).
                }
                actions.indexLoaded(index)
                if (values.settings.setUp) {
                    void watchFolders(values.settings.folders)
                    actions.scan()
                }
            },
            finishSetup: () => {
                void watchFolders(values.settings.folders)
                save()
                actions.scan()
            },
            setFolders: () => {
                void watchFolders(values.settings.folders)
                save()
                actions.scan()
            },
            setIdentity: save,
            correct: save,
            // Lists the folders, then reads only files that are new or changed since they were last read.
            scan: async () => {
                if (cache.scanning) {
                    cache.scanAgain = true
                    return
                }
                cache.scanning = true
                try {
                    const listed = await listFiles(values.settings.folders)
                    actions.filesListed(listed.map((entry) => entry.path))
                    const toRead = listed.filter((entry) => {
                        const known = values.files[entry.path]
                        return !known || known.size !== entry.size || known.modified !== entry.modified
                    })
                    for (let i = 0; i < toRead.length; i++) {
                        actions.setProgress({ done: i, total: toRead.length })
                        const entry = toRead[i]
                        const { pages, text } = await readFile(entry.path)
                        actions.fileRead({ ...entry, pages, text: text.replace(/\s+/g, ' ').slice(0, KEPT_TEXT) })
                    }
                    if (toRead.length > 0 || listed.length !== Object.keys(values.files).length) {
                        save()
                    }
                } finally {
                    actions.setProgress(null)
                    cache.scanning = false
                    if (cache.scanAgain) {
                        cache.scanAgain = false
                        actions.scan()
                    }
                }
            },
        }
    }),
    afterMount(({ actions, cache }) => {
        actions.loadIndex()
        if (IS_DESKTOP_APP) {
            // New downloads and changes in the watched folders: look again, a moment after the last one
            // (a download writes a file in many small steps).
            void listen('library-changed', () => {
                clearTimeout(cache.changeTimer)
                cache.changeTimer = setTimeout(() => actions.scan(), 1500)
            }).then((unlisten) => {
                cache.unlisten = unlisten
            })
        }
    }),
    beforeUnmount(({ cache }) => {
        cache.unlisten?.()
        clearTimeout(cache.changeTimer)
        clearTimeout(cache.saveTimer)
    }),
])
