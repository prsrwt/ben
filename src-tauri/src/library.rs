// The Library's file work: suggesting where study material lives, listing the files in the folders the student
// chose, reading the text of their first pages (PDF, Word, PowerPoint, plain text), watching those folders for
// new files, and keeping the Library's index. Everything here only ever reads the student's files: nothing is
// moved, renamed or deleted. Recognising what each file is happens in the UI (src/library/classify.ts).

use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// File formats the Library looks at: documents and photos. Everything else is ignored.
const FORMATS: &[&str] = &[
    "pdf", "doc", "docx", "ppt", "pptx", "odt", "odp", "txt", "md", "rtf", "epub", "djvu", "jpg", "jpeg",
    "png", "webp", "heic", "bmp",
];
/// Folders that never hold study material, skipped when walking.
const SKIP_DIRS: &[&str] = &[
    "node_modules", "appdata", "$recycle.bin", "target", "venv", ".venv", "__pycache__", "site-packages",
    "program files", "program files (x86)", "windows", "build", "dist",
];
/// How much text is kept per file: enough to recognise it, small enough to keep the index light.
const TEXT_LIMIT: usize = 6000;
/// Files bigger than this are listed but not opened for text (a 300 MB scan would stall the import).
const READ_LIMIT: u64 = 150 * 1024 * 1024;

fn is_study_format(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| FORMATS.contains(&ext.to_ascii_lowercase().as_str()))
}

/// Files that mark a folder as a programming project (its READMEs and data files aren't study material).
const PROJECT_MARKERS: &[&str] = &[".git", "package.json", "Cargo.toml", "pom.xml", "build.gradle", "pyproject.toml", ".sln"];

fn is_skipped_dir(entry: &walkdir::DirEntry) -> bool {
    if entry.depth() == 0 || !entry.file_type().is_dir() {
        return false;
    }
    let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
    name.starts_with('.')
        || SKIP_DIRS.contains(&name.as_str())
        || PROJECT_MARKERS.iter().any(|marker| entry.path().join(marker).exists())
}

/// Every study-format file under a folder (not following shortcuts, at most 8 folders deep).
fn walk(folder: &Path) -> impl Iterator<Item = walkdir::DirEntry> {
    walkdir::WalkDir::new(folder)
        .max_depth(8)
        .into_iter()
        .filter_entry(|entry| !is_skipped_dir(entry))
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && is_study_format(entry.path()))
}

#[derive(Serialize)]
pub struct FolderSuggestion {
    path: String,
    label: String,
    /// Study-format files found (counting stops at 2,000, so a huge folder answers quickly).
    files: usize,
}

/// Places study material usually ends up, with how many documents each holds.
#[tauri::command]
pub async fn library_suggest_folders(app: AppHandle) -> Vec<FolderSuggestion> {
    let Ok(home) = app.path().home_dir() else { return vec![] };
    let candidates = [
        ("Downloads", home.join("Downloads")),
        ("Documents", home.join("Documents")),
        ("Desktop", home.join("Desktop")),
        ("OneDrive Desktop", home.join("OneDrive").join("Desktop")),
        ("OneDrive Documents", home.join("OneDrive").join("Documents")),
    ];
    tauri::async_runtime::spawn_blocking(move || {
        candidates
            .into_iter()
            .filter(|(_, path)| path.is_dir())
            .map(|(label, path)| FolderSuggestion {
                files: walk(&path).take(2000).count(),
                path: path.to_string_lossy().into_owned(),
                label: label.to_string(),
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[derive(Serialize)]
pub struct FileEntry {
    path: String,
    name: String,
    folder: String,
    size: u64,
    /// Last change, in ms since 1970: with the size, tells the UI whether a file needs reading again.
    modified: u64,
}

/// Every study-format file in the chosen folders (each file once, even when folders overlap).
#[tauri::command]
pub async fn library_list(folders: Vec<String>) -> Vec<FileEntry> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut seen = HashSet::new();
        let mut files = Vec::new();
        for folder in &folders {
            for entry in walk(Path::new(folder)) {
                let path = entry.path().to_path_buf();
                if !seen.insert(path.clone()) {
                    continue;
                }
                let Ok(meta) = entry.metadata() else { continue };
                let modified = meta
                    .modified()
                    .ok()
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map_or(0, |since| since.as_millis() as u64);
                files.push(FileEntry {
                    name: entry.file_name().to_string_lossy().into_owned(),
                    folder: path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
                    path: path.to_string_lossy().into_owned(),
                    size: meta.len(),
                    modified,
                });
            }
        }
        files
    })
    .await
    .unwrap_or_default()
}

#[derive(Serialize, Default)]
pub struct FileText {
    /// Pages (PDF) or slides (PowerPoint), when known.
    pages: Option<u32>,
    text: String,
}

/// The text inside an Office file's XML: the words between the tags, with paragraphs as line breaks.
fn xml_text(xml: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;
    let mut tag = String::new();
    for ch in xml.chars() {
        match ch {
            '<' => {
                in_tag = true;
                tag.clear();
            }
            '>' => {
                in_tag = false;
                // End of a paragraph (Word) or text body (PowerPoint): keep words from running together.
                if tag.starts_with("/w:p") || tag.starts_with("/a:p") {
                    text.push('\n');
                }
            }
            _ if in_tag => tag.push(ch),
            _ => text.push(ch),
        }
        if text.len() >= TEXT_LIMIT {
            break;
        }
    }
    text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'")
}

fn read_zip_entry(archive: &mut zip::ZipArchive<fs::File>, name: &str) -> Option<String> {
    let mut entry = archive.by_name(name).ok()?;
    let mut xml = String::new();
    entry.read_to_string(&mut xml).ok()?;
    Some(xml)
}

fn read_pdf(path: &Path) -> FileText {
    let Ok(doc) = lopdf::Document::load(path) else { return FileText::default() };
    let pages = doc.get_pages().len() as u32;
    let first: Vec<u32> = (1..=pages.min(3)).collect();
    let mut text = doc.extract_text(&first).unwrap_or_default();
    text.truncate(text.floor_char_boundary(TEXT_LIMIT));
    FileText { pages: Some(pages), text }
}

fn read_docx(path: &Path) -> FileText {
    let Some(mut archive) = fs::File::open(path).ok().and_then(|file| zip::ZipArchive::new(file).ok()) else {
        return FileText::default();
    };
    let text = read_zip_entry(&mut archive, "word/document.xml").map(|xml| xml_text(&xml)).unwrap_or_default();
    FileText { pages: None, text }
}

fn read_pptx(path: &Path) -> FileText {
    let Some(mut archive) = fs::File::open(path).ok().and_then(|file| zip::ZipArchive::new(file).ok()) else {
        return FileText::default();
    };
    let slides = (0..archive.len())
        .filter(|&i| archive.name_for_index(i).is_some_and(|n| n.starts_with("ppt/slides/slide") && n.ends_with(".xml")))
        .count() as u32;
    let mut text = String::new();
    for n in 1..=slides.min(5) {
        if let Some(xml) = read_zip_entry(&mut archive, &format!("ppt/slides/slide{n}.xml")) {
            text.push_str(&xml_text(&xml));
            text.push('\n');
        }
    }
    text.truncate(text.floor_char_boundary(TEXT_LIMIT));
    FileText { pages: Some(slides), text }
}

fn read_plain(path: &Path) -> FileText {
    let mut buffer = vec![0; TEXT_LIMIT];
    let read = fs::File::open(path).and_then(|mut file| file.read(&mut buffer)).unwrap_or(0);
    FileText { pages: None, text: String::from_utf8_lossy(&buffer[..read]).into_owned() }
}

/// The page count and the text of the first pages of a document, as far as it can be read. Old binary Office
/// files (.doc, .ppt) and photos come back empty: their text needs other readers (OCR comes later).
#[tauri::command]
pub async fn library_read(path: String) -> FileText {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(path);
        if fs::metadata(&path).map_or(true, |meta| meta.len() > READ_LIMIT) {
            return FileText::default();
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        match ext.as_str() {
            "pdf" => read_pdf(&path),
            "docx" => read_docx(&path),
            "pptx" => read_pptx(&path),
            "txt" | "md" => read_plain(&path),
            _ => FileText::default(),
        }
    })
    .await
    .unwrap_or_default()
}

fn index_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("library.json"))
}

/// The Library's saved index (settings, what each file was recognised as, corrections), or nothing yet.
#[tauri::command]
pub fn library_load_index(app: AppHandle) -> Option<String> {
    fs::read_to_string(index_path(&app)?).ok()
}

#[tauri::command]
pub fn library_save_index(app: AppHandle, json: String) -> Result<(), String> {
    let path = index_path(&app).ok_or("no app data folder")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // Written beside, then swapped in, so a crash mid-write never leaves a half-written index.
    let partial = path.with_extension("json.partial");
    fs::write(&partial, json).map_err(|e| e.to_string())?;
    fs::rename(&partial, &path).map_err(|e| e.to_string())
}

/// The folders being watched, and the watcher itself (kept alive while the app runs).
#[derive(Default)]
pub struct LibraryState {
    folders: Mutex<Vec<PathBuf>>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

/// Starts watching the chosen folders (replacing any earlier set): the UI hears "library-changed" when files
/// appear, change or go. Also lets those folders' PDFs and photos be shown inside Ben.
#[tauri::command]
pub fn library_watch(app: AppHandle, state: State<'_, LibraryState>, folders: Vec<String>) -> Result<(), String> {
    let folders: Vec<PathBuf> = folders.into_iter().map(PathBuf::from).filter(|p| p.is_dir()).collect();
    let emitter = app.clone();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if let Ok(event) = event {
            if !event.kind.is_access() && event.paths.iter().any(|p| is_study_format(p)) {
                let _ = emitter.emit("library-changed", ());
            }
        }
    })
    .map_err(|e| e.to_string())?;
    for folder in &folders {
        watcher.watch(folder, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
        app.asset_protocol_scope().allow_directory(folder, true).map_err(|e| e.to_string())?;
    }
    *state.watcher.lock().unwrap() = Some(watcher);
    *state.folders.lock().unwrap() = folders;
    Ok(())
}

/// Opens a file in its usual program (Word, PowerPoint…). Only files inside the watched folders.
#[tauri::command]
pub fn library_open(state: State<'_, LibraryState>, path: String) -> Result<(), String> {
    let file = PathBuf::from(&path);
    let allowed = state.folders.lock().unwrap().iter().any(|folder| file.starts_with(folder));
    if !allowed {
        return Err("not in a Library folder".into());
    }
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}
