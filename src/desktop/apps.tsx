// Registry of desktop apps. Each app is one window with its own desktop icon. Every window opens at
// the same size (WINDOW_WIDTH / WINDOW_HEIGHT in windowsLogic.ts).
// The Reader and History are built; the rest are empty for now and get built out in their own phases.

export type AppId = 'library' | 'reader' | 'history' | 'newspaper' | 'videos' | 'notes' | 'trash'

export interface DesktopApp {
    id: AppId
    title: string
    /** Which desktop column shows the icon. */
    side: 'left' | 'right'
}

export const APPS: Record<AppId, DesktopApp> = {
    library: { id: 'library', title: 'Library', side: 'left' },
    reader: { id: 'reader', title: 'Reader', side: 'left' },
    history: { id: 'history', title: 'History', side: 'left' },
    newspaper: { id: 'newspaper', title: 'Newspaper', side: 'left' },
    videos: { id: 'videos', title: 'Videos', side: 'left' },
    notes: { id: 'notes', title: 'Notes', side: 'left' },
    trash: { id: 'trash', title: 'Trash', side: 'left' },
}

export const APP_LIST: DesktopApp[] = Object.values(APPS)
