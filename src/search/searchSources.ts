// Where search results come from: pages already read (History, instant and offline), Wikipedia's own title
// search, and the web through DuckDuckGo's plain HTML page (no ads kept). Only the words typed are sent, and
// only to Wikipedia and DuckDuckGo. Downloads go through Tauri's HTTP plugin, like the Reader's; in a plain
// browser tab only History answers.

import { fetch } from '@tauri-apps/plugin-http'

import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'
import { HistoryEntry } from '~/history/historyLogic'

export interface SearchResult {
    title: string
    url: string
    /** The site, shown beside the title. */
    site: string
}

export interface SearchGroups {
    history: SearchResult[]
    wikipedia: SearchResult[]
    web: SearchResult[]
}

const siteOf = (url: string): string => {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

/** Pages read before whose title or address contains every word typed, most recent first. */
export function searchHistory(entries: HistoryEntry[], query: string, limit = 4): SearchResult[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
        return []
    }
    return entries
        .filter((entry) => {
            const text = `${entry.title} ${entry.url}`.toLowerCase()
            return words.every((word) => text.includes(word))
        })
        .slice(0, limit)
        .map((entry) => ({ title: entry.title, url: entry.url, site: siteOf(entry.url) }))
}

const HEADERS = (): Record<string, string> => ({
    'User-Agent': navigator.userAgent,
    'Accept-Language': navigator.languages.join(','),
    // An empty Origin makes the HTTP plugin send none, as a browser opening a page wouldn't
    // (DuckDuckGo refuses requests with one; see Cargo.toml).
    Origin: '',
})

/** Wikipedia articles whose title matches (its "opensearch": title, then address, per result). */
export async function searchWikipedia(query: string, signal: AbortSignal, limit = 4): Promise<SearchResult[]> {
    if (!IS_DESKTOP_APP) {
        return []
    }
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&namespace=0&format=json&limit=${limit}&search=${encodeURIComponent(query)}`
    const response = await fetch(url, { headers: HEADERS(), signal })
    const [, titles, , urls] = (await response.json()) as [string, string[], string[], string[]]
    return titles.map((title, i) => ({ title, url: urls[i], site: 'en.wikipedia.org' }))
}

/** Web results from DuckDuckGo's HTML page: each result's link points through DuckDuckGo, with the real
 *  address in its `uddg` parameter. Ads are marked `result--ad` and left out. */
export async function searchWeb(query: string, signal: AbortSignal, limit = 6): Promise<SearchResult[]> {
    if (!IS_DESKTOP_APP) {
        return []
    }
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: HEADERS(),
        signal,
    })
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
    const results: SearchResult[] = []
    for (const link of doc.querySelectorAll<HTMLAnchorElement>('.result:not(.result--ad) a.result__a')) {
        const href = link.getAttribute('href') ?? ''
        const real = new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') ?? href
        if (!/^https?:\/\//.test(real) || results.some((result) => result.url === real)) {
            continue
        }
        results.push({ title: link.textContent?.trim() || real, url: real, site: siteOf(real) })
        if (results.length === limit) {
            break
        }
    }
    return results
}
