// A drawn scrollbar for a window's body. Browsers differ in whether they let a page restyle the
// built-in scrollbar (Edge's overlay scrollbars on Windows, for one, ignore it), so the window hides
// the built-in one and shows this instead, placed clear of the window's controls and rounded corners.
// Wheel, trackpad, touch and keyboard scrolling stay native; this handle follows the scroll position
// and can be dragged. It's decorative for assistive tech, which uses the native scrolling.

import { RefObject, useEffect, useRef } from 'react'

/** Gaps between the track and the window's edges, in px (the controls sit in the top gap). */
const TRACK_TOP = 72
const TRACK_BOTTOM = 40
const TRACK_RIGHT = 12
const MIN_THUMB = 32

export function WindowScrollbar({ scrollRef }: { scrollRef: RefObject<HTMLDivElement> }): JSX.Element {
    const trackRef = useRef<HTMLDivElement>(null)
    const thumbRef = useRef<HTMLDivElement>(null)
    // While dragging: the pointer's starting y and the scroll position at that moment.
    const drag = useRef<{ startY: number; startScroll: number } | null>(null)

    useEffect(() => {
        const body = scrollRef.current
        const track = trackRef.current
        const thumb = thumbRef.current
        if (!body || !track || !thumb) {
            return
        }

        // Position the thumb straight on the DOM, so scrolling doesn't re-render React.
        const update = (): void => {
            const { scrollTop, scrollHeight, clientHeight } = body
            const trackHeight = track.clientHeight
            const scrollable = scrollHeight - clientHeight
            if (scrollable <= 1 || trackHeight <= 0) {
                track.style.visibility = 'hidden'
                return
            }
            track.style.visibility = 'visible'
            const thumbHeight = Math.max(MIN_THUMB, (trackHeight * clientHeight) / scrollHeight)
            const thumbTop = ((trackHeight - thumbHeight) * scrollTop) / scrollable
            thumb.style.height = `${thumbHeight}px`
            thumb.style.transform = `translateY(${thumbTop}px)`
        }

        update()
        body.addEventListener('scroll', update, { passive: true })
        // Re-measure when the window is resized or its content changes height (e.g. switching tabs).
        const observer = new ResizeObserver(update)
        observer.observe(body)
        Array.from(body.children).forEach((child) => observer.observe(child))
        return () => {
            body.removeEventListener('scroll', update)
            observer.disconnect()
        }
    }, [scrollRef])

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
        const body = scrollRef.current
        if (!body) {
            return
        }
        e.preventDefault()
        drag.current = { startY: e.clientY, startScroll: body.scrollTop }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
        const body = scrollRef.current
        const track = trackRef.current
        const thumb = thumbRef.current
        if (!drag.current || !body || !track || !thumb) {
            return
        }
        // Moving the thumb by its free travel distance scrolls the whole scrollable distance.
        const travel = track.clientHeight - thumb.offsetHeight
        const scrollable = body.scrollHeight - body.clientHeight
        if (travel > 0) {
            body.scrollTop = drag.current.startScroll + ((e.clientY - drag.current.startY) * scrollable) / travel
        }
    }

    const endDrag = (): void => {
        drag.current = null
    }

    return (
        <div
            ref={trackRef}
            aria-hidden
            className="desktop-scrollbar absolute z-10 w-2"
            style={{ top: TRACK_TOP, bottom: TRACK_BOTTOM, right: TRACK_RIGHT, visibility: 'hidden' }}
        >
            <div
                ref={thumbRef}
                className="desktop-scrollbar__thumb absolute inset-x-0 top-0 rounded-full"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            />
        </div>
    )
}
