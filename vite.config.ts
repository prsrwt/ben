import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { type Plugin, defineConfig } from 'vite'

const src = (path: string): string => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

/** PDF.js puts a space between two runs of text only when the gap is over 0.102 of the type size (below that it
 *  takes the gap for letter-spacing); some newspapers (the Indian Express) set words closer than that, so their words
 *  came out glued ("Inshadowofstudentdeaths"). Ben's copy of the PDF.js worker (src/newspaper/openPaper.ts) takes
 *  0.07 for both. Gaps inside a word are close to nothing, so words aren't split. */
function pdfWordSpaces(): Plugin {
    return {
        name: 'ben-pdfjs-word-spaces',
        transform(code, id) {
            if (id.includes('pdfjs-dist') && id.includes('pdf.worker')) {
                const patched = code
                    .replace('const TRACKING_SPACE_FACTOR = 0.102;', 'const TRACKING_SPACE_FACTOR = 0.07;')
                    .replace('const SPACE_IN_FLOW_MIN_FACTOR = 0.102;', 'const SPACE_IN_FLOW_MIN_FACTOR = 0.07;')
                if (!patched.includes('TRACKING_SPACE_FACTOR = 0.07') || !patched.includes('SPACE_IN_FLOW_MIN_FACTOR = 0.07')) {
                    this.warn('PDF.js word-space setting not found: words may come out glued in some papers')
                }
                return patched
            }
            return null
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    // pdfWordSpaces in both lists: the dev server serves the PDF.js worker through the main plugins, a build
    // bundles it as a worker, which takes its own.
    plugins: [react(), tailwindcss(), pdfWordSpaces()],
    worker: { format: 'es', plugins: () => [pdfWordSpaces()] },
    // Tauri's desktop window loads the UI from this exact address (src-tauri/tauri.conf.json → devUrl),
    // so the dev server must not quietly move to another port if 5173 is busy.
    // It also mustn't watch the Rust side: Windows locks build output while cargo writes it, and
    // Vite's watcher crashes on a locked file (which took the whole dev app down).
    server: { port: 5173, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
    clearScreen: false,
    // "~/..." means src/... (matches "paths" in tsconfig.app.json).
    resolve: { alias: { '~': src('') } },
})
