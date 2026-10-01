// Finds the article inside a downloaded page with Mozilla Readability (the engine behind Firefox's
// Reader View), then strips anything unsafe with DOMPurify before Ben shows it. Plain DOM work with
// no app dependencies, so it can run (and be tested) anywhere there's a DOMParser.

import { Readability } from '@mozilla/readability'
import DOMPurify, { Config } from 'dompurify'

export interface Article {
    /** The page's final address, after redirects. */
    url: string
    title: string
    /** What to show above the title instead of the site's name (a paper from the Library: "Newspaper"). */
    site?: string
    byline: string | null
    /** Sanitised article HTML: no scripts, forms, embeds or inline styles. */
    html: string
    /** A summary table taken out of the article (Wikipedia's infobox), sanitised; shown collapsed. */
    details: string | null
}

const SANITIZE: Config = {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe'],
    FORBID_ATTR: ['style'],
}

/** Author lines that aren't a person, such as Wikipedia's "Contributors to Wikimedia projects". */
const NOT_A_PERSON = /^contributors to /i

/** Short blocks that only promote the site, not part of the article ("Follow Empire on Google"). */
const PROMOTION =
    /^(follow ([\w .&'-]+ )?on (google( news)?|x|twitter|facebook|instagram|threads|bluesky|linkedin|youtube|tiktok|whatsapp)|(sign up|subscribe) (to|for) (our|the) newsletter)\b/i

/** Word joiner: an invisible character that forbids a line break where it sits. */
const WORD_JOINER = '\u2060'

/** Small fixes to the extracted article, in place. */
function tidy(body: HTMLElement): void {
    // Site promotion: removed whole, with any logo beside it. Only short blocks, so real text is safe.
    for (const el of body.querySelectorAll<HTMLElement>('p, li, div, aside, section, a')) {
        const text = el.textContent?.trim() ?? ''
        if (el.isConnected && text.length < 80 && PROMOTION.test(text)) {
            el.remove()
        }
    }

    // Dividers before any text or image would sit right under the header's own line: a double rule.
    for (const hr of body.querySelectorAll('hr')) {
        const before = body.ownerDocument.createRange()
        before.setStart(body, 0)
        before.setEndBefore(hr)
        if (before.toString().trim() || before.cloneContents().querySelector('img')) {
            break
        }
        hr.remove()
    }

    // Citation markers stay on the line of the word they follow ("humanity.[55]", "[62][63]").
    for (const sup of body.querySelectorAll('sup')) {
        const prev = sup.previousSibling
        if (prev?.nodeType === Node.TEXT_NODE && prev.textContent && !/\s$/.test(prev.textContent)) {
            prev.textContent += WORD_JOINER
        } else if (prev instanceof Element && prev.tagName === 'SUP') {
            sup.before(WORD_JOINER)
        }
    }
}

/** Takes out Wikipedia's (and other MediaWiki sites') infobox, the summary table beside the article,
 *  before Readability sees it: left in, it lands in the middle of the text. Returns it sanitised. */
function takeInfobox(doc: Document): string | null {
    const boxes = [...doc.querySelectorAll<HTMLElement>('.infobox')].filter((box) => !box.parentElement?.closest('.infobox'))
    if (boxes.length === 0) {
        return null
    }
    for (const box of boxes) {
        // Readability only fixes relative addresses inside the article, so resolve these here.
        box.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => a.setAttribute('href', a.href))
        box.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
            img.setAttribute('src', img.src)
            img.removeAttribute('srcset')
        })
        box.remove()
    }
    return DOMPurify.sanitize(boxes.map((box) => box.outerHTML).join(''), SANITIZE)
}

/** The article in a page's HTML. Throws with a message fit to show the user if there isn't one. */
export function extractArticle(pageHtml: string, pageUrl: string): Article {
    const doc = new DOMParser().parseFromString(pageHtml, 'text/html')
    // Relative links and images resolve against the page's own address (or its own <base>), not Ben's.
    const base = doc.querySelector('base[href]') ?? doc.head.appendChild(doc.createElement('base'))
    base.setAttribute('href', new URL(base.getAttribute('href') ?? '', pageUrl).href)

    const details = takeInfobox(doc)
    const parsed = new Readability(doc).parse()
    if (!parsed?.content) {
        throw new Error("Couldn't find an article on this page.")
    }
    const byline = parsed.byline?.trim()
    const body = new DOMParser().parseFromString(parsed.content, 'text/html').body
    tidy(body)

    return {
        url: pageUrl,
        title: parsed.title?.trim() || new URL(pageUrl).hostname,
        byline: byline && !NOT_A_PERSON.test(byline) ? byline : null,
        html: DOMPurify.sanitize(body.innerHTML, SANITIZE),
        details,
    }
}
