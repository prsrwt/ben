// Matte-glass desktop icons. Each icon is a filled silhouette (24x24, with small cut-outs such as
// a door or text lines so it stays recognisable) used as a CSS mask (a stencil that hides
// everything outside the shape) on stacked layers: a faint shadow, the frost (blurs the wallpaper
// behind it), a hover sheen, and a hairline rim traced around the same shape. Styles: desktop.css.
// backdrop-filter only sees the real wallpaper if no ancestor has `filter`, `opacity` < 1 or `mask`
// (those isolate it), so hover effects on the icon button must avoid them.

import { CSSProperties, useMemo } from 'react'

import { AppId } from './apps'
import { cn } from './cn'

/** SVG bodies, drawn white on a 24×24 grid. Cut-outs use the even-odd rule inside one path. */
/** SVG bodies, drawn white on a 24×24 grid. Cut-outs use the even-odd rule inside one path. */
const SHAPES: Record<AppId, string> = {
    library: '<rect x="3" y="3.5" width="4.2" height="16.2" rx="1.2"/><rect x="8.3" y="6" width="4.2" height="13.7" rx="1.2"/><rect x="13.6" y="6.6" width="4.2" height="13.1" rx="1.2" transform="rotate(14 15.7 19.7)"/><rect x="2" y="20.4" width="20" height="1.9" rx=".95"/>',
    reader: '<path d="M2 5.3c0-.7.6-1.3 1.3-1.2 2.9.3 5.6 1.2 7.9 2.8v13.2c-2.3-1.5-5-2.4-7.9-2.7A1.4 1.4 0 0 1 2 16z"/><path d="M22 5.3c0-.7-.6-1.3-1.3-1.2-2.9.3-5.6 1.2-7.9 2.8v13.2c2.3-1.5 5-2.4 7.9-2.7A1.4 1.4 0 0 0 22 16z"/>',
    history: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-.9 4.9v5.1c0 .5.4.9.9.9h4.1a.9.9 0 0 0 0-1.8h-3.2V6.9a.9.9 0 0 0-1.8 0z"/>',
    newspaper: '<path fill-rule="evenodd" d="M4.5 3h11A2.5 2.5 0 0 1 18 5.5V21H4.5A2.5 2.5 0 0 1 2 18.5v-13A2.5 2.5 0 0 1 4.5 3zm1.5 3.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zm0 7.3a.9.9 0 0 0 0 1.8h9a.9.9 0 0 0 0-1.8zm0 3.4a.9.9 0 0 0 0 1.8h6a.9.9 0 0 0 0-1.8z"/><path d="M19.5 8h1A1.5 1.5 0 0 1 22 9.5v9a2.5 2.5 0 0 1-2.5 2.5z"/>',
    videos: '<path fill-rule="evenodd" d="M4.5 3.5h15A2.5 2.5 0 0 1 22 6v9.5a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 15.5V6a2.5 2.5 0 0 1 2.5-2.5zm5.5 4v7c0 .6.7 1 1.2.6l5-3.5a.7.7 0 0 0 0-1.2l-5-3.5c-.5-.4-1.2 0-1.2.6z"/><rect x="7" y="19.6" width="10" height="2" rx="1"/>',
    notes: '<path fill-rule="evenodd" d="M7.5 2h10A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 5 19.5v-15A2.5 2.5 0 0 1 7.5 2zm2.4 4.6a.9.9 0 0 0 0 1.8h5.2a.9.9 0 0 0 0-1.8zm0 4a.9.9 0 0 0 0 1.8h5.2a.9.9 0 0 0 0-1.8zm0 4a.9.9 0 0 0 0 1.8h3.2a.9.9 0 0 0 0-1.8z"/><rect x="2.5" y="5.5" width="1.6" height="2.4" rx=".8"/><rect x="2.5" y="10.8" width="1.6" height="2.4" rx=".8"/><rect x="2.5" y="16.1" width="1.6" height="2.4" rx=".8"/>',
    trash: '<rect x="9" y="1.8" width="6" height="2.4" rx="1.2"/><rect x="3" y="4.8" width="18" height="2.6" rx="1.3"/><path fill-rule="evenodd" d="M5 9h14l-1.1 11.2a2 2 0 0 1-2 1.8H8.1a2 2 0 0 1-2-1.8zm4.6 2.8a.9.9 0 0 0-.9.9v5.6a.9.9 0 0 0 1.8 0v-5.6a.9.9 0 0 0-.9-.9zm4.8 0a.9.9 0 0 0-.9.9v5.6a.9.9 0 0 0 1.8 0v-5.6a.9.9 0 0 0-.9-.9z"/>',
}

function maskStyle(id: AppId): CSSProperties {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">${SHAPES[id]}</svg>`
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    return {
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
    }
}

/** The same silhouette as a flat glyph in the current text colour, for small places such as the island. */
export function AppGlyph({ id, className }: { id: AppId; className?: string }): JSX.Element {
    const mask = useMemo(() => maskStyle(id), [id])
    return <span className={cn('block shrink-0 bg-current', className)} style={mask} aria-hidden />
}

export function GlassIcon({ id }: { id: AppId }): JSX.Element {
    const mask = useMemo(() => maskStyle(id), [id])
    return (
        <span className="relative block size-full">
            <span className="desktop-glass-icon__shadow absolute inset-0" style={mask} />
            <span className="desktop-glass-icon__frost absolute inset-0" style={mask} />
            <span className="desktop-glass-icon__sheen absolute inset-0" style={mask} />
            {/* Hairline rim: the same shape traced with a faint dark stroke, so pale glass still has
                an edge on pale wallpaper (like the hairline under Ben Island). SHAPES is our own
                static markup, so injecting it is safe. */}
            <svg
                viewBox="0 0 24 24"
                className="desktop-glass-icon__rim absolute inset-0 size-full overflow-visible"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: SHAPES[id] }}
            />
        </span>
    )
}
