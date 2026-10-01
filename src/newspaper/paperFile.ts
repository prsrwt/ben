// A newspaper PDF from the Library opens in the Reader like a link: its address is the file's own file:// URL,
// with the title the Library gave it ("?title=The Hindu, 26 September 2026"). These turn a Windows path into
// that address and back. No app dependencies, so they're cheap to import anywhere.

/** The Reader address for a paper on disk. */
export function paperUrl(path: string, title: string): string {
    const parts = path.split(/[\\/]/).filter(Boolean).map(encodeURIComponent)
    return `file:///${parts.join('/')}?title=${encodeURIComponent(title)}`
}

export const isPaperUrl = (url: string): boolean => url.startsWith('file:')

/** The file's path on disk (Windows style when it starts with a drive letter) and its title. */
export function paperFile(url: string): { path: string; title: string } {
    const address = new URL(url)
    const parts = address.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const windows = /^[a-z]:$/i.test(parts[0] ?? '')
    const path = windows ? parts.join('\\') : `/${parts.join('/')}`
    const title = address.searchParams.get('title') || (parts.at(-1) ?? '').replace(/\.pdf$/i, '')
    return { path, title }
}
