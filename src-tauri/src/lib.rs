use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg(target_os = "windows")]
use window_vibrancy::apply_blur;

// Helper function to get storage file path
fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let keys_dir = app_data_dir.join(".keys");

    // Create the .keys directory if it doesn't exist
    fs::create_dir_all(&keys_dir)
        .map_err(|e| format!("Failed to create keys directory: {}", e))?;

    Ok(keys_dir)
}

// Secure storage commands using file-based storage
// Files are stored in app data directory with base64 encoding
#[tauri::command]
fn secure_storage_get(app: tauri::AppHandle, key: String) -> Result<String, String> {
    let storage_path = get_storage_path(&app)?;
    let key_file = storage_path.join(format!("{}.dat", key));

    if !key_file.exists() {
        return Err(format!("Key '{}' not found", key));
    }

    match fs::read_to_string(&key_file) {
        Ok(encoded) => {
            // Decode from base64
            match general_purpose::STANDARD.decode(&encoded) {
                Ok(decoded_bytes) => {
                    match String::from_utf8(decoded_bytes) {
                        Ok(value) => Ok(value),
                        Err(e) => Err(format!("Failed to decode value: {}", e))
                    }
                },
                Err(e) => Err(format!("Failed to decode base64: {}", e))
            }
        },
        Err(e) => Err(format!("Failed to read file: {}", e))
    }
}

#[tauri::command]
fn secure_storage_set(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let storage_path = get_storage_path(&app)?;
    let key_file = storage_path.join(format!("{}.dat", key));

    // Encode to base64
    let encoded = general_purpose::STANDARD.encode(value.as_bytes());

    fs::write(&key_file, encoded)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn secure_storage_remove(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let storage_path = get_storage_path(&app)?;
    let key_file = storage_path.join(format!("{}.dat", key));

    if !key_file.exists() {
        return Ok(()); // Not an error if it doesn't exist
    }

    fs::remove_file(&key_file)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn select_source_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc;

    let window = app.get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    let (tx, rx) = mpsc::channel();

    window.dialog()
        .file()
        .add_filter("JSON Files", &["json"])
        .pick_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    // Wait for the callback
    match rx.recv() {
        Ok(file_path) => Ok(file_path.map(|p| p.to_string())),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn read_json_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_json_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn check_file_exists(path: String) -> Result<bool, String> {
    Ok(fs::metadata(&path).is_ok())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            secure_storage_get,
            secure_storage_set,
            secure_storage_remove,
            select_source_file,
            read_json_file,
            write_json_file,
            check_file_exists
        ])
        .setup(|app| {
            // Ensure app appears in Dock (not menu bar)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Regular);
            }

            // Get window for all platforms
            let window = app.get_webview_window("main").unwrap();

            // Show and focus the window
            let _ = window.show();
            let _ = window.set_focus();

            // Apply window vibrancy effects based on platform
            #[cfg(target_os = "macos")]
            {
                apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                    .expect("Failed to apply vibrancy on macOS");
                println!("Applied macOS vibrancy effect");
            }

            #[cfg(target_os = "windows")]
            {
                apply_blur(&window, Some((18, 18, 18, 125)))
                    .expect("Failed to apply blur on Windows");
                println!("Applied Windows blur effect");
            }

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
