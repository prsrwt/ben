// Ben's own right-click menu (also what a middle-click on a link shows), drawn where it was opened with the
// same look and arrow keys as Ben's other menus. Closes on a choice, a click anywhere else, or Escape. Drawn
// over everything (a portal), so a window's edges never clip it. The browser engine's own menu is switched off
// app-wide (useNoBrowserMenu.ts): its Reload would wipe every open window.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cn } from './cn'
import { PopoverFrame } from './ThemeMenu'
import { useKeyboardNavigation } from './useKeyboardNavigation'

export interface MenuItem {
    label: string
    /** A shortcut shown on the right, e.g. "Ctrl+click". */
    hint?: string
    disabled?: boolean
    /** Starts a new group, with a divider above it. */
    divider?: boolean
    choose: () => void
}

export interface MenuAt {
    x: number
    y: number
    items: MenuItem[]
}

const MENU_WIDTH = 248
const ROW_HEIGHT = 34

export function ContextMenu({ x, y, items, onClose }: MenuAt & { onClose: () => void }): JSX.Element {
    const rootRef = useRef<HTMLDivElement>(null)
    const { itemsRef } = useKeyboardNavigation<HTMLButtonElement, HTMLButtonElement>(items.length, 0)

    useEffect(() => {
        // Keyboard users land on the first option, so the arrow keys work straight away.
        itemsRef.current?.[0]?.current?.focus()
        const onPointerDown = (event: PointerEvent): void => {
            if (!rootRef.current?.contains(event.target as Node)) {
                onClose()
            }
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                onClose()
            }
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        window.addEventListener('blur', onClose)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('blur', onClose)
        }
    }, [itemsRef, onClose])

    // Kept on screen near the right and bottom edges.
    const height = items.length * ROW_HEIGHT + items.filter((item) => item.divider).length * 9 + 12
    const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8))
    const top = Math.max(8, Math.min(y, window.innerHeight - height - 8))

    return createPortal(
        <div ref={rootRef} onContextMenu={(e) => e.preventDefault()}>
            <PopoverFrame className="fixed" style={{ left, top, width: MENU_WIDTH, zIndex: 1400 }}>
                <div className="Popover__box">
                    <div className="Popover__content" role="menu">
                        <ul>
                            {items.map((item, index) => (
                                <li key={item.label} className={cn(item.divider && 'mt-1 pt-1 border-t border-subtle')}>
                                    <button
                                        ref={itemsRef.current?.[index]}
                                        type="button"
                                        role="menuitem"
                                        disabled={item.disabled}
                                        onClick={() => {
                                            onClose()
                                            item.choose()
                                        }}
                                        className="LemonButton LemonButton--tertiary LemonButton--small LemonButton--full-width disabled:opacity-40"
                                    >
                                        <span className="LemonButton__chrome">
                                            <span className="LemonButton__content gap-3">
                                                <span className="min-w-0 truncate">{item.label}</span>
                                                {item.hint && (
                                                    <span className="ml-auto shrink-0 text-xs text-tertiary">{item.hint}</span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </PopoverFrame>
        </div>,
        document.body
    )
}
