import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    // Tauri's desktop window loads the UI from this exact address (src-tauri/tauri.conf.json → devUrl),
    // so the dev server must not quietly move to another port if 5173 is busy.
    // It also mustn't watch the Rust side: Windows locks build output while cargo writes it, and
    // Vite's watcher crashes on a locked file (which took the whole dev app down).
    server: { port: 5173, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
    clearScreen: false,
    // "~/..." means src/... (matches "paths" in tsconfig.app.json).
    resolve: { alias: { '~': src('') } },
})
