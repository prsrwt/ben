// The page-turn animation, folded like paper (as Apple Books and Google Play Books do), not swung like a
// door. A crease sweeps from the outer edge of the turning page to the spine. Left of the crease the
// current pages still show; right of it the next page is revealed, with a soft shadow falling on it; the
// folded-over part of the sheet lies across the left side, showing the sheet's back: the next left page in
// two-page view, blank paper with the text showing faintly through in one-page view. Turning back is the
// same fold played in reverse.
//
// A web page can't take a picture of itself, so for the length of a turn the pages are drawn as copies of
// the article (each shifted to the right page). Every frame only moves layers, so nothing is laid out again.

import { useLayoutEffect, useRef } from 'react'

import { BookLayout, Flip, PAGE_GAP, TOP_MARGIN } from './useBook'

const DURATION = 520
/** How far the shadow on the revealed page reaches from the crease, and behind the flap's free edge. */
const CREASE_SHADOW = 56
const EDGE_SHADOW = 28

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** A copy of the article, shifted so that page `first` sits at the left of the pages showing. */
function pagesCopy(article: HTMLElement, first: number, stride: number): HTMLElement {
    const copy = article.cloneNode(true) as HTMLElement
    copy.style.transform = `translateX(${-first * stride}px)`
    copy.style.visibility = 'visible'
    copy.setAttribute('aria-hidden', 'true')
    copy.inert = true
    return copy
}

interface PageFlipProps {
    flip: Flip
    layout: BookLayout
    article: HTMLElement
    onDone: () => void
}

export function PageFlip({ flip, layout, article, onDone }: PageFlipProps): JSX.Element {
    const { pageWidth, pageHeight, perSpread, spreadWidth } = layout
    const stride = pageWidth + PAGE_GAP
    // Always drawn as a forward turn from pages `before` to pages `after`; turning back plays it reversed.
    const before = flip.direction === 1 ? flip.from : flip.to
    const after = flip.direction === 1 ? flip.to : flip.from
    // The sheet reaches from the spine to the outer edge (one-page view: the page's left edge is the spine).
    const spine = perSpread === 2 ? pageWidth + PAGE_GAP / 2 : 0
    const edge = spreadWidth

    const frontClip = useRef<HTMLDivElement>(null)
    const frontPages = useRef<HTMLDivElement>(null)
    const nextClip = useRef<HTMLDivElement>(null)
    const nextPages = useRef<HTMLDivElement>(null)
    const flap = useRef<HTMLDivElement>(null)
    const flapBack = useRef<HTMLDivElement>(null)
    const creaseShadow = useRef<HTMLDivElement>(null)
    const edgeShadow = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        // The pages before the turn, the pages after it, and the back of the sheet.
        frontPages.current?.replaceChildren(pagesCopy(article, before, stride))
        nextPages.current?.replaceChildren(pagesCopy(article, after, stride))
        if (perSpread === 2) {
            // The next left page, as it will lie once the sheet is down.
            flapBack.current?.replaceChildren(pagesCopy(article, after, stride))
        } else {
            // The same page seen from behind: mirrored, and faint through the paper.
            const through = pagesCopy(article, before, stride)
            through.style.transform += ' scaleX(-1)'
            through.style.transformOrigin = `${before * stride + pageWidth / 2}px 50%`
            flapBack.current?.replaceChildren(through)
        }

        /** Draws the fold with the crease at `crease` (from the spread's left edge). */
        const draw = (crease: number, lift: number): void => {
            // Left of the crease: the pages before. Right of it: the pages after.
            frontClip.current!.style.transform = `translateX(${crease - edge}px)`
            frontPages.current!.style.transform = `translateX(${edge - crease}px)`
            nextClip.current!.style.transform = `translateX(${crease}px)`
            nextPages.current!.style.transform = `translateX(${-crease}px)`
            // The folded part: the sheet beyond the crease, laid over to its left.
            flap.current!.style.left = `${2 * crease - edge}px`
            flap.current!.style.width = `${edge - crease}px`
            creaseShadow.current!.style.transform = `translateX(${crease}px)`
            creaseShadow.current!.style.opacity = String(lift)
            edgeShadow.current!.style.transform = `translateX(${2 * crease - edge - EDGE_SHADOW}px)`
            edgeShadow.current!.style.opacity = String(lift)
        }

        let frame = 0
        // The clock starts on the first frame shown, not before the copies were drawn, so no frames are skipped.
        let start = 0
        const step = (now: number): void => {
            start ||= now
            const t = Math.min(1, (now - start) / DURATION)
            // How far the turn has got, as a forward turn (backward runs it from the end).
            const progress = easeInOut(flip.direction === 1 ? t : 1 - t)
            draw(edge - (edge - spine) * progress, Math.sin(Math.PI * progress))
            if (t < 1) {
                frame = requestAnimationFrame(step)
            } else {
                onDone()
            }
        }
        draw(flip.direction === 1 ? edge : spine, 0)
        frame = requestAnimationFrame(step)
        return () => cancelAnimationFrame(frame)
        // One turn per mount: PageFlip is keyed by the flip.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const box = { width: edge, height: pageHeight }
    return (
        <div
            className="reader-fold absolute overflow-hidden pointer-events-none"
            style={{ left: layout.left, top: TOP_MARGIN, ...box }}
            aria-hidden
        >
            <div ref={nextClip} className="absolute inset-0 overflow-hidden">
                <div ref={nextPages} className="absolute inset-0" />
            </div>
            <div ref={creaseShadow} className="reader-fold__crease-shadow absolute inset-y-0" style={{ width: CREASE_SHADOW }} />
            <div ref={frontClip} className="absolute inset-0 overflow-hidden">
                <div ref={frontPages} className="absolute inset-0" />
            </div>
            <div ref={edgeShadow} className="reader-fold__edge-shadow absolute inset-y-0" style={{ width: EDGE_SHADOW }} />
            <div ref={flap} className="reader-fold__flap absolute inset-y-0 overflow-hidden">
                <div
                    ref={flapBack}
                    className={perSpread === 2 ? 'absolute inset-y-0 left-0' : 'reader-fold__through absolute inset-y-0 left-0'}
                    style={{ width: edge }}
                />
                <div className="reader-fold__flap-shade absolute inset-0" />
            </div>
        </div>
    )
}
