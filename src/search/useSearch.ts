// Search results for what's typed: History at once, Wikipedia and the web after a short pause in typing
// (so every keystroke doesn't send a request). A newer query cancels the older one's downloads. Pages
// already read aren't repeated from Wikipedia or the web, and the web doesn't repeat Wikipedia.

import { useValues } from 'kea'
import { useEffect, useMemo, useState } from 'react'

import { historyLogic } from '~/history/historyLogic'

import { SearchGroups, SearchResult, searchHistory, searchWeb, searchWikipedia } from './searchSources'

const PAUSE_MS = 250

export interface Search extends SearchGroups {
    /** Whether Wikipedia or the web are still answering. */
    loading: boolean
    /** Every result in the order shown, for arrow keys. */
    all: SearchResult[]
}

export function useSearch(query: string): Search {
    const { entries } = useValues(historyLogic)
    const text = query.trim()
    const history = useMemo(() => searchHistory(entries, text), [entries, text])
    const [remote, setRemote] = useState<{ for: string; wikipedia: SearchResult[]; web: SearchResult[] }>({
        for: '',
        wikipedia: [],
        web: [],
    })

    useEffect(() => {
        if (text.length < 2) {
            return
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
            // Each source on its own: one failing (DuckDuckGo refusing, say) doesn't hide the other.
            const settle = <T,>(promise: Promise<T[]>): Promise<T[]> => promise.catch(() => [])
            void Promise.all([
                settle(searchWikipedia(text, controller.signal)),
                settle(searchWeb(text, controller.signal)),
            ]).then(([wikipedia, web]) => {
                if (!controller.signal.aborted) {
                    setRemote({ for: text, wikipedia, web })
                }
            })
        }, PAUSE_MS)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [text])

    return useMemo(() => {
        const current = remote.for === text
        const seen = new Set(history.map((result) => result.url))
        const wikipedia = current ? remote.wikipedia.filter((result) => !seen.has(result.url)) : []
        wikipedia.forEach((result) => seen.add(result.url))
        const web = current ? remote.web.filter((result) => !seen.has(result.url)) : []
        return {
            history,
            wikipedia,
            web,
            loading: text.length >= 2 && !current,
            all: [...history, ...wikipedia, ...web],
        }
    }, [history, remote, text])
}
