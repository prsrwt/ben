// Your artwork. Drop files with these names into `public/desktop/` and they're picked up
// automatically; until then the desktop shows labelled placeholders in their place.

import { useEffect, useState } from 'react'

import { AppId } from './apps'

export const DESKTOP_ASSETS = {
    /** Full-screen background behind the windows. JPG or PNG, about 2560×1440. */
    background: '/desktop/background.jpg',
    /** Decorative scene in the bottom-right corner. Transparent PNG, about 800×900. */
    scene: '/desktop/scene.png',
    /** Your logo for the menu bar. SVG (or PNG at 256px+). */
    logo: '/desktop/logo.svg',
}

/** Optional custom desktop icons: public/desktop/icons/<app id>.png, 96×96 transparent PNG. */
export const iconAssetPath = (id: AppId): string => `/desktop/icons/${id}.png`

/** Whether an image exists at `src`: `null` while checking, then true/false. */
export function useImageAvailable(src: string): boolean | null {
    const [available, setAvailable] = useState<boolean | null>(null)

    useEffect(() => {
        let cancelled = false
        const image = new Image()
        image.onload = () => !cancelled && setAvailable(true)
        image.onerror = () => !cancelled && setAvailable(false)
        image.src = src
        return () => {
            cancelled = true
        }
    }, [src])

    return available
}
