// The book showing in each Reader window, for controls that live outside the window (the Contents pill on
// Ben Island). A plain registry rather than state: the contents are only worked out when the menu opens,
// from the pages as they are laid out at that moment. The one live piece, the section being read, is a
// small store the pill subscribes to.

import { useSyncExternalStore } from 'react'

import { WindowId } from '~/desktop/windowsLogic'

export interface ContentsEntry {
    title: string
    /** How far to indent it: 0 for the article's title and top sections, 1 and 2 for sub-sections. */
    depth: number
    /** The page it starts on, from 0. */
    page: number
    /** Whether the reader is in this section now. */
    current: boolean
}

export interface OpenBook {
    contents: () => ContentsEntry[]
    /** Turns to the page of a contents entry (by its position in `contents()`). */
    goTo: (index: number) => void
}

const books = new Map<WindowId, OpenBook>()

/** Registers a window's book; returns the matching unregister. */
export function registerBook(windowId: WindowId, book: OpenBook): () => void {
    books.set(windowId, book)
    return () => {
        if (books.get(windowId) === book) {
            books.delete(windowId)
        }
    }
}

export const openBook = (windowId: WindowId): OpenBook | null => books.get(windowId) ?? null

const currentSections = new Map<WindowId, string>()
const listeners = new Set<() => void>()

/** Records which section a window's reader is in (null once its book closes). */
export function setCurrentSection(windowId: WindowId, title: string | null): void {
    if ((currentSections.get(windowId) ?? null) === title) {
        return
    }
    if (title === null) {
        currentSections.delete(windowId)
    } else {
        currentSections.set(windowId, title)
    }
    listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/** The section being read in a window, kept up to date as pages turn. */
export function useCurrentSection(windowId: WindowId): string | null {
    return useSyncExternalStore(subscribe, () => currentSections.get(windowId) ?? null)
}
