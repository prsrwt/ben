// The browser engine's own right-click menu offers Back, Reload and Inspect, which make no sense in Ben (Reload
// wipes every open window), so it's off everywhere except text fields. Ben's own menus are in ContextMenu.tsx.

import { useEffect } from 'react'

/** Switches off the browser engine's own right-click menu everywhere except in text fields, where its
 *  Cut / Copy / Paste are what people expect. */
export function useNoBrowserMenu(): void {
    useEffect(() => {
        const onContextMenu = (event: MouseEvent): void => {
            const target = event.target instanceof Element ? event.target : null
            if (!target?.closest('input, textarea, [contenteditable="true"]')) {
                event.preventDefault()
            }
        }
        window.addEventListener('contextmenu', onContextMenu)
        return () => window.removeEventListener('contextmenu', onContextMenu)
    }, [])
}
