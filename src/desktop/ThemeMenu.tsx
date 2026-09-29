// The theme button on Ben Island and its dropdown: Light, Dark, or Sync with system. It renders the
// same structure and class names PostHog's LemonMenu did, styled by PostHog's own CSS
// (posthog-menu.css) and navigated with PostHog's keyboard hook, so it looks and behaves as before.
// Closes on a choice, a click anywhere else, or Escape.

import './posthog-menu.css'

import { useActions, useValues } from 'kea'
import { ReactNode, useEffect, useRef, useState } from 'react'

import { cn } from './cn'
import { IconBrightness, IconLaptop, IconPalette } from './icons'
import { ThemeMode, themeLogic } from './themeLogic'
import { useKeyboardNavigation } from './useKeyboardNavigation'

const OPTIONS: { value: ThemeMode; label: string; icon: JSX.Element }[] = [
    { value: 'light', label: 'Light', icon: <IconBrightness /> },
    { value: 'dark', label: 'Dark', icon: <IconPalette /> },
    { value: 'system', label: 'Sync with system', icon: <IconLaptop /> },
]

export function ThemeMenu(): JSX.Element {
    const { themeMode } = useValues(themeLogic)
    const { setThemeMode } = useActions(themeLogic)
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const activeIndex = OPTIONS.findIndex((option) => option.value === themeMode)
    const { referenceRef, itemsRef } = useKeyboardNavigation<HTMLButtonElement, HTMLButtonElement>(
        OPTIONS.length,
        activeIndex,
        { enabled: open }
    )

    useEffect(() => {
        if (!open) {
            return
        }
        const onPointerDown = (event: PointerEvent): void => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={referenceRef}
                type="button"
                className="size-7 flex items-center justify-center rounded text-secondary hover:text-primary hover:bg-hover focus-visible:outline-2 focus-visible:outline-current"
                aria-label="Theme"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((isOpen) => !isOpen)}
                data-attr="island-theme"
            >
                <IconPalette className="size-[18px]" />
            </button>
            {open && (
                <PopoverFrame>
                    <div className="Popover__box">
                        <div className="Popover__content" role="menu" aria-label="Theme">
                            <ul>
                                <li>
                                    <section>
                                        <h5>Theme</h5>
                                        <ul>
                                            {OPTIONS.map((option, index) => (
                                                <li key={option.value}>
                                                    <button
                                                        ref={itemsRef.current?.[index]}
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            setThemeMode(option.value)
                                                            setOpen(false)
                                                        }}
                                                        className={cn(
                                                            'LemonButton LemonButton--tertiary LemonButton--small LemonButton--full-width',
                                                            option.value === themeMode && 'LemonButton--active'
                                                        )}
                                                    >
                                                        <span className="LemonButton__chrome">
                                                            <span className="LemonButton__icon">{option.icon}</span>
                                                            <span className="LemonButton__content">{option.label}</span>
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </li>
                            </ul>
                        </div>
                    </div>
                </PopoverFrame>
            )}
        </div>
    )
}

/** Mirrors PostHog's Popover: mounted first, then marked "enter-active" on the next frame, so the
 *  box tilts and fades in. Mounted fresh on every open, so it always starts from the closed state.
 *  Sits under its button unless given another position (such as where a link was clicked). */
export function PopoverFrame({
    children,
    className = 'absolute right-0 top-full',
    style,
}: {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
}): JSX.Element {
    const [entered, setEntered] = useState(false)
    useEffect(() => {
        const frame = requestAnimationFrame(() => setEntered(true))
        return () => cancelAnimationFrame(frame)
    }, [])
    return (
        <div className={cn('ph-menu Popover', className, entered && 'Popover--enter-active')} style={style}>
            {children}
        </div>
    )
}
