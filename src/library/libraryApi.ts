// The Library's calls into the Rust side (src-tauri/src/library.rs). In a plain browser tab there is no Rust
// side, so these answer empty and the Library says it needs the Ben app.

import { invoke } from '@tauri-apps/api/core'

import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'

export interface FolderSuggestion {
    path: string
    label: string
    files: number
}

export interface FileEntry {
    path: string
    name: string
    folder: string
    size: number
    modified: number
}

export interface FileText {
    pages: number | null
    text: string
}

export const suggestFolders = (): Promise<FolderSuggestion[]> =>
    IS_DESKTOP_APP ? invoke('library_suggest_folders') : Promise.resolve([])

export const listFiles = (folders: string[]): Promise<FileEntry[]> =>
    IS_DESKTOP_APP ? invoke('library_list', { folders }) : Promise.resolve([])

export const readFile = (path: string): Promise<FileText> =>
    IS_DESKTOP_APP ? invoke('library_read', { path }) : Promise.resolve({ pages: null, text: '' })

export const loadIndex = (): Promise<string | null> =>
    IS_DESKTOP_APP ? invoke('library_load_index') : Promise.resolve(null)

export const saveIndex = (json: string): Promise<void> =>
    IS_DESKTOP_APP ? invoke('library_save_index', { json }) : Promise.resolve()

export const watchFolders = (folders: string[]): Promise<void> =>
    IS_DESKTOP_APP ? invoke('library_watch', { folders }) : Promise.resolve()

/** Opens a file in its usual program (Word, PowerPoint…). */
export const openInProgram = (path: string): Promise<void> => invoke('library_open', { path })
