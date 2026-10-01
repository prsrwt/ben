# Ben

Ben is a calm, single-purpose **study and reading browser** for Windows: a desktop app (Tauri 2 + React)
styled as a small desktop with matte-glass windows. It is not a general web browser. The goal is to
remove clutter and distraction from studying online. Planned apps, each still an empty window:

- **Reader:** paste a link, get a clean article rendered as a book (pagination, clickable index). Being built:
  clean article, clean-up, back/forward, pages, keeping your place and Contents are done.
- **History:** every page read in the Reader (link, title, time; not the article), grouped by day, kept
  across restarts in localStorage `ben.history` (last 1,000). Built.
- **Library:** the student's own study files (PDF, Word, PowerPoint, photos) from folders they choose, recognised
  and put on shelves by subject and kind. Read-only: files are never moved or changed. Phase I1 built. Newspaper
  PDFs (e-papers with real text) open in the Reader as one book: sections and headlines in Contents, "» PAGE n"
  pointers as links (`src/newspaper/`). Next I2 (syllabus units + coverage), then exam layouts, Windows OCR for
  photos and scanned papers, and "explain visually".
- **Newspaper:** RSS sources laid out as an old-times broadsheet.
- **Videos:** YouTube captions turned into readable, chaptered transcripts.
- **Notes**, **Trash**.

Build one app at a time, only when the user asks. Everything else stays empty.

## Ground rules

1. **Don't break user space.** Never change what the user already relies on (behaviour, saved settings,
   wording, icons, look, shortcuts) unless they asked for that change. When refactoring, keep every visible
   thing identical or migrate it (see the theme key migration in `themeLogic.ts`). Propose unrequested
   changes; don't make them.
2. **Keep it thin.** Ben was stripped from a 34,000-line PostHog copy down to about 1,300 lines of its own.
   Add a dependency only when it earns its place, and check its bundle cost (see "Measuring"). Draw small
   UI pieces inline rather than pulling in a library.
3. **The look is decided.** Matte glass (island, windows, icons), Figtree font (Literata for article text),
   PostHog-style theme menu.
   Don't restyle without being asked.
4. The user's global instructions apply: explain plainly, propose work as phases, and wait for approval
   before writing code.

## Design decisions already made

- **No Windows title bar and no tabs** (`decorations: false`). The only bar is **Ben Island**
  (`BenIsland.tsx`): full width, flush to the top edge, macOS-menu-bar style. Cat icon + "Ben" on the left,
  a small pill search bar in the centre (`SearchPalette.tsx`): click it, Ctrl+K or Ctrl+G and it grows, widening and
  dropping out of the bar with the bar curving down around it (drawn just above the island, so the part below the
  bar can blur what's beneath). Typing searches (`src/search/`): pages read before (History), Wikipedia's title search, and the web via DuckDuckGo's
  HTML page (ads dropped); ↑ ↓ + Enter open a result in a new Reader window, a pasted link opens directly. Requests
  send no Origin header (plugin feature `unsafe-headers`; DuckDuckGo and some sites refuse one). A centred
  Spotlight-style box was tried and dropped on 2026-09-30. Just right of the search bar sit the front window's app options (Reader: back and
  forward, then the Contents pill: icon + the section being read; click lists sections with page numbers). Just left of it sits the apps pill (`IslandApps.tsx`): an
  icon per app with open windows, a count on top when it has several; clicking one lists its windows
  (plus, for the Reader, the last 5 pages read that aren't open, and "Show all history"). Then the theme
  button and traffic lights on the right. Empty space on the bar drags the app (`data-tauri-drag-region`).
- **Traffic lights on the right, Windows order:** yellow minimise, green maximise, red close
  (`TrafficLights.tsx`). Same component for the app and for every window. Plain arrow cursor, never a hand.
- **Windows** (`Window.tsx`): all open at one size, `WINDOW_WIDTH` x `WINDOW_HEIGHT` in `windowsLogic.ts`.
  No visible title; the controls float over the content, which scrolls up underneath them. Yellow hides a
  window (state kept, `hidden`), and its desktop icon brings it back. Maximised windows keep an 8px gap.
  Each window has its own id (`reader-2`) and an `appId`. A desktop icon (`openApp`) brings back that app's
  front-most window or opens one; `openWindow` always opens a new one. Only the Reader opens several: Enter
  in the search bar and Ctrl+click open a new Reader window; a plain click on a link stays in the same window,
  whose history (back/forward) is its own. Right-click (and middle-click on a link) shows Ben's menu (`desktop/ContextMenu.tsx`): on a link Open / Open in new
  window / "Open side by side" / Copy link; on selected text Copy / Search for; then page turns, back/forward and Copy
  page link. The browser's own menu is off app-wide except in text fields (`useNoBrowserMenu.ts`). "Open side by side", which snaps this window to the left half and opens the link on the right
  (`snapped` in `windowsLogic.ts`). Snapped windows are placed, not locked: dragging one away returns it to its
  own size under the pointer.
- **Ben View** (`BenView.tsx`, Ctrl+Space): every app with open windows as a matte-glass card over the
  dimmed, blurred desktop; an app with several windows is a stack that fans out when clicked. Picking a card
  brings its window forward; × closes a window; arrows + Enter work; Esc, Ctrl+Space or the background
  close it. The blurred backdrop is a sibling of the cards, not their parent, so the cards' glass still works.
- **Reader pages** (`useBook.ts`): the article flows into page-sized CSS columns inside a frame one spread
  wide, and turning slides the row of columns. Two facing pages when there's at least 900px of room (after
  56px margins), otherwise one page (at most 680px wide). → / Space / PageDown forward, ← / Shift+Space /
  PageUp back (front Reader window only; not while focus is in a field, button or menu), and clicking the side
  margins. Page numbers under each page. Headings carry an invisible 4em tail so they never end a page.
  The reading place is kept as a passage (index of the first block starting on the page), not a page
  number, so resizing, one page <-> two, and back/forward (kept per page id in `ReaderView.tsx`) all return
  to the same passage, and so do pictures arriving late. A turn is a short sideways slide (220 ms). Contents
  (`ContentsMenu.tsx`) reads each window's book through `openBooks.ts` (a registry, plus a small store for
  the current section that the pill subscribes to). A 3D "door" flip and an Apple Books-style paper fold were tried
  and dropped on 2026-09-30: an opaque turning sheet looks like a solid slab on the frosted-glass pages.
  Article text is Literata (`@fontsource-variable/literata`, ~52 KB upright + ~54 KB italic for Latin).
- **Scrollbar:** the native one is hidden; `WindowScrollbar.tsx` draws a grey pill clear of the rounded
  corners. (Edge's overlay scrollbars ignore CSS scrollbar styling, which is why it's drawn.)
- **Desktop icons:** solid matte-glass silhouettes (`GlassIcon.tsx`, a CSS mask over layers) with a
  hairline rim so they read on pale wallpaper. All in the left column. A PNG in `public/desktop/icons/<id>.png`
  replaces one.
- **Matte glass** (`desktop.css`), like a nano-texture (anti-glare) screen: heavy blur, little colour
  (`saturate(1.1)`), no shine, and a faint even grain from `public/desktop/matte-grain.webp` (a 128px tile).
  The grain is the element's own background, so it sits under the text and letters stay sharp. It must stay
  a pre-made image: live SVG noise (`feTurbulence`) re-runs on every repaint and made the app lag. A paper
  texture was tried and dropped on 2026-09-29.
- **Theme:** light / dark / "Sync with system", stored in localStorage `ben.theme` (migrated once from the
  old key `scenes.userLogic.user`). `ThemeSync.tsx` sets `<body theme="dark|light">`.

## Where things live

| Path | What |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Entry and root |
| `src/styles.css` | Tailwind v4 plus Ben's colour tokens (`text-primary`, `text-secondary`, `text-tertiary`, `bg-hover`, `text-accent`...) for light and dark |
| `src/desktop/desktop.css` | Wallpaper, glass, traffic lights, scrollbar, search bar, icon layers (plain CSS, native nesting) |
| `src/desktop/apps.tsx` | The app registry (id, title, column). Add an app here |
| `src/desktop/windowContent.tsx` | What each window shows. The Reader has its view; the rest are `EmptyWindow` |
| `src/library/` | Library: `classify.ts` (recognises kind/subject/mine/course code from name, folder, pages, first-page text; pure, testable), `libraryLogic.ts` (folders, identity, index in app data `library.json`, scan reads only new/changed files, corrections, grouping of copies/formats), `libraryApi.ts`, `LibraryView.tsx` (first-run setup, subject sidebar, shelves, "Needs you", PDF/photo viewer) |
| `src-tauri/src/library.rs` | Library file work: suggest folders, list (skips hidden/system/code-project folders), read text (lopdf, docx/pptx XML via zip), watch (notify → `library-changed`), save index, open in program (only inside chosen folders), asset-protocol scope for viewing |
| `src/newspaper/` | Newspaper PDFs: `layout.ts` (positioned words → sections, stories, teasers, continuations; spots scanned/scrambled papers; pure, testable), `pdfText.ts` (words via PDF.js), `paperArticle.ts` (a paper as one Reader article, all text escaped), `paperFile.ts` (a paper's Reader address: its `file:///` URL + `?title=`), `openPaper.ts` (loaded only when a paper opens, so PDF.js and its worker stay out of the main bundle). Papers aren't recorded in History |
| `src/history/` | History: `historyLogic.ts` (records Reader page loads, persists), `HistoryView.tsx` |
| `src/reader/` | The Reader: `fetchArticle.ts` (download via Tauri's HTTP plugin), `extractArticle.ts` (Readability + DOMPurify + clean-up, no app dependencies), `readerLogic.ts` (history: pages + index), `ReaderView.tsx`, `ReaderIslandOptions.tsx` (back/forward on the island), `useBook.ts` (page layout and turning), `reader.css` |
| `src/desktop/windowsLogic.ts` | Kea logic: open windows, order, position, maximise, minimise |
| `src/desktop/themeLogic.ts` | Kea logic: theme mode, persistence, live system theme |
| `src/desktop/nativeWindow.ts` | Tauri window access; `IS_DESKTOP_APP` is false in a plain browser tab |
| `public/ben-icon.png`, `assets/` | App icon (the cat) and its source images |
| `public/desktop/background.jpg` | Wallpaper |
| `src-tauri/` | Rust side: `tauri.conf.json` (window, identifier `com.paras.ben`), `capabilities/default.json` (window permissions the island needs), icons |

### PostHog-derived code (MIT, keep `LICENSE-POSTHOG`)

Only these came from PostHog, copied so the theme menu looks and behaves exactly as it did under
LemonMenu. Keep them identical unless asked:

- `posthog-menu.css`: the Popover, LemonButton (tertiary, small) and h5 rules, with tokens resolved.
- `useKeyboardNavigation.ts`: LemonMenu's arrow-key hook, unchanged. (oxlint warns about reading a ref during render in `ThemeMenu.tsx`, `IslandApps.tsx`, `ContextMenu.tsx` and `ContentsMenu.tsx`; that is PostHog's own pattern and safe here. The hook sizes its item list once, so `IslandApps` remounts its menu when the item count changes.)
- `icons.tsx`: four `@posthog/icons` drawings (Search, Brightness, Palette, Laptop). The package itself cost ~260 KB of JS, so it is not installed.

## Commands

Run from `C:\dev\ben`. Rust is in `%USERPROFILE%\.cargo\bin` (Git Bash: `export PATH="$HOME/.cargo/bin:$PATH"`).

| Command | What |
| --- | --- |
| `npm run app` | Run Ben as the desktop app (Vite dev server + Rust). First build after a cache clear takes ~3-4 min |
| `npm run dev` | The UI alone in a browser at http://localhost:5173 (no traffic lights there) |
| `npx tsc -b` | Type check |
| `npx oxlint src` | Lint |
| `npx vite build` | Production build of the UI; prints bundle sizes |
| `npx tauri build --no-bundle` | Release program at `src-tauri/target/release/app.exe` (~9 MB) |

Before calling anything done: type check, lint and build clean; look at it in both themes; and for UI
changes check behaviour in the real app, not only in a browser tab.

## Measuring

- Memory: measure the **release** build, fresh start, idle, with no windows open, summing `app.exe` and every
  WebView2 process it started (private bytes). Dev mode is not a fair ruler, and live reloads inflate it.
  Baseline on 2026-09-29: about 286 MB private, 0% idle CPU. Roughly 100 MB of that is WebView2's fixed cost;
  the glass blur costs about 30 MB.
- Bundle: 340 KB of JS on 2026-10-01 (213 KB before Search, menus and the Library), mostly the Tauri API, React,
  Readability, DOMPurify and Kea. PDF.js (~440 KB + a 1.3 MB worker) is a separate file loaded only when a paper opens. To see what a change costs, build with `--sourcemap` and sum bytes per
  source package.

## Windows pitfalls already hit

- **Moving or renaming the project folder** leaves Rust's build cache pointing at the old path, and the next
  build fails ("failed to read plugin permissions ... cannot find the path"). Run `cargo clean` in
  `src-tauri` and rebuild.
- **Vite must not watch `src-tauri`** (see `vite.config.ts`): Windows locks cargo's output while it writes,
  and Vite's watcher crashing on a locked file takes the whole dev app down.
- **The dev port is fixed at 5173** (`strictPort`), because `tauri.conf.json` loads the UI from exactly there.
  If `npm run app` says the port is busy, an old dev server is still running.
- **A folder that won't delete or rename** is usually held open by a process standing in it (a terminal,
  Explorer window, or a leftover dev server), not a permissions problem.
- **Taskbar icon not updating** after changing `src-tauri/icons`: Rust doesn't rebuild for icon changes;
  touch `src-tauri/build.rs` and `src-tauri/src/lib.rs`.
- **backdrop-filter** only sees the real wallpaper if no ancestor has `filter`, `opacity` < 1 or `mask`.
  Hover effects on glass must use `transform` only.

## Not done yet

- Git repository on `main` since 2026-09-29. Ask before committing.
- Agreed plan: a lightweight phase (measure release memory, fewer old articles kept per Reader window,
  pictures loaded only near their page).
