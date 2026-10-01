// The Newspaper's reading comfort on Ben Island: an "Aa" button beside Contents. Its menu: text size (A− / A+,
// for the broadsheet and the story pages), the paper's tone, and an optional 20-20-20 reminder to rest the eyes.
// Same popover look as Ben's other menus; closes on a click anywhere else or Escape. Choices are remembered
// (comfortLogic).

import { useActions, useValues } from 'kea'
import { useEffect, useRef, useState } from 'react'

import { cn } from '~/desktop/cn'
import { PopoverFrame } from '~/desktop/ThemeMenu'

import { MAX_TEXT_STEP, MIN_TEXT_STEP, PaperTone, comfortLogic, textScale } from './comfortLogic'

const TONES: { value: PaperTone; label: string; swatch: string }[] = [
    { value: 'theme', label: 'Follow theme', swatch: 'linear-gradient(135deg, #efe7d4 50%, #23211d 50%)' },
    { value: 'cream', label: 'Cream', swatch: '#efe7d4' },
    { value: 'white', label: 'White', swatch: '#fbfaf7' },
    { value: 'soft-dark', label: 'Soft dark', swatch: '#3a3833' },
]

const ITEM = 'LemonButton LemonButton--tertiary LemonButton--small LemonButton--full-width'
const STEP = 'size-7 flex items-center justify-center rounded font-semibold text-primary hover:bg-hover disabled:opacity-35'

export function ComfortButton(): JSX.Element {
    const { comfort } = useValues(comfortLogic)
    const { setTextStep, setTone, setBreaks } = useActions(comfortLogic)
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)

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
                type="button"
                className="desktop-island-pill flex items-center h-7 px-3 rounded-full text-xs font-semibold text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-current"
                onClick={() => setOpen((isOpen) => !isOpen)}
                aria-haspopup="dialog"
                aria-expanded={open}
                title="Reading comfort"
                data-attr="newspaper-comfort"
            >
                <span className="font-serif text-[13px]">A</span>
                <span className="font-serif text-[10px]">a</span>
            </button>
            {open && (
                <PopoverFrame>
                    <div className="Popover__box w-72">
                        <div className="Popover__content" role="dialog" aria-label="Reading comfort">
                            <ul>
                                <li>
                                    <section>
                                        <h5>Text size</h5>
                                        <div className="flex items-center justify-between px-2 py-1">
                                            <button
                                                type="button"
                                                className={STEP}
                                                onClick={() => setTextStep(comfort.textStep - 1)}
                                                disabled={comfort.textStep <= MIN_TEXT_STEP}
                                                aria-label="Smaller text"
                                            >
                                                A−
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs text-secondary tabular-nums hover:text-primary"
                                                onClick={() => setTextStep(0)}
                                                title="Back to the standard size"
                                            >
                                                {Math.round(textScale(comfort.textStep) * 100)}%
                                            </button>
                                            <button
                                                type="button"
                                                className={cn(STEP, 'text-base')}
                                                onClick={() => setTextStep(comfort.textStep + 1)}
                                                disabled={comfort.textStep >= MAX_TEXT_STEP}
                                                aria-label="Larger text"
                                            >
                                                A+
                                            </button>
                                        </div>
                                    </section>
                                </li>
                                <li>
                                    <section>
                                        <h5>Paper</h5>
                                        <ul>
                                            {TONES.map((tone) => (
                                                <li key={tone.value}>
                                                    <button
                                                        type="button"
                                                        className={cn(ITEM, comfort.tone === tone.value && 'LemonButton--active')}
                                                        onClick={() => setTone(tone.value)}
                                                        aria-pressed={comfort.tone === tone.value}
                                                    >
                                                        <span className="LemonButton__chrome">
                                                            <span className="LemonButton__icon">
                                                                <span
                                                                    className="block size-3.5 rounded-full border border-[color-mix(in_oklab,currentColor_35%,transparent)]"
                                                                    style={{ background: tone.swatch }}
                                                                />
                                                            </span>
                                                            <span className="LemonButton__content">{tone.label}</span>
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </li>
                                <li>
                                    <section>
                                        <h5>Eyes</h5>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={comfort.breaks}
                                            className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded text-left hover:bg-hover"
                                            onClick={() => setBreaks(!comfort.breaks)}
                                        >
                                            <span
                                                className={cn(
                                                    'mt-0.5 size-4 shrink-0 flex items-center justify-center rounded border text-[11px] leading-none',
                                                    comfort.breaks ? 'bg-[var(--ben-accent)] border-transparent text-white' : 'border-[color-mix(in_oklab,currentColor_40%,transparent)]'
                                                )}
                                                aria-hidden
                                            >
                                                {comfort.breaks ? '✓' : ''}
                                            </span>
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-sm">Remind me to rest my eyes</span>
                                                <span className="text-[11px] leading-snug text-tertiary">
                                                    Every 20 minutes of reading, look far away for 20 seconds
                                                </span>
                                            </span>
                                        </button>
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
