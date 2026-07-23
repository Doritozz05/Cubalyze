
mod ble;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            ble::cube::connect_gan_cube,
            ble::cube::disconnect_gan_cube,
            ble::cube::is_cube_connected,
            ble::cube::send_cube_command,
            ble::timer::connect_gan_timer,
            ble::timer::disconnect_gan_timer,
        ])
        .setup(|app| {
            // Start BLE background auto-scan when the app opens.
            // The scan runs asynchronously and emits events to the frontend
            // via app.emit() when a cube is detected or connected.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = ble::cube::start_auto_scan(handle).await {
                    eprintln!("[BLE] Auto-scan background task error: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
