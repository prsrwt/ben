mod library;
mod ocr;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Downloads web pages for the Reader (the UI itself can't, browsers block cross-site requests).
    .plugin(tauri_plugin_http::init())
    // The Library: choosing study folders, and opening Word/PowerPoint files in their usual programs.
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(library::LibraryState::default())
    .invoke_handler(tauri::generate_handler![
      library::library_suggest_folders,
      library::library_list,
      library::library_read,
      library::library_load_index,
      library::library_save_index,
      library::library_watch,
      library::library_open,
      ocr::ocr_image,
      ocr::ocr_file,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
