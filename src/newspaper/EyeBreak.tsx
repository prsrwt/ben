// The 20-20-20 reminder, when turned on in the Newspaper's "Aa" menu: after 20 minutes of reading (time with the
// Newspaper or a Reader window in front and Ben on screen), a quiet glass card asks to look at something about
// 20 feet (6 metres) away for 20 seconds, counting the seconds down. It goes by itself, or with "Skip", and the
// count starts again. Time away from Ben, or in other apps' windows, doesn't count.

import { useValues } from 'kea'
import { useEffect, useState } from 'react'

import { windowsLogic } from '~/desktop/windowsLogic'

import { comfortLogic } from './comfortLogic'

const READING_SECONDS = 20 * 60
const REST_SECONDS = 20

export function EyeBreak(): JSX.Element | null {
    const { comfort } = useValues(comfortLogic)
    // Turned off, the reminder is gone, and the time counted with it.
    return comfort.breaks ? <Reminder /> : null
}

function Reminder(): JSX.Element | null {
    const { focusedWindow } = useValues(windowsLogic)
    const reading = focusedWindow?.appId === 'newspaper' || focusedWindow?.appId === 'reader'
    // Seconds read since the last rest, and the seconds of rest left (null while reading).
    const [clock, setClock] = useState<{ read: number; rest: number | null }>({ read: 0, rest: null })

    // Once a second: count a second of reading (a reading window in front, Ben on screen), or of rest.
    useEffect(() => {
        const timer = window.setInterval(() => {
            setClock(({ read, rest }) => {
                if (rest !== null) {
                    return { read: 0, rest: rest > 1 ? rest - 1 : null }
                }
                if (!reading || document.visibilityState !== 'visible') {
                    return { read, rest }
                }
                return read + 1 >= READING_SECONDS ? { read: 0, rest: REST_SECONDS } : { read: read + 1, rest: null }
            })
        }, 1000)
        return () => window.clearInterval(timer)
    }, [reading])

    if (clock.rest === null) {
        return null
    }
    return (
        <div
            role="status"
            className="desktop-glass fixed left-1/2 bottom-8 -translate-x-1/2 z-[9000] flex items-center gap-4 pl-5 pr-3 py-3 rounded-2xl shadow-[0_18px_48px_-12px_rgba(0,0,0,0.35)]"
        >
            <span className="text-2xl font-semibold tabular-nums w-8 text-center">{clock.rest}</span>
            <span className="flex flex-col">
                <span className="text-sm font-semibold">Rest your eyes</span>
                <span className="text-xs text-secondary">Look at something about 6 metres (20 feet) away until the count ends.</span>
            </span>
            <button
                type="button"
                className="ml-2 px-3 py-1 rounded-lg text-xs font-semibold text-secondary hover:text-primary hover:bg-hover"
                onClick={() => setClock({ read: 0, rest: null })}
            >
                Skip
            </button>
        </div>
    )
}
