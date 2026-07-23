
mod ble;
mod state;

use state::AppState;
use tauri::Manager;
use btleplug::api::Peripheral as _;

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
            ble::cube::debug_ble_status,
            ble::cube::connect_gan_cube,
            ble::cube::reconnect_gan_cube,
            ble::cube::disconnect_gan_cube,
            ble::cube::is_cube_connected,
            ble::cube::send_cube_command,
            ble::timer::connect_gan_timer,
            ble::timer::disconnect_gan_timer,
        ])
        .setup(|app| {
            // ── Clean disconnect on window close ────────────────────────────
            // Without this, the BLE connection stays open when the user closes
            // the window (the WebView is destroyed but Rust never calls
            // peripheral.disconnect()). Windows BLE stack eventually times out,
            // but that takes seconds to minutes.
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        let state = handle.state::<crate::state::AppState>();
                        // Take the peripheral out before blocking, so the
                        // MutexGuard is dropped and no borrow conflicts arise.
                        let peripheral = state.connected_cube.lock().take();
                        state.cube_command_char.lock().take();
                        state.cube_state_char.lock().take();
                        drop(state);

                        if let Some(p) = peripheral {
                            eprintln!("[BLE] Window closing — disconnecting cube...");
                            // Block synchronously here because the app is exiting.
                            // Tauri runs on Tokio, so a runtime handle is available.
                            if let Ok(rt) = tokio::runtime::Handle::try_current() {
                                let _ = rt.block_on(p.disconnect());
                                eprintln!("[BLE] Cube disconnected on window close");
                            }
                        }
                    }
                });
            }

            // Start BLE background auto-scan when the app opens.
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
