// A newspaper PDF from the Library has an address like a link: the file's own file:// URL, with what the Library
// knows about it ("?title=The Hindu, 17 September 2026&paper=The Hindu&date=2026-09-17"), and "&story=3" for one
// of its stories opened in the Reader. These turn a Windows path into that address and back. No app
// dependencies, so they're cheap to import anywhere.

export interface PaperFile {
    path: string
    /** "The Hindu, 17 September 2026", or the file's name. */
    title: string
    /** The paper's name ("The Hindu"), when the Library recognised it. */
    paper: string | null
    /** The day it was published, "2026-09-17", when the Library recognised it. */
    date: string | null
    /** One story, by its place in the paper (Reader); null for the whole paper. */
    story: number | null
}

/** The address for a paper on disk, or for one of its stories. */
export function paperUrl({ path, title, paper, date, story }: PaperFile): string {
    const parts = path.split(/[\\/]/).filter(Boolean).map(encodeURIComponent)
    const query = new URLSearchParams({ title })
    if (paper) {
        query.set('paper', paper)
    }
    if (date) {
        query.set('date', date)
    }
    if (story !== null) {
        query.set('story', String(story))
    }
    return `file:///${parts.join('/')}?${query.toString()}`
}

export const isPaperUrl = (url: string): boolean => url.startsWith('file:')

export function paperFile(url: string): PaperFile {
    const address = new URL(url)
    const parts = address.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const windows = /^[a-z]:$/i.test(parts[0] ?? '')
    const path = windows ? parts.join('\\') : `/${parts.join('/')}`
    const query = address.searchParams
    const story = query.get('story')
    return {
        path,
        title: query.get('title') || (parts.at(-1) ?? '').replace(/\.pdf$/i, ''),
        paper: query.get('paper'),
        date: query.get('date'),
        story: story !== null && /^\d+$/.test(story) ? Number(story) : null,
    }
}

/** "Thursday, 17 September 2026" for "2026-09-17"; null for anything else. */
export function longDate(date: string | null): string | null {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00`) : null
    return day && !isNaN(day.getTime())
        ? day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : null
}
