// Turns a link into a clean article: download the page through Tauri's HTTP plugin (the UI can't
// fetch other sites itself, browsers block cross-site requests), then extract the article from it.

import { fetch } from '@tauri-apps/plugin-http'

import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'

import { Article, extractArticle } from './extractArticle'

export type { Article } from './extractArticle'

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

/** How many in-page redirects to follow before giving up (they can loop). */
const MAX_PAGE_REDIRECTS = 3

/** Where a page forwards to, if it's only a stand-in: <meta http-equiv="refresh" content="0; url=…">,
 *  which browsers follow but HTTP clients don't. Pages that merely reload themselves (no url, or a
 *  long delay, as some news sites do) aren't redirects. */
function pageRedirect(html: string, pageUrl: string): string | null {
    const tag = /<meta[^>]+http-equiv=["']?refresh[^>]*>/i.exec(html)?.[0]
    const match = tag && /content=["']?\s*(\d+)\s*[;,]\s*url\s*=\s*['"]?([^"'>\s]+)/i.exec(tag)
    return match && Number(match[1]) <= 5 ? toArticleUrl(new URL(match[2], pageUrl).href) : null
}

/** Downloads one page: its address after redirects and its HTML. */
async function fetchPage(url: string): Promise<{ url: string; html: string }> {
    let response: Response
    try {
        response = await fetch(url, {
            headers: {
                // WebView2's own user agent (Edge's), so sites serve the same page a browser gets.
                'User-Agent': navigator.userAgent,
                Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'Accept-Language': navigator.languages.join(','),
                // No Origin header, as a browser opening a page sends none; some sites refuse requests with one.
                Origin: '',
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
    return { url: response.url || url, html: decodePage(await response.arrayBuffer(), contentType) }
}

/** Downloads a page and extracts its article. Rejects with a message fit to show the user. */
export async function fetchArticle(url: string): Promise<Article> {
    if (!IS_DESKTOP_APP) {
        throw new Error('The Reader works in the Ben app, not in a browser tab.')
    }
    let page = await fetchPage(url)
    for (let hops = 0; hops < MAX_PAGE_REDIRECTS; hops++) {
        const next = pageRedirect(page.html, page.url)
        if (!next) {
            break
        }
        page = await fetchPage(next)
    }
    return extractArticle(page.html, page.url)
}
