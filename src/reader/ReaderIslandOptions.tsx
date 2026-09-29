// The Reader's options on Ben Island (right of the search bar), shown while a Reader window is in front:
// back and forward. Alt+← / Alt+→ (either Alt key) and the mouse's side buttons do the same while it's shown.

import { useActions, useValues } from 'kea'
import { useEffect } from 'react'

import { readerLogic } from './readerLogic'

/** A small chevron, drawn inline; points left for back, right for forward. */
function Chevron({ direction }: { direction: 'left' | 'right' }): JSX.Element {
    return (
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={direction === 'left' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5'} />
        </svg>
    )
}

const BUTTON =
    'size-7 flex items-center justify-center rounded text-secondary enabled:hover:text-primary enabled:hover:bg-hover disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-current'

export function ReaderIslandOptions(): JSX.Element {
    const { canGoBack, canGoForward } = useValues(readerLogic)
    const { back, forward } = useActions(readerLogic)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            // Either Alt key: on layouts such as English (India) the right one is AltGr, which browsers
            // report as its own modifier rather than as Alt.
            const alt = event.altKey || event.getModifierState('AltGraph')
            if (alt && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                event.preventDefault()
                if (event.key === 'ArrowLeft') {
                    back()
                } else {
                    forward()
                }
            }
        }
        // Mouse side buttons: 3 is back, 4 is forward. Handled on release, where the browser would act.
        const onMouseUp = (event: MouseEvent): void => {
            if (event.button === 3 || event.button === 4) {
                event.preventDefault()
                if (event.button === 3) {
                    back()
                } else {
                    forward()
                }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [back, forward])

    return (
        <div className="flex items-center gap-0.5" role="group" aria-label="Reader">
            <button type="button" className={BUTTON} onClick={back} disabled={!canGoBack} title="Back (Alt+←)" aria-label="Back" data-attr="reader-back">
                <Chevron direction="left" />
            </button>
            <button type="button" className={BUTTON} onClick={forward} disabled={!canGoForward} title="Forward (Alt+→)" aria-label="Forward" data-attr="reader-forward">
                <Chevron direction="right" />
            </button>
        </div>
    )
}
