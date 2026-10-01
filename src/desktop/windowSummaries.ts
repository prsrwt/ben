// What to call each open window, for the island's app lists and Ben View: the article's title for a
// Reader window (or what it's doing), the paper's for a Newspaper window, the app's name for the rest. Front-most window first.

import { useValues } from 'kea'

import { newspaperLogic, paperWindow } from '~/newspaper/newspaperLogic'
import { isPaperUrl, paperFile } from '~/newspaper/paperFile'
import { readerLogic, readerWindowState } from '~/reader/readerLogic'

import { APPS, AppId } from './apps'
import { WindowId, windowsLogic } from './windowsLogic'

export interface WindowSummary {
    id: WindowId
    appId: AppId
    title: string
    /** The site a Reader window shows, if any. */
    site: string | null
    /** The addresses a Reader window shows (as asked for, and after redirects), to tell open pages apart. */
    urls: string[]
    minimized: boolean
}

/** A web page's site ("en.wikipedia.org"), or a paper's title for a newspaper opened from the Library. */
export const hostOf = (url: string): string =>
    isPaperUrl(url) ? (paperFile(url).paper ?? paperFile(url).title) : new URL(url).hostname.replace(/^www\./, '')

export function useWindowSummaries(): WindowSummary[] {
    const { windows } = useValues(windowsLogic)
    const { histories } = useValues(readerLogic)
    const papers = useValues(newspaperLogic).windows

    return [...windows].reverse().map((w) => {
        const base = { id: w.id, appId: w.appId, minimized: w.minimized }
        if (w.appId === 'newspaper') {
            // A Newspaper window by its paper ("The Hindu, 17 September 2026").
            const open = paperWindow(papers, w.id).open
            return { ...base, title: open?.file.title ?? APPS.newspaper.title, site: open ? APPS.newspaper.title : null, urls: [] }
        }
        if (w.appId !== 'reader') {
            return { ...base, title: APPS[w.appId].title, site: null, urls: [] }
        }
        const { current } = readerWindowState(histories, w.id)
        if (!current) {
            return { ...base, title: 'Empty Reader', site: null, urls: [] }
        }
        const site = hostOf(current.article?.url ?? current.url)
        const title =
            current.article?.title ?? (current.status === 'failed' ? `Couldn't open ${site}` : `Opening ${site}…`)
        const urls = current.article ? [current.url, current.article.url] : [current.url]
        return { ...base, title, site, urls }
    })
}
