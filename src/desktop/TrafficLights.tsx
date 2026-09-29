// Mac-style window buttons, in Windows order: yellow minimises, green maximises, and red closes at
// the far right, where Windows users reach for it. Symbols show on hover (desktop.css). Used by Ben
// Island for the app's own window, and by every window inside Ben.

interface TrafficLightsProps {
    onMinimise: () => void
    onMaximise: () => void
    onClose: () => void
    /** What the buttons control, for screen readers, e.g. "Library window". */
    label: string
}

const LIGHTS = [
    { key: 'minimise', text: 'Minimise', color: '#febc2e', glyph: 'M2.5 6h7' },
    { key: 'maximise', text: 'Maximise', color: '#28c840', glyph: 'M6 2.5v7M2.5 6h7' },
    { key: 'close', text: 'Close', color: '#ff5f57', glyph: 'M3 3l6 6M9 3l-6 6' },
] as const

export function TrafficLights({ onMinimise, onMaximise, onClose, label }: TrafficLightsProps): JSX.Element {
    const handlers = { minimise: onMinimise, maximise: onMaximise, close: onClose }
    return (
        <div className="ben-traffic-lights flex items-center gap-2" role="group" aria-label={label}>
            {LIGHTS.map((light) => (
                <button
                    key={light.key}
                    type="button"
                    aria-label={light.text}
                    onClick={handlers[light.key]}
                    data-attr={`traffic-${light.key}`}
                    className="ben-traffic-light size-3 rounded-full flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
                    style={{ backgroundColor: light.color }}
                >
                    <svg viewBox="0 0 12 12" className="size-2" aria-hidden>
                        <path d={light.glyph} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                    </svg>
                </button>
            ))}
        </div>
    )
}
