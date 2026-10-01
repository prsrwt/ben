// Recognises what a study file is from what can be read without the user's help: its name, its folder, its
// format, its page count and the text of its first pages. Rules give each kind of file points; the kind with
// the most wins, and too few points means "not sure" (the user sorts it with one click). Plain functions with
// no app dependencies, so they can be tested on their own against real file names.

export type FileKind =
    | 'syllabus'
    | 'question-paper'
    | 'answer-key'
    | 'assignment'
    | 'lab-file'
    | 'project'
    | 'notes'
    | 'slides'
    | 'book'
    | 'newspaper'
    | 'dpp'
    | 'mock-test'
    | 'guide'
    | 'material'
    | 'personal'
    | 'photo'
    | 'unsure'
    | 'not-study'

export const KIND_LABELS: Record<FileKind, string> = {
    syllabus: 'Syllabus',
    'question-paper': 'Question papers',
    'answer-key': 'Answer keys',
    assignment: 'Assignments',
    'lab-file': 'Lab files',
    project: 'Projects & reports',
    notes: 'Notes',
    slides: 'Slides',
    book: 'Books',
    newspaper: 'Newspapers',
    dpp: 'DPPs',
    'mock-test': 'Mock tests',
    guide: 'Guides',
    material: 'Course material',
    personal: 'Forms & documents',
    photo: 'Photos',
    unsure: 'Not sure',
    'not-study': 'Not study material',
}

export interface FileFacts {
    /** File name with extension, e.g. "NR SE Notes (1).pdf". */
    name: string
    /** The folder it sits in, e.g. "C:\Users\Paras\Desktop\4th Sem". */
    folder: string
    pages?: number
    /** Text of the first pages, if it could be read. */
    text?: string
}

export interface Identity {
    /** The student's name, e.g. "Paras Rawat". */
    name: string
    /** Roll numbers or student ids, e.g. ["18399", "1000018399"]. */
    rollNumbers: string[]
}

export interface Recognised {
    kind: FileKind
    /** 0-1: how sure the rules are. Below 0.35 the kind is "unsure". */
    confidence: number
    /** e.g. "Software Engineering"; null when nothing names it. */
    subject: string | null
    /** A course code like "CSF206", if the name carries one. */
    courseCode: string | null
    /** The student's own work (their name or roll number is on it). */
    mine: boolean
    /** For newspapers: the paper and the date, e.g. "The Hindu", "2026-09-17". */
    paper?: string
    date?: string
}

const STUDY_FORMATS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'odt', 'odp', 'txt', 'md', 'rtf', 'epub', 'djvu'])
const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp'])

/** Short forms and names of common subjects. Keys are matched as whole words, case-insensitively. */
const SUBJECTS: [RegExp, string][] = [
    [/\b(software[\s_-]*engineering|se)\b/i, 'Software Engineering'],
    [/\b(advanced[\s_-]*java([\s_-]*programming)?|ajp\w*)\b/i, 'Advanced Java'],
    [/\b(java\w*|oops?|object[\s_-]*oriented)\b/i, 'Java & OOP'],
    [/\b(data[\s_-]*structures?|ds|dsa)\b/i, 'Data Structures'],
    [/\b(computer[\s_-]*graphics|cg)\b/i, 'Computer Graphics'],
    [/\b(computer[\s_-]*networks?|cn)\b/i, 'Computer Networks'],
    [/\b(operating[\s_-]*systems?|os)\b/i, 'Operating Systems'],
    [/\b(dbms|database)\b/i, 'Databases'],
    [/\b(digital[\s_-]*image[\s_-]*processing|image[\s_-]*processing|dip|image[\s_-]*enhancement|histogram|intensity[\s_-]*transformations?|frequency[\s_-]*domain|gonzalez)\b/i, 'Digital Image Processing'],
    [/\b(artificial[\s_-]*intelligence|ai)\b/i, 'Artificial Intelligence'],
    [/\b(machine[\s_-]*learning|ml|pattern[\s_-]*recognition|ann|k[\s_-]*means|pca|principal[\s_-]*component\w*|regression)\b/i, 'Machine Learning'],
    [/\b(compiler\w*|lexer|tokeni[sz]er|code[\s_-]*token\w*|dfa\w*|nfa|parser|infix|postfix|keyword[\s_-]*checker)\b/i, 'Compiler Design'],
    [/\b(data[\s_-]*science)\b/i, 'Data Science'],
    [/\b(python|py\w*lab)\b/i, 'Python'],
    [/\b(android|andyroid|activity[\s_-]*life[\s_-]*cycle|sdk)\b/i, 'Android'],
    [/\b(web[\s_-]*d(ev(elopment)?)?|html|css|javascript|php|react|props|routes?|cookies?|sess(ion)?|dshbrd|dashboard)\b/i, 'Web Development'],
    [/\b(english|elt|language[\s_-]*teaching)\b/i, 'English'],
    [/\b(physics)\b/i, 'Physics'],
    [/\b(chemistry)\b/i, 'Chemistry'],
    [/\b(maths?|mathematics|quant\w*)\b/i, 'Mathematics'],
    [/\b(reasoning)\b/i, 'Reasoning'],
    [/\b(polity|economy|geography|general[\s_-]*awareness|ga)\b/i, 'General Awareness'],
]

/** Newspaper short forms used in file names that circulate, e.g. "th.th_international.17_09_2026.pdf". */
const PAPERS: [RegExp, string][] = [
    [/^(th|the[\s_-]*hindu)\b/i, 'The Hindu'],
    [/^(ie|indian[\s_-]*express)\b/i, 'Indian Express'],
    [/^(toi|times[\s_-]*of[\s_-]*india)\b/i, 'Times of India'],
    [/^(ht|hindustan[\s_-]*times)\b/i, 'Hindustan Times'],
    [/^(bs|business[\s_-]*standard)\b/i, 'Business Standard'],
    [/^(et|economic[\s_-]*times)\b/i, 'Economic Times'],
    [/^(dj|dainik[\s_-]*jagran)\b/i, 'Dainik Jagran'],
]
const MASTHEADS: [RegExp, string][] = [
    [/\bthe hindu\b/i, 'The Hindu'],
    [/\bindian express\b/i, 'Indian Express'],
    [/\btimes of india\b/i, 'Times of India'],
    [/\bhindustan times\b/i, 'Hindustan Times'],
    [/\bbusiness standard\b/i, 'Business Standard'],
    [/\beconomic times\b/i, 'Economic Times'],
]

/** "CSF206", "CA111", "IB304", "ECF483", "LAF183": two to four letters, then three digits. */
const COURSE_CODE = /\b([A-Z]{2,4}\d{3})\b/

const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

/** The name without extension or copy markers, with separators as spaces: "NR SE Notes (1).pdf" → "NR SE Notes". */
export function stem(name: string): string {
    return name
        .replace(/\.[^.]+$/, '')
        .replace(/\s*[([]\d+[)\]]\s*$/, '')
        .replace(/[_.-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** A date written day-first, as Indian file names do: 17_09_2026, 17-9-26, 2026-09-17. */
function findDate(text: string): string | null {
    const iso = /\b(20\d\d)[-_.](\d{1,2})[-_.](\d{1,2})\b/.exec(text)
    if (iso) {
        return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    }
    const dmy = /\b(\d{1,2})[-_.](\d{1,2})[-_.](20\d\d|\d\d)\b/.exec(text)
    if (dmy && Number(dmy[2]) <= 12 && Number(dmy[1]) <= 31) {
        const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
        return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    }
    return null
}

export function findSubject(text: string): string | null {
    return SUBJECTS.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

function isMine(text: string, identity: Identity): boolean {
    const lower = text.toLowerCase().replace(/[_.-]+/g, ' ')
    const name = identity.name.toLowerCase().trim()
    if (name) {
        const parts = name.split(/\s+/)
        // The full name, or first and last name both present ("Paras_Rawat", "Rawat Paras").
        if (lower.includes(name) || (parts.length > 1 && parts.every((part) => new RegExp(`\\b${part}\\b`).test(lower)))) {
            return true
        }
    }
    return identity.rollNumbers.some((roll) => roll.length >= 4 && new RegExp(`(^|\\D)${roll}(\\D|$)`).test(text))
}

/** Recognises one file. `knownCodes` maps course codes to subjects learned from other files. */
export function recognise(facts: FileFacts, identity: Identity, knownCodes: Map<string, string> = new Map()): Recognised {
    const ext = extensionOf(facts.name)
    const base = stem(facts.name)
    const words = ` ${base.toLowerCase()} `
    const text = (facts.text ?? '').slice(0, 6000)
    const lowerText = text.toLowerCase()
    const pages = facts.pages ?? 0
    const codeMatch = COURSE_CODE.exec(facts.name.toUpperCase().replace(/[_.-]/g, ' '))
    const courseCode = codeMatch?.[1] ?? null
    // From the name, then from a course code learned elsewhere, then from the start of the text.
    const subjectFromCode = courseCode ? (knownCodes.get(courseCode) ?? null) : null
    const subject = findSubject(base) || subjectFromCode || findSubject(text.slice(0, 600))
    const mine = isMine(`${facts.name} ${text.slice(0, 1500)}`, identity)

    // Not study material at all: code, logs, backups, archives, programs; and program output saved as text.
    const isLog =
        (ext === 'txt' || ext === 'md') && /^(std(out|err)|log|output|readme|license|changelog|contributing|debug|requirements)\b/i.test(base)
    if ((!STUDY_FORMATS.has(ext) && !IMAGE_FORMATS.has(ext)) || isLog) {
        return { kind: 'not-study', confidence: 1, subject: null, courseCode: null, mine: false }
    }

    const score = new Map<FileKind, number>()
    const add = (kind: FileKind, points: number): void => void score.set(kind, (score.get(kind) ?? 0) + points)
    const has = (pattern: RegExp): boolean => pattern.test(words)
    const inText = (pattern: RegExp): boolean => pattern.test(lowerText)

    // Personal documents: forms, ids, admit cards, receipts. Kept on their own shelf (admit cards matter to exam
    // students) rather than mixed with study material.
    if (
        has(/\b(admit[\s]*card|hall[\s]*ticket|aadhaa?r|pan[\s]*card|application[\s]*form|ack(nowledge?ment)?|self[\s]*dec(laration)?|certificate|mark[\s]*sheet|marksheet|result|receipt|invoice|fee|resume|cv|offer[\s]*letter|id[\s]*card|passport|bank[\s]*statement|payslip|affidavit|noc|bonafide|form|declaration|driving[\s]*licen[cs]e\d*|licen[cs]e\d*)\b/) ||
        /aadhaa?r|admitcard|hallticket/i.test(base)
    ) {
        add('personal', 3)
    }
    if (inText(/\b(admit card|hall ticket|aadhaar|unique identification|application (no|number)|registration (no|number)|date of birth)\b/)) {
        add('personal', 1.5)
    }

    // Newspapers: a known short form or masthead, plus a date.
    const paper = PAPERS.find(([pattern]) => pattern.test(base))?.[1] ?? MASTHEADS.find(([pattern]) => pattern.test(text.slice(0, 400)))?.[1]
    const date = findDate(facts.name) ?? (paper ? findDate(text.slice(0, 400)) : null)
    if (paper && date) {
        add('newspaper', 3)
    } else if (paper) {
        add('newspaper', 1)
    }
    if (inText(/\b(editorial|op-ed|edition|e-paper|epaper)\b/)) {
        add('newspaper', 0.5)
    }

    if (has(/\bsyllabus\b/) || inText(/\b(syllabus|course outcomes?|unit[\s-]*i\b.*unit[\s-]*ii)/s)) {
        add('syllabus', has(/\bsyllabus\b/) ? 3 : 1)
    }
    if (has(/\b(pyqs?|previous[\s]*years?|question[\s]*papers?|qp|set ?\d|back|sample[\s]*papers?|end[\s]*sem|mid[\s]*sem|sessional|supplementary)\b/)) {
        add('question-paper', 2)
    }
    if (inText(/\b(time\s*:\s*\d|max(imum)?\.?\s*marks|attempt (any|all)|answer (any|all) )/)) {
        add('question-paper', 1.5)
    }
    if (has(/\b(answer[\s]*keys?|solutions?|ans[\s]*key)\b/)) {
        add('answer-key', 2.5)
    }
    if (has(/\b(dpp|daily[\s]*practice)\b/)) {
        add('dpp', 3)
    }
    if (has(/\b(mock|test[\s]*series)\b/)) {
        add('mock-test', 2.5)
    }
    if (has(/\b(assignment\d*|a\d|ga\d|gla\d|ngla\d|homework|hw)\b/) || /\b(n?gla|a)\d/i.test(base)) {
        add('assignment', 2)
    }
    if (has(/\b(lab|practical|lab[\s]*file)\b/) || /lab\s*file|py\w*lab|lab\d/i.test(base)) {
        add('lab-file', 2.5)
    }
    if (has(/\b(project\d*|report|synopsis|internship)\b/)) {
        add('project', 2)
    }
    if (has(/\b(notes?|short[\s]*notes|handwritten|imp(ortant)?[\s]*(top(ics)?|q(uestions)?)|imptop)\b/) || /imptop|impq/i.test(base)) {
        add('notes', 2.5)
    }
    if (has(/\b(guide|all[\s]*in[\s]*one|handbook|compendium)\b/)) {
        add('guide', 2.5)
    }
    if (has(/\b(book|textbook|edition|vol(ume)?)\b/) || inText(/\b(isbn|table of contents|preface)\b/)) {
        add('book', 2)
    }
    if (has(/\b(unit[\s]*\d|chapter[\s]*\d|lecture|lec[\s]*\d)\b/) || /^\d{1,2}[a-z]?\s/i.test(base)) {
        add('slides', 1)
        add('notes', 0.5)
    }

    // A program written out (lab exercises saved as text or PDF): code-like text is lab work.
    if (/(#include|\bdef \w+\(|\bpublic (static )?(class|void)|\bfunction \w*\(|\bconsole\.log|\bprintf\(|\bimport \w+|<\?php|\bint main\()/.test(text)) {
        add('lab-file', 1.5)
    }

    // Format and length.
    if (ext === 'ppt' || ext === 'pptx' || ext === 'odp') {
        add('slides', 2.5)
    }
    if (pages >= 120) {
        add('book', 2)
    } else if (pages >= 60) {
        add('book', 1)
    }
    if (pages > 0 && pages <= 8) {
        add('dpp', 0.25)
    }
    // The student's own name on a document is almost always their submission.
    if (mine) {
        add('assignment', 1.2)
        add('lab-file', 0.5)
    }

    let best: FileKind = 'unsure'
    let bestPoints = 0
    for (const [kind, points] of score) {
        if (points > bestPoints) {
            best = kind
            bestPoints = points
        }
    }
    if (IMAGE_FORMATS.has(ext) && bestPoints < 2) {
        // Photos without a telling name need their text read (OCR) before they can be sorted.
        return { kind: 'photo', confidence: 0.5, subject, courseCode, mine }
    }
    const confidence = Math.min(1, bestPoints / 3)
    // Clearly about a subject but not clearly any kind of file ("Computer Graphics.pdf", "10c-Histogram.pdf"):
    // course material, until its text says more.
    const kind: FileKind = confidence >= 0.35 ? best : subject || courseCode ? 'material' : 'unsure'
    return {
        kind,
        confidence,
        subject,
        courseCode,
        mine,
        ...(best === 'newspaper' && paper ? { paper, date: date ?? undefined } : {}),
    }
}

/** Learns course codes from file names that carry both a code and a subject ("CSF206_Advanced Java…"),
 *  so files named only by code ("LAF183.pdf") can be given their subject too. */
export function learnCourseCodes(names: string[]): Map<string, string> {
    const codes = new Map<string, string>()
    for (const name of names) {
        const code = COURSE_CODE.exec(name.toUpperCase().replace(/[_.-]/g, ' '))?.[1]
        const subject = code ? findSubject(stem(name)) : null
        if (code && subject && !codes.has(code)) {
            codes.set(code, subject)
        }
    }
    return codes
}
