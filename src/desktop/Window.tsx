// One desktop window: a matte-glass panel with a draggable top strip (traffic lights on the right),
// and a scrollable body.

import { useActions } from 'kea'
import { ReactNode, useRef } from 'react'

import { APPS } from './apps'
import { cn } from './cn'
import { TrafficLights } from './TrafficLights'
import { DESKTOP_TOP, MAXIMISED_GAP, WindowState, windowsLogic } from './windowsLogic'
import { WindowScrollbar } from './WindowScrollbar'

/** Always keep this much of a dragged window on screen, so it can be grabbed again. */
const MIN_VISIBLE = 120

interface WindowProps {
    state: WindowState
    zIndex: number
    isFocused: boolean
    /** Phone-sized screens: always full screen, no dragging. */
    isMobile: boolean
    children: ReactNode
}

export function Window({ state, zIndex, isFocused, isMobile, children }: WindowProps): JSX.Element {
    const { focusWindow, closeWindow, moveWindow, toggleMaximize, minimizeWindow } = useActions(windowsLogic)
    const app = APPS[state.appId]
    const fullScreen = state.maximized || isMobile
    // Where the pointer holds the window while dragging, from its top-left corner (at its own size).
    const dragOffset = useRef<{ x: number; y: number } | null>(null)
    const bodyRef = useRef<HTMLDivElement>(null)

    const onTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
        // Ignore drags that start on the buttons, and don't drag full-screen windows.
        if (fullScreen || (e.target as HTMLElement).closest('button')) {
            return
        }
        if (state.snapped) {
            // A snapped window drops back to its own size under the pointer, at the same relative spot
            // along its top, as Windows does when a snapped window is dragged away.
            const rect = e.currentTarget.closest('section')!.getBoundingClientRect()
            dragOffset.current = { x: ((e.clientX - rect.left) / rect.width) * state.width, y: e.clientY - rect.top }
        } else {
            dragOffset.current = { x: e.clientX - state.x, y: e.clientY - state.y }
        }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const onTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
        if (!dragOffset.current) {
            return
        }
        const x = Math.min(
            Math.max(e.clientX - dragOffset.current.x, MIN_VISIBLE - state.width),
            window.innerWidth - MIN_VISIBLE
        )
        const y = Math.min(Math.max(e.clientY - dragOffset.current.y, DESKTOP_TOP), window.innerHeight - 48)
        moveWindow(state.id, x, y)
    }

    const endDrag = (): void => {
        dragOffset.current = null
    }

    return (
        <section
            role="region"
            aria-label={app.title}
            data-attr={`window-${state.appId}`}
            // Minimised: hidden rather than removed, so whatever is inside keeps its state.
            hidden={state.minimized}
            // Clicking anywhere in a window brings it to the front.
            onPointerDownCapture={() => !isFocused && focusWindow(state.id)}
            className={cn(
                // Matte glass: a translucent, finely grained surface that softly blurs the wallpaper (desktop.css).
                'desktop-window desktop-glass absolute flex flex-col overflow-hidden',
                isMobile ? 'rounded-none' : 'rounded-3xl',
                // Deep, soft shadow for the front window; a lighter one for windows behind it.
                isFocused
                    ? 'shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35),0_4px_12px_rgba(0,0,0,0.08)]'
                    : 'shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]'
            )}
            style={
                isMobile
                    ? { zIndex, left: 0, right: 0, top: DESKTOP_TOP, bottom: 0 }
                    : fullScreen
                      ? // Maximised windows keep a small gap to the island and the screen edges.
                        {
                            zIndex,
                            left: MAXIMISED_GAP,
                            right: MAXIMISED_GAP,
                            top: DESKTOP_TOP + MAXIMISED_GAP,
                            bottom: MAXIMISED_GAP,
                        }
                      : state.snapped
                        ? // Side by side: half the desktop each, with the same gaps as a maximised window.
                          {
                              zIndex,
                              [state.snapped]: MAXIMISED_GAP,
                              top: DESKTOP_TOP + MAXIMISED_GAP,
                              bottom: MAXIMISED_GAP,
                              width: `calc(50% - ${MAXIMISED_GAP * 1.5}px)`,
                          }
                        : { zIndex, left: state.x, top: state.y, width: state.width, height: state.height }
            }
        >
            {/* No visible title: a transparent strip floating over the top of the content, to drag by,
                with the controls in the corner. Content scrolls up underneath it to the window's
                edge. The window's name is still announced to screen readers through the aria-label. */}
            <div
                // A plain arrow cursor, as on macOS and Windows title bars: no hand, even while dragging.
                className="absolute top-0 inset-x-0 z-10 flex items-center justify-end h-10 pl-4 pr-5 select-none"
                onPointerDown={onTitlePointerDown}
                onPointerMove={onTitlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={() => !isMobile && toggleMaximize(state.id)}
                data-attr="window-titlebar"
            >
                <TrafficLights
                    label={`${app.title} window`}
                    onMinimise={() => minimizeWindow(state.id)}
                    onMaximise={() => toggleMaximize(state.id)}
                    onClose={() => closeWindow(state.id)}
                />
            </div>
            {/* Full-height scroll area; the top padding matches the strip so content starts below the controls.
                Its built-in scrollbar is hidden in favour of WindowScrollbar. */}
            <div ref={bodyRef} className="desktop-window__body flex-1 min-h-0 overflow-auto pt-10">
                {children}
            </div>
            <WindowScrollbar scrollRef={bodyRef} />
        </section>
    )
}
