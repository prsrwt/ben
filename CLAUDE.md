# Ben

Ben is a calm, single-purpose **study and reading browser** for Windows: a desktop app (Tauri 2 + React)
styled as a small desktop with frosted-glass windows. It is not a general web browser. The goal is to
remove clutter and distraction from studying online. Planned apps, each still an empty window:

- **Reader:** paste a link, get a clean article rendered as a book (pagination, clickable index). Next to build.
- **Library:** saved articles and notes in folders, stored as plain files the user owns.
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
3. **The look is decided.** Frosted glass (island, windows, icons), Figtree font, PostHog-style theme menu.
   Don't restyle without being asked.
4. The user's global instructions apply: explain plainly, propose work as phases, and wait for approval
   before writing code.

## Design decisions already made

- **No Windows title bar and no tabs** (`decorations: false`). The only bar is **Ben Island**
  (`BenIsland.tsx`): full width, flush to the top edge, macOS-menu-bar style. Cat icon + "Ben" on the left,
  a small pill search bar in the centre (Ctrl+K focuses it; submitting does nothing yet), then the theme
  button and traffic lights on the right. Empty space on the bar drags the app (`data-tauri-drag-region`).
- **Traffic lights on the right, Windows order:** yellow minimise, green maximise, red close
  (`TrafficLights.tsx`). Same component for the app and for every window. Plain arrow cursor, never a hand.
- **Windows** (`Window.tsx`): all open at one size, `WINDOW_WIDTH` x `WINDOW_HEIGHT` in `windowsLogic.ts`.
  No visible title; the controls float over the content, which scrolls up underneath them. Yellow hides a
  window (state kept, `hidden`), and its desktop icon brings it back. Maximised windows keep an 8px gap.
- **Scrollbar:** the native one is hidden; `WindowScrollbar.tsx` draws a grey pill clear of the rounded
  corners. (Edge's overlay scrollbars ignore CSS scrollbar styling, which is why it's drawn.)
- **Desktop icons:** solid frosted-glass silhouettes (`GlassIcon.tsx`, a CSS mask over layers) with a
  hairline rim so they read on pale wallpaper. All in the left column. A PNG in `public/desktop/icons/<id>.png`
  replaces one.
- **Theme:** light / dark / "Sync with system", stored in localStorage `ben.theme` (migrated once from the
  old key `scenes.userLogic.user`). `ThemeSync.tsx` sets `<body theme="dark|light">`.

## Where things live

| Path | What |
| --- | --- |
| `src/main.tsx`, `src/App.tsx` | Entry and root |
| `src/styles.css` | Tailwind v4 plus Ben's colour tokens (`text-primary`, `text-secondary`, `text-tertiary`, `bg-hover`, `text-accent`...) for light and dark |
| `src/desktop/desktop.css` | Wallpaper, glass, traffic lights, scrollbar, search bar, icon layers (plain CSS, native nesting) |
| `src/desktop/apps.tsx` | The app registry (id, title, column). Add an app here |
| `src/desktop/windowContent.tsx` | What each window shows. Every app is `EmptyWindow` for now |
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
- `useKeyboardNavigation.ts`: LemonMenu's arrow-key hook, unchanged. (oxlint warns about reading a ref during render in `ThemeMenu.tsx`; that is PostHog's own pattern and safe here.)
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
- Bundle: 213 KB of JS, mostly React. To see what a change costs, build with `--sourcemap` and sum bytes per
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

- No git repository. Ask before creating one or committing.
- The search bar does nothing on submit; it becomes "open a link" with the Reader.
