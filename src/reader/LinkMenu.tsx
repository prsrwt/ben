// The menu a middle-click on an article link shows, where it was clicked: open the link in a new Reader
// window, or side by side with this one. Same look and arrow keys as Ben's other menus. Closes on a choice,
// a click anywhere else, or Escape. Drawn over everything (a portal), so a window's edges never clip it.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { PopoverFrame } from '~/desktop/ThemeMenu'
import { useKeyboardNavigation } from '~/desktop/useKeyboardNavigation'

/** Roughly the menu's size, to keep it on screen near the edges. */
const MENU_WIDTH = 224
const MENU_HEIGHT = 96

interface LinkMenuProps {
    x: number
    y: number
    onNewWindow: () => void
    onSideBySide: () => void
    onClose: () => void
}

export function LinkMenu({ x, y, onNewWindow, onSideBySide, onClose }: LinkMenuProps): JSX.Element {
    const rootRef = useRef<HTMLDivElement>(null)
    const options = [
        { label: 'Open in new window', choose: onNewWindow },
        { label: 'Open side by side', choose: onSideBySide },
    ]
    const { itemsRef } = useKeyboardNavigation<HTMLButtonElement, HTMLButtonElement>(options.length, 0)

    useEffect(() => {
        // Keyboard users land on the first option, so the arrow keys work straight away.
        itemsRef.current?.[0].current?.focus()
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
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [itemsRef, onClose])

    const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8)
    const top = Math.min(y, window.innerHeight - MENU_HEIGHT - 8)

    return createPortal(
        <div ref={rootRef}>
            <PopoverFrame className="fixed" style={{ left, top, width: MENU_WIDTH }}>
                <div className="Popover__box">
                    <div className="Popover__content" role="menu" aria-label="Open link">
                        <ul>
                            {options.map((option, index) => (
                                <li key={option.label}>
                                    <button
                                        ref={itemsRef.current?.[index]}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => {
                                            onClose()
                                            option.choose()
                                        }}
                                        className="LemonButton LemonButton--tertiary LemonButton--small LemonButton--full-width"
                                    >
                                        <span className="LemonButton__chrome">
                                            <span className="LemonButton__content">{option.label}</span>
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
