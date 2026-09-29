// The app's own native window (minimise / maximise / close). Tauri injects its bridge only when the
// UI runs inside the desktop app; in an ordinary browser tab (e.g. `npm run dev`) it's absent, so the
// menu bar hides its window controls there.

import { isTauri } from '@tauri-apps/api/core'
import { Window, getCurrentWindow } from '@tauri-apps/api/window'

export const IS_DESKTOP_APP = isTauri()

export const appWindow = (): Window => getCurrentWindow()
