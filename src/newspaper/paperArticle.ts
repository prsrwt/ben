// A whole paper as one Reader article, so it reads as a book with the Reader's pages and Contents: each section
// a chapter (h2), each story a heading under it (h3), so the Contents pill lists sections and headlines with
// their pages. Front-page pointers ("» PAGE 4") and "continued on page n" become links that turn to the story.
// Pure: builds the HTML from text, escaping all of it, so nothing from the PDF can become markup.

import type { Article } from '~/reader/extractArticle'

import { Paper, PaperArticle } from './layout'

const escape = (text: string): string =>
    text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const words = (text: string): Set<string> => new Set(text.toLowerCase().match(/\p{L}{3,}/gu) ?? [])

/** The story on printed page `page` that best matches a title: most words in common, else the page's first. */
function storyOn(stories: PaperArticle[], page: number, title: string): PaperArticle | null {
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

export function paperToArticle(paper: Paper, { url, title, site }: { url: string; title: string; site: string }): Article {
    const stories = paper.sections.flatMap((s) => s.articles)
    const ids = new Map(stories.map((story, i) => [story, `story-${i + 1}`]))
    const link = (story: PaperArticle | null, text: string): string =>
        story ? `<a href="#${ids.get(story)}">${escape(text)}</a>` : escape(text)

    const html: string[] = []
    paper.sections.forEach((section, i) => {
        html.push(`<h2 id="section-${i + 1}">${escape(section.name)}</h2>`)
        if (i === 0 && paper.teasers.length > 0) {
            html.push('<p class="paper-label">Inside</p><ul class="paper-inside">')
            for (const teaser of paper.teasers) {
                html.push(`<li>${link(storyOn(stories, teaser.page, teaser.title), teaser.title)}</li>`)
            }
            html.push('</ul>')
        }
        for (const story of section.articles) {
            if (story.kicker) {
                html.push(`<p class="paper-label">${escape(story.kicker)}</p>`)
            }
            html.push(`<h3 id="${ids.get(story)}">${escape(story.title)}</h3>`)
            html.push(...story.paragraphs.map((p) => `<p>${escape(p)}</p>`))
            if (story.continuesOn !== null) {
                const next = storyOn(stories, story.continuesOn, story.title)
                const target = next && next !== story ? next : null
                html.push(`<p class="paper-continues">${link(target, `Continued on page ${story.continuesOn}`)}</p>`)
            }
        }
    })
    return { url, title, byline: null, site, html: html.join('\n'), details: null }
}
