// A paper's stories, for the broadsheet (NewspaperView) and the Reader: every story numbered in reading order,
// the story a "PAGE n" pointer leads to, short excerpts, and one story as a Reader article, with the part
// "continued on page n" joined on. Pure: types only from layout.ts, so the main bundle doesn't take in the layout
// code (that loads with PDF.js, when a paper opens). All text is escaped before it becomes HTML.

import type { Article } from '~/reader/extractArticle'

import type { Paper, PaperArticle } from './layout'

/** Every story in reading order; a story's number in Ben is its place here. */
export const allStories = (paper: Paper): PaperArticle[] => paper.sections.flatMap((s) => s.articles)

const words = (text: string): Set<string> => new Set(text.toLowerCase().match(/\p{L}{3,}/gu) ?? [])

/** The story on printed page `page` that best matches a title: most words in common, else the page's first. */
export function storyOn(stories: PaperArticle[], page: number, title: string): PaperArticle | null {
    const onPage = stories.filter((s) => s.page === page)
    const wanted = words(title)
    let best: PaperArticle | null = null
    let bestShared = 0
    for (const story of onPage) {
        const shared = [...words(story.title)].filter((w) => wanted.has(w)).length
        if (shared > bestShared) {
            best = story
            bestShared = shared
        }
    }
    return best ?? onPage[0] ?? null
}

/** Where a story goes on: the story on its "continued on" page, if it isn't the story itself. */
export function continuation(stories: PaperArticle[], story: PaperArticle): PaperArticle | null {
    if (story.continuesOn === null) {
        return null
    }
    const next = storyOn(stories, story.continuesOn, story.title)
    return next && next !== story ? next : null
}

/** The start of a story, about `length` characters, ending at a sentence. */
export function excerpt(story: PaperArticle, length: number): string {
    const text = story.paragraphs.join(' ')
    if (text.length <= length) {
        return text
    }
    const cut = text.slice(0, length)
    const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.” '))
    return sentenceEnd > length * 0.5 ? cut.slice(0, sentenceEnd + 1) : `${cut.replace(/\s+\S*$/, '')}…`
}

/** Minutes a story takes to read at an ordinary pace (about 230 words a minute), its continuation included. */
export function readingMinutes(stories: PaperArticle[], story: PaperArticle): number {
    const next = continuation(stories, story)
    const words = [...story.paragraphs, ...(next?.paragraphs ?? [])].join(' ').split(/\s+/).length
    return Math.max(1, Math.round(words / 230))
}

/** "Saurabh Trivedi · New Delhi": who wrote a story and where from, as a line under its headline. */
export function credit(story: PaperArticle): string | null {
    const place = story.dateline?.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase())
    return [story.byline, place].filter(Boolean).join(' · ') || null
}

const escape = (text: string): string =>
    text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** One story as a Reader article: its kicker, its text and, joined on, where it continues. */
export function storyArticle(paper: Paper, index: number, { url, site }: { url: string; site: string }): Article {
    const stories = allStories(paper)
    const story = stories[index] ?? stories[0]
    const html: string[] = []
    if (story.kicker) {
        html.push(`<p class="paper-label">${escape(story.kicker)}</p>`)
    }
    if (story.deck) {
        html.push(`<p class="paper-deck">${escape(story.deck)}</p>`)
    }
    html.push(...story.paragraphs.map((p) => `<p>${escape(p)}</p>`))
    const next = continuation(stories, story)
    if (next) {
        html.push(`<p class="paper-continues">Continued from page ${story.page} on page ${next.page}</p>`)
        html.push(...next.paragraphs.map((p) => `<p>${escape(p)}</p>`))
    }
    const section = paper.sections.find((s) => s.articles.includes(story))?.name
    return {
        url,
        title: story.title,
        byline: credit(story),
        site: [site, section, `page ${story.page}`].filter(Boolean).join(' · '),
        html: html.join('\n'),
        details: null,
    }
}
