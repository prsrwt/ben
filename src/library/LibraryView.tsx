// The Library window. First run: "Where do you keep your study material?" (suggested folders with how many
// documents each holds, plus any other folder) and the student's name, to spot their own work. After that:
// subjects down the side, and the chosen subject's files on shelves by kind (notes, slides, question papers…),
// with "Needs you" first for files Ben couldn't place; newspapers newest first, with their dates. Clicking a file
// opens it (newspaper PDFs as broadsheets in the Newspaper window, other PDFs and photos inside Ben, the rest in
// their usual program); its kind and subject can be corrected from its menu. Files are only read.

import { convertFileSrc } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { open as chooseFolder } from '@tauri-apps/plugin-dialog'
import { useActions, useValues } from 'kea'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { cn } from '~/desktop/cn'
import { ContextMenu, MenuAt, MenuItem } from '~/desktop/ContextMenu'
import { IS_DESKTOP_APP } from '~/desktop/nativeWindow'
import { newspaperLogic } from '~/newspaper/newspaperLogic'

import { FileKind, KIND_LABELS } from './classify'
import { FolderSuggestion, openInProgram, suggestFolders } from './libraryApi'
import { LibraryItem, libraryLogic } from './libraryLogic'

/** Shelf order: what a student reaches for most, first. */
const SHELF_ORDER: FileKind[] = [
    'notes',
    'slides',
    'question-paper',
    'answer-key',
    'syllabus',
    'book',
    'material',
    'assignment',
    'lab-file',
    'project',
    'newspaper',
    'dpp',
    'mock-test',
    'guide',
    'personal',
    'photo',
]
/** Shelves shown closed until clicked: they hold more than study material (forms, ordinary photos). */
const COLLAPSED: FileKind[] = ['personal', 'photo']
const VIEWABLE = /\.(pdf|jpe?g|png|webp|bmp)$/i

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-semibold'

/** A newspaper PDF, read as a broadsheet in the Newspaper window. */
const isPaper = (item: LibraryItem): boolean => item.recognised.kind === 'newspaper' && /\.pdf$/i.test(item.file.name)

/** A recognised publication date ("2026-09-17") as a Date, or null. */
function paperDay(item: LibraryItem): Date | null {
    const { date } = item.recognised
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00`) : null
    return day && !isNaN(day.getTime()) ? day : null
}

/** "The Hindu, 17 September 2026" when the paper and date were recognised, else the file's title. */
function paperTitle(item: LibraryItem): string {
    const { paper } = item.recognised
    const when = paperDay(item)?.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) ?? item.recognised.date
    return paper ? (when ? `${paper}, ${when}` : paper) : item.title
}

/** Shelf order: newspapers newest first (undated ones last), everything else by title. */
const shelfOrder = (kind: FileKind) => (a: LibraryItem, b: LibraryItem): number =>
    kind === 'newspaper'
        ? (paperDay(b)?.getTime() ?? 0) - (paperDay(a)?.getTime() ?? 0) || a.title.localeCompare(b.title)
        : a.title.localeCompare(b.title)

export function LibraryView(): JSX.Element {
    const { loaded, settings } = useValues(libraryLogic)
    if (!IS_DESKTOP_APP) {
        return <Notice title="Library" text="The Library reads files on your PC, so it works in the Ben app, not in a browser tab." />
    }
    if (!loaded) {
        return <Notice title="Library" text="Opening…" />
    }
    return settings.setUp ? <Shelves /> : <Setup />
}

function Notice({ title, text }: { title: string; text: string }): JSX.Element {
    return (
        <div className="h-full min-h-60 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <h2 className="text-lg font-semibold m-0">{title}</h2>
            <p className="text-tertiary text-sm m-0 max-w-sm">{text}</p>
        </div>
    )
}

const folderLabel = (folder: string): string => folder.split(/[\\/]/).filter(Boolean).slice(-2).join(' › ')

/** First run, and later "Folders": where study material is kept, and the student's name. */
function Setup({ onDone }: { onDone?: () => void }): JSX.Element {
    const { settings } = useValues(libraryLogic)
    const { finishSetup, setFolders, setIdentity } = useActions(libraryLogic)
    const [suggestions, setSuggestions] = useState<FolderSuggestion[] | null>(null)
    const [chosen, setChosen] = useState<string[]>(settings.folders)
    const [extra, setExtra] = useState<string[]>(settings.folders)
    const [name, setName] = useState(settings.identity.name)
    const [rolls, setRolls] = useState(settings.identity.rollNumbers.join(', '))

    useEffect(() => {
        void suggestFolders().then((found) => {
            setSuggestions(found)
            // First run: tick every suggestion that holds documents; the student unticks what isn't theirs.
            if (!settings.setUp) {
                setChosen(found.filter((folder) => folder.files > 0).map((folder) => folder.path))
            }
        })
        if (!settings.identity.name) {
            // The Windows account name ("Paras") is a good first guess.
            void homeDir().then((home) => setName(home.split(/[\\/]/).filter(Boolean).at(-1) ?? ''))
        }
    }, [settings.setUp, settings.identity.name])

    const toggle = (folder: string): void =>
        setChosen((current) => (current.includes(folder) ? current.filter((f) => f !== folder) : [...current, folder]))

    const addFolder = async (): Promise<void> => {
        const picked = await chooseFolder({ directory: true, title: 'Choose a folder with study material' })
        if (typeof picked === 'string' && !chosen.includes(picked)) {
            setExtra((current) => [...current, picked])
            setChosen((current) => [...current, picked])
        }
    }

    const done = (): void => {
        const identity = { name: name.trim(), rollNumbers: rolls.split(/[\s,]+/).filter(Boolean) }
        if (settings.setUp) {
            setIdentity(identity)
            setFolders(chosen)
        } else {
            finishSetup(chosen, identity)
        }
        onDone?.()
    }

    const rows = [
        ...(suggestions ?? []).map((s) => ({ path: s.path, label: s.label, detail: `${s.files >= 2000 ? '2,000+' : s.files} documents` })),
        ...extra
            .filter((path) => !suggestions?.some((s) => s.path === path))
            .map((path) => ({ path, label: folderLabel(path), detail: path })),
    ]

    return (
        <div className="max-w-xl mx-auto px-8 pb-10">
            <h2 className="text-xl font-semibold m-0 mb-1">Where do you keep your study material?</h2>
            <p className="text-sm text-secondary m-0 mb-5">
                Ben finds your notes, slides, question papers and books there and puts them on shelves. Your files stay exactly where they are: Ben only reads them.
            </p>
            <div className="flex flex-col gap-1 mb-3">
                {suggestions === null && <p className="text-sm text-tertiary m-0">Looking around your PC…</p>}
                {rows.map((row) => (
                    <label key={row.path} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-hover cursor-default">
                        <input type="checkbox" checked={chosen.includes(row.path)} onChange={() => toggle(row.path)} className="size-4 accent-[var(--ben-accent)]" />
                        <span className="text-sm font-semibold">{row.label}</span>
                        <span className="ml-auto text-xs text-tertiary truncate max-w-[55%]" title={row.path}>
                            {row.detail}
                        </span>
                    </label>
                ))}
            </div>
            <button type="button" className={cn(BUTTON, 'text-secondary hover:bg-hover mb-6')} onClick={() => void addFolder()}>
                + Add another folder
            </button>

            <h3 className="text-sm font-semibold m-0 mb-2">Your name and roll number</h3>
            <p className="text-xs text-tertiary m-0 mb-2">So Ben can tell your own assignments and lab files from material others shared.</p>
            <div className="flex gap-2 mb-6">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-hover text-sm outline-none" />
                <input value={rolls} onChange={(e) => setRolls(e.target.value)} placeholder="Roll number(s)" className="w-40 px-3 py-1.5 rounded-lg bg-hover text-sm outline-none" />
            </div>

            <div className="flex gap-2">
                <button type="button" disabled={chosen.length === 0} className={cn(BUTTON, 'text-white bg-[var(--ben-accent)] disabled:opacity-40')} onClick={done}>
                    {settings.setUp ? 'Save' : 'Put my files on shelves'}
                </button>
                {onDone && (
                    <button type="button" className={cn(BUTTON, 'text-secondary hover:bg-hover')} onClick={onDone}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    )
}

function Shelves(): JSX.Element {
    const { items, subjects, progress, settings } = useValues(libraryLogic)
    const { correct } = useActions(libraryLogic)
    const { openPaper } = useActions(newspaperLogic)
    const [subject, setSubject] = useState<string | null>(null)
    const [showFolders, setShowFolders] = useState(false)
    const [viewing, setViewing] = useState<LibraryItem | null>(null)
    const [menu, setMenu] = useState<MenuAt | null>(null)
    const closeMenu = useCallback(() => setMenu(null), [])

    const study = useMemo(() => items.filter((item) => item.recognised.kind !== 'not-study'), [items])
    const needsYou = study.filter((item) => item.recognised.kind === 'unsure')
    const shown = study.filter(
        (item) => item.recognised.kind !== 'unsure' && (subject === null || (subject === '' ? !item.recognised.subject : item.recognised.subject === subject))
    )
    const count = (s: string | null): number =>
        study.filter((item) => item.recognised.kind !== 'unsure' && (s === null || (s === '' ? !item.recognised.subject : item.recognised.subject === s))).length

    if (showFolders) {
        return <Setup onDone={() => setShowFolders(false)} />
    }
    if (viewing) {
        return <Viewer item={viewing} onClose={() => setViewing(null)} />
    }

    const openItem = (item: LibraryItem): void => {
        if (isPaper(item)) {
            openPaper({ path: item.file.path, title: paperTitle(item), paper: item.recognised.paper ?? null, date: item.recognised.date ?? null, story: null })
        } else if (VIEWABLE.test(item.file.name)) {
            setViewing(item)
        } else {
            void openInProgram(item.file.path)
        }
    }

    // The file's menu: open it, or put it right (another kind, another subject).
    const itemMenu = (item: LibraryItem, x: number, y: number): void => {
        const kinds: MenuItem[] = SHELF_ORDER.filter((kind) => kind !== item.recognised.kind).map((kind, i) => ({
            label: `Move to ${KIND_LABELS[kind]}`,
            divider: i === 0,
            choose: () => correct(item.key, { kind }),
        }))
        const subjectItems: MenuItem[] = subjects
            .filter((s) => s !== item.recognised.subject)
            .map((s, i) => ({ label: `Subject: ${s}`, divider: i === 0, choose: () => correct(item.key, { subject: s }) }))
        setMenu({
            x,
            y,
            items: [
                { label: 'Open', choose: () => openItem(item) },
                ...(isPaper(item) ? [{ label: 'Open the PDF', choose: () => setViewing(item) }] : []),
                ...(VIEWABLE.test(item.file.name) ? [{ label: 'Open in its program', choose: () => void openInProgram(item.file.path) }] : []),
                ...subjectItems,
                ...kinds,
                { label: 'Not study material', divider: true, choose: () => correct(item.key, { kind: 'not-study' }) },
            ],
        })
    }

    const row = (item: LibraryItem): JSX.Element => {
        const formats = [...new Set(item.files.map((f) => f.name.split('.').pop()?.toUpperCase()))].join(' + ')
        const copies = item.files.length - new Set(item.files.map((f) => f.name.split('.').pop())).size
        return (
            <li key={item.key}>
                <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-hover cursor-default"
                    onClick={() => openItem(item)}
                    onContextMenu={(e) => {
                        e.preventDefault()
                        itemMenu(item, e.clientX, e.clientY)
                    }}
                    title={item.files.map((f) => f.path).join('\n')}
                >
                    <span className="shrink-0 w-12 text-[10px] font-bold tracking-wide text-tertiary">{formats}</span>
                    <span className="min-w-0 truncate text-sm text-primary">{item.recognised.kind === 'newspaper' && item.recognised.paper ? item.recognised.paper : item.title}</span>
                    {item.recognised.mine && <span className="shrink-0 px-1.5 rounded text-[10px] font-semibold text-accent bg-hover">Mine</span>}
                    {copies > 0 && <span className="shrink-0 text-[10px] text-tertiary">{copies + 1} copies</span>}
                    <span className="ml-auto shrink-0 text-xs text-tertiary">
                        {subject === null && item.recognised.subject ? `${item.recognised.subject} · ` : ''}
                        {item.recognised.kind === 'newspaper' && paperDay(item)
                            ? `${paperDay(item)!.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · `
                            : ''}
                        {item.file.pages ? `${item.file.pages} p` : ''}
                    </span>
                </button>
            </li>
        )
    }

    return (
        <div className="h-full flex min-h-0">
            <nav className="w-52 shrink-0 overflow-y-auto px-3 pb-6 border-r border-subtle" aria-label="Subjects">
                {[null, ...subjects, ''].map((s) => (
                    <button
                        key={s ?? 'all'}
                        type="button"
                        onClick={() => setSubject(s)}
                        className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm cursor-default',
                            subject === s ? 'bg-hover text-primary font-semibold' : 'text-secondary hover:bg-hover'
                        )}
                    >
                        <span className="truncate">{s === null ? 'Everything' : s === '' ? 'No subject' : s}</span>
                        <span className="ml-auto text-xs text-tertiary">{count(s)}</span>
                    </button>
                ))}
            </nav>
            <div className="flex-1 min-w-0 overflow-y-auto px-6 pb-10">
                <header className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-semibold m-0">{subject === null ? 'Library' : subject || 'No subject'}</h2>
                    {progress && (
                        <span className="text-xs text-tertiary">
                            Reading files… {progress.done} of {progress.total}
                        </span>
                    )}
                    <button type="button" className={cn(BUTTON, 'ml-auto text-secondary hover:bg-hover')} onClick={() => setShowFolders(true)} title={settings.folders.join('\n')}>
                        Folders
                    </button>
                </header>
                {needsYou.length > 0 && subject === null && (
                    <section className="mb-6 p-3 rounded-xl bg-hover">
                        <h3 className="m-0 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-accent">Needs you · {needsYou.length}</h3>
                        <p className="m-0 mb-2 px-3 text-xs text-secondary">Ben couldn't tell what these are. Right-click one to put it on a shelf.</p>
                        <ul className="m-0 p-0 list-none">{needsYou.map(row)}</ul>
                    </section>
                )}
                {SHELF_ORDER.map((kind) => {
                    const shelf = shown.filter((item) => item.recognised.kind === kind)
                    if (shelf.length === 0) {
                        return null
                    }
                    if (COLLAPSED.includes(kind)) {
                        return (
                            <details key={kind} className="mb-5">
                                <summary className="px-3 text-xs font-semibold uppercase tracking-wide text-tertiary cursor-default">
                                    {KIND_LABELS[kind]} · {shelf.length}
                                </summary>
                                <ul className="m-0 mt-1 p-0 list-none">{shelf.sort(shelfOrder(kind)).map(row)}</ul>
                            </details>
                        )
                    }
                    return (
                        <section key={kind} className="mb-5">
                            <h3 className="m-0 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-tertiary">
                                {KIND_LABELS[kind]} · {shelf.length}
                            </h3>
                            <ul className="m-0 p-0 list-none">{shelf.sort(shelfOrder(kind)).map(row)}</ul>
                        </section>
                    )
                })}
                {study.length === 0 && !progress && <p className="text-sm text-tertiary">No study files found in your folders yet.</p>}
            </div>
            {menu && <ContextMenu {...menu} onClose={closeMenu} />}
        </div>
    )
}

/** A PDF or photo shown inside the Library window (Edge's own PDF viewer for PDFs). */
function Viewer({ item, onClose }: { item: LibraryItem; onClose: () => void }): JSX.Element {
    const src = convertFileSrc(item.file.path)
    const isPdf = /\.pdf$/i.test(item.file.name)
    return (
        <div className="h-full flex flex-col min-h-0">
            <header className="flex items-center gap-3 px-6 pb-3">
                <button type="button" className={cn(BUTTON, 'text-secondary hover:bg-hover')} onClick={onClose}>
                    ‹ Shelves
                </button>
                <span className="min-w-0 truncate text-sm font-semibold">{item.title}</span>
                <button type="button" className={cn(BUTTON, 'ml-auto text-secondary hover:bg-hover')} onClick={() => void openInProgram(item.file.path)}>
                    Open in its program
                </button>
            </header>
            {isPdf ? (
                <iframe src={src} title={item.title} className="flex-1 min-h-0 w-full border-0 bg-white" />
            ) : (
                <div className="flex-1 min-h-0 overflow-auto flex items-start justify-center p-4">
                    <img src={src} alt={item.title} className="max-w-full rounded-lg" />
                </div>
            )}
        </div>
    )
}
