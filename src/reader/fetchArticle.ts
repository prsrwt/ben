// Turns a link into a clean article: download the page (through Tauri's HTTP plugin, because the
// UI can't fetch other sites itself), find the article inside it with Mozilla Readability (the
// engine behind Firefox's Reader View), then strip anything unsafe with DOMPurify before Ben shows it.

import { Readability } from '@mozilla/readability'
import { fetch } from '@tauri-apps/plugin-http'
import DOMPurify from 'dompurify'

import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'

export interface Article {
    /** The page's final address, after redirects. */
    url: string
    title: string
    byline: string | null
    siteName: string | null
    /** Sanitised article HTML: no scripts, forms, embeds or inline styles. */
    html: string
}

/** Gives up on a server that doesn't answer within this long. */
const CONNECT_TIMEOUT_MS = 15_000

/** What the user typed, as a web address to open, or null if it isn't one ("hello", "mailto:…").
 *  A missing scheme gets https:// ("example.com/post" works). */
export function toArticleUrl(input: string): string | null {
    const text = input.trim()
    if (!text || /\s/.test(text)) {
        return null
    }
    const hasWebScheme = /^https?:\/\//i.test(text)
    // Some other scheme (mailto:, file:, javascript:…): not something the Reader opens.
    if (!hasWebScheme && /^[a-z][a-z\d+.-]*:/i.test(text)) {
        return null
    }
    try {
        const url = new URL(hasWebScheme ? text : `https://${text}`)
        // A bare word isn't a link: require a dotted host name.
        return url.hostname.includes('.') ? url.href : null
    } catch {
        return null
    }
}

/** Decodes the page in the character set it declares (header first, then <meta>), UTF-8 otherwise. */
function decodePage(bytes: ArrayBuffer, contentType: string): string {
    const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]
    const head = new TextDecoder('windows-1252').decode(bytes.slice(0, 4096))
    const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
    for (const label of [fromHeader, fromMeta]) {
        if (label) {
            try {
                return new TextDecoder(label).decode(bytes)
            } catch {
                // An encoding name the browser doesn't know: try the next.
            }
        }
    }
    return new TextDecoder().decode(bytes)
}

/** Downloads a page and extracts its article. Rejects with a message fit to show the user. */
export async function fetchArticle(url: string): Promise<Article> {
    if (!IS_DESKTOP_APP) {
        throw new Error('The Reader works in the Ben app, not in a browser tab.')
    }

    let response: Response
    try {
        response = await fetch(url, {
            headers: {
                // WebView2's own user agent (Edge's), so sites serve the same page a browser gets.
                'User-Agent': navigator.userAgent,
                Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'Accept-Language': navigator.languages.join(','),
            },
            connectTimeout: CONNECT_TIMEOUT_MS,
        })
    } catch {
        throw new Error("Couldn't reach this site. Check the link and your connection.")
    }
    if (!response.ok) {
        throw new Error(`The site answered with an error (${response.status}).`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !/html/i.test(contentType)) {
        throw new Error("This link isn't a web page, so there's no article to read.")
    }

    const pageUrl = response.url || url
    const doc = new DOMParser().parseFromString(decodePage(await response.arrayBuffer(), contentType), 'text/html')
    // Relative links and images resolve against the page's own address (or its own <base>), not Ben's.
    const base = doc.querySelector('base[href]') ?? doc.head.appendChild(doc.createElement('base'))
    base.setAttribute('href', new URL(base.getAttribute('href') ?? '', pageUrl).href)

    const parsed = new Readability(doc).parse()
    if (!parsed?.content) {
        throw new Error("Couldn't find an article on this page.")
    }

    return {
        url: pageUrl,
        title: parsed.title?.trim() || new URL(pageUrl).hostname,
        byline: parsed.byline?.trim() || null,
        siteName: parsed.siteName?.trim() || null,
        html: DOMPurify.sanitize(parsed.content, {
            FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe'],
            FORBID_ATTR: ['style'],
        }),
    }
}
