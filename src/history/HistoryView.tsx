// The History window: pages read in the Reader, newest first and grouped by day. Clicking one opens it
// in a new Reader window; each can be removed, or all cleared (after a confirming second click).

import { useActions, useValues } from 'kea'
import { useState } from 'react'

import { readerLogic } from '~/reader/readerLogic'

import { HistoryEntry, historyLogic } from './historyLogic'

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** "Today", "Yesterday", or the full date. */
function dayLabel(time: number): string {
    const day = new Date(time).setHours(0, 0, 0, 0)
    const today = new Date().setHours(0, 0, 0, 0)
    if (day === today) {
        return 'Today'
    }
    if (day === new Date(today).setDate(new Date(today).getDate() - 1)) {
        return 'Yesterday'
    }
    return new Date(time).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Entries (already newest first) split into runs of the same day. */
function byDay(entries: HistoryEntry[]): { label: string; entries: HistoryEntry[] }[] {
    const groups: { label: string; entries: HistoryEntry[] }[] = []
    for (const entry of entries) {
        const label = dayLabel(entry.visitedAt)
        if (groups.at(-1)?.label === label) {
            groups.at(-1)!.entries.push(entry)
        } else {
            groups.push({ label, entries: [entry] })
        }
    }
    return groups
}

function ClearAll(): JSX.Element {
    const { clear } = useActions(historyLogic)
    const [confirming, setConfirming] = useState(false)
    const button = 'px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-hover'

    return confirming ? (
        <span className="flex items-center gap-1 text-xs text-secondary">
            Clear all history?
            <button type="button" className={`${button} text-accent`} onClick={() => (clear(), setConfirming(false))}>
                Clear
            </button>
            <button type="button" className={`${button} text-secondary`} onClick={() => setConfirming(false)}>
                Cancel
            </button>
        </span>
    ) : (
        <button type="button" className={`${button} text-secondary`} onClick={() => setConfirming(true)} data-attr="history-clear">
            Clear all
        </button>
    )
}

export function HistoryView(): JSX.Element {
    const { entries } = useValues(historyLogic)
    const { remove } = useActions(historyLogic)
    const { openLinkInNewWindow } = useActions(readerLogic)

    if (entries.length === 0) {
        return (
            <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
                <h2 className="text-lg font-semibold m-0">No history yet</h2>
                <p className="text-tertiary text-sm m-0">Pages you read in the Reader appear here.</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto px-8 pb-10">
            <header className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold m-0">History</h2>
                <ClearAll />
            </header>
            {byDay(entries).map((group) => (
                <section key={group.label} className="mb-5">
                    <h3 className="m-0 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-tertiary">{group.label}</h3>
                    <ul className="m-0 p-0 list-none">
                        {group.entries.map((entry) => (
                            <li key={entry.id} className="group/entry relative flex items-center rounded-lg hover:bg-hover">
                                <button
                                    type="button"
                                    className="flex-1 min-w-0 flex items-baseline gap-3 px-3 py-2 text-left"
                                    onClick={() => openLinkInNewWindow(entry.url)}
                                    title={entry.url}
                                >
                                    {/* Wide enough for 12-hour times ("08:17 pm") on one line. */}
                                    <span className="shrink-0 w-16 whitespace-nowrap text-xs tabular-nums text-tertiary">
                                        {new Date(entry.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="min-w-0 truncate text-sm text-primary">{entry.title}</span>
                                    <span className="shrink-0 ml-auto text-xs text-tertiary">{hostOf(entry.url)}</span>
                                </button>
                                {/* Shown on hover or keyboard focus, so the list stays quiet. */}
                                <button
                                    type="button"
                                    className="shrink-0 mr-1.5 size-6 flex items-center justify-center rounded text-tertiary hover:text-primary opacity-0 group-hover/entry:opacity-100 focus-visible:opacity-100"
                                    onClick={() => remove(entry.id)}
                                    aria-label={`Remove ${entry.title} from history`}
                                    title="Remove from history"
                                >
                                    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                                        <path d="M4 4l8 8M12 4l-8 8" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}
