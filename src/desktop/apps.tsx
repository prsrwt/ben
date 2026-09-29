// Registry of desktop apps. Each app is one window with its own desktop icon. Every window opens at
// the same size (WINDOW_WIDTH / WINDOW_HEIGHT in windowsLogic.ts).
// They're all empty for now; each gets built out in its own phase.

export type AppId = 'library' | 'reader' | 'newspaper' | 'videos' | 'notes' | 'trash'

export interface DesktopApp {
    id: AppId
    title: string
    /** Which desktop column shows the icon. */
    side: 'left' | 'right'
}

export const APPS: Record<AppId, DesktopApp> = {
    library: { id: 'library', title: 'Library', side: 'left' },
    reader: { id: 'reader', title: 'Reader', side: 'left' },
    newspaper: { id: 'newspaper', title: 'Newspaper', side: 'left' },
    videos: { id: 'videos', title: 'Videos', side: 'left' },
    notes: { id: 'notes', title: 'Notes', side: 'left' },
    trash: { id: 'trash', title: 'Trash', side: 'left' },
}

export const APP_LIST: DesktopApp[] = Object.values(APPS)
