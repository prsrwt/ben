// A desktop shortcut: a frosted-glass icon (GlassIcon) with a label underneath.
// One click opens the app's window. Drop a PNG into public/desktop/icons/<app id>.png to replace one.

import { useActions } from 'kea'

import { DesktopApp } from './apps'
import { iconAssetPath, useImageAvailable } from './assets'
import { GlassIcon } from './GlassIcon'
import { windowsLogic } from './windowsLogic'

export function DesktopIcon({ app }: { app: DesktopApp }): JSX.Element {
    const { openApp } = useActions(windowsLogic)
    const hasCustomIcon = useImageAvailable(iconAssetPath(app.id))

    return (
        <button
            type="button"
            onClick={() => openApp(app.id)}
            className="group w-20 flex flex-col items-center gap-1 p-1 rounded-lg text-center focus-visible:outline-2 focus-visible:outline-white"
            data-attr={`desktop-icon-${app.id}`}
        >
            {/* No tile: a frosted-glass shape straight on the wallpaper. It lifts slightly on hover or
                keyboard focus, and its sheen brightens (desktop.css). Only `transform` here: opacity
                or filter on this wrapper would cut the frost off from the real wallpaper. */}
            <span className="size-11 flex items-center justify-center transition-transform duration-150 group-hover:-translate-y-0.5 group-active:translate-y-0">
                {hasCustomIcon ? (
                    <img src={iconAssetPath(app.id)} alt="" className="size-10 object-contain" />
                ) : (
                    <span className="size-10">
                        <GlassIcon id={app.id} />
                    </span>
                )}
            </span>
            <span className="text-xs font-semibold leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                {app.title}
            </span>
        </button>
    )
}
