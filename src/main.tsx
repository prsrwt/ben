import '~/styles.css'
// Figtree (SIL Open Font Licence), bundled with the app rather than loaded from Google.
import '@fontsource-variable/figtree'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '~/App'
import { ThemeSync } from '~/ThemeSync'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeSync />
        <App />
    </StrictMode>
)
