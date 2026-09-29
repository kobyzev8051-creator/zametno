// «Заметно» — заметки и дела. © 2026 Кобызев С. Е. Все права защищены.
//
// Программа для Windows: окно с приложением «Заметно» (те же файлы, что и у сайта).
// Здесь только то, чего не умеет сама страница внутри программы:
// сохранение файлов экспорта через окно «Сохранить как» и открытие внешних ссылок в браузере.

// Без чёрного окна консоли при запуске
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

/// Показывает окно «Сохранить как» и записывает файл.
/// Возвращает true, если файл сохранён, и false, если пользователь нажал «Отмена».
#[tauri::command]
async fn save_file(app: tauri::AppHandle, name: String, data: String) -> Result<bool, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();

    let mut dialog = app.dialog().file().set_file_name(&name);
    if !ext.is_empty() {
        dialog = dialog.add_filter(ext.to_uppercase(), &[ext.as_str()]);
    }
    match dialog.blocking_save_file() {
        Some(path) => {
            let path = path.into_path().map_err(|e| e.to_string())?;
            std::fs::write(path, bytes).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file])
        .setup(|app| {
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Заметно")
                .inner_size(900.0, 900.0)
                .min_inner_size(380.0, 520.0)
                // Страницы самой программы открываются внутри окна, всё остальное — в браузере
                .on_navigation(|url| {
                    let internal = url.scheme() == "tauri"
                        || matches!(url.host_str(), Some("tauri.localhost") | Some("localhost"));
                    if !internal {
                        let _ = open::that(url.as_str());
                    }
                    internal
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("не удалось запустить «Заметно»");
}
