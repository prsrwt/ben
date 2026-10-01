// Reading comfort for the Newspaper, chosen from its "Aa" menu on Ben Island and remembered in localStorage
// (`ben.newspaper`): the text size (a step from the standard size, for the broadsheet and the story pages alike),
// the paper's tone, and whether to be reminded to rest the eyes (20-20-20: every 20 minutes of reading, look 20
// feet away for 20 seconds). The defaults are how the Newspaper looked before there was a choice.

import { MakeLogicType, actions, kea, listeners, path, reducers } from 'kea'

export type PaperTone = 'theme' | 'cream' | 'white' | 'soft-dark'

export interface Comfort {
    /** Steps from the standard text size, each 10%: -2 (80%) to +5 (150%). */
    textStep: number
    /** "theme": cream in light theme, dark newsprint in dark theme. */
    tone: PaperTone
    breaks: boolean
}

export const MIN_TEXT_STEP = -2
export const MAX_TEXT_STEP = 5

const STORAGE_KEY = 'ben.newspaper'
const DEFAULTS: Comfort = { textStep: 0, tone: 'theme', breaks: false }
const TONES: PaperTone[] = ['theme', 'cream', 'white', 'soft-dark']

function stored(): Comfort {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Comfort> | null
        return {
            textStep:
                typeof value?.textStep === 'number'
                    ? Math.min(MAX_TEXT_STEP, Math.max(MIN_TEXT_STEP, Math.round(value.textStep)))
                    : DEFAULTS.textStep,
            tone: TONES.includes(value?.tone as PaperTone) ? (value!.tone as PaperTone) : DEFAULTS.tone,
            breaks: typeof value?.breaks === 'boolean' ? value.breaks : DEFAULTS.breaks,
        }
    } catch {
        // Storage unavailable or the saved value damaged: the defaults.
        return DEFAULTS
    }
}

/** How much larger than standard the text is: 1.1 for one step up. */
export const textScale = (step: number): number => 1 + step * 0.1

export interface comfortLogicValues {
    comfort: Comfort
}

export interface comfortLogicActions {
    setTextStep: (step: number) => { step: number }
    setTone: (tone: PaperTone) => { tone: PaperTone }
    setBreaks: (on: boolean) => { on: boolean }
}

export type comfortLogicType = MakeLogicType<comfortLogicValues, comfortLogicActions>

export const comfortLogic = kea<comfortLogicType>([
    path(['newspaper', 'comfortLogic']),
    actions({
        setTextStep: (step: number) => ({ step: Math.min(MAX_TEXT_STEP, Math.max(MIN_TEXT_STEP, step)) }),
        setTone: (tone: PaperTone) => ({ tone }),
        setBreaks: (on: boolean) => ({ on }),
    }),
    reducers({
        comfort: [
            stored(),
            {
                setTextStep: (state, { step }) => ({ ...state, textStep: step }),
                setTone: (state, { tone }) => ({ ...state, tone }),
                setBreaks: (state, { on }) => ({ ...state, breaks: on }),
            },
        ],
    }),
    listeners(({ values }) => {
        const save = (): void => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(values.comfort))
            } catch {
                // Storage can be unavailable; the choice then lasts until Ben closes.
            }
        }
        return { setTextStep: save, setTone: save, setBreaks: save }
    }),
])
