
mod ble;
mod log;
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
        // NOTE: no updater plugin — auto-updates are disabled until a signed
        // release channel (real endpoint + public key) is set up. See
        // tauri.conf.json → plugins.updater.active = false.
        .plugin(tauri_plugin_sql::Builder::default().build())
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
            ble::timer::get_timer_recorded_times,
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
                        // Take the peripherals out before blocking, so the
                        // MutexGuards are dropped and no borrow conflicts arise.
                        let cube = state.connected_cube.lock().take();
                        state.cube_command_char.lock().take();
                        state.cube_state_char.lock().take();
                        let timer = state.connected_timer.lock().take();
                        state.timer_state_char.lock().take();
                        state.timer_time_char.lock().take();
                        drop(state);

                        if let Ok(rt) = tokio::runtime::Handle::try_current() {
                            if let Some(p) = cube {
                                debug_log!("[BLE] Window closing — disconnecting cube...");
                                let _ = rt.block_on(p.disconnect());
                                debug_log!("[BLE] Cube disconnected");
                            }
                            if let Some(p) = timer {
                                debug_log!("[BLE] Window closing — disconnecting timer...");
                                let _ = rt.block_on(p.disconnect());
                                debug_log!("[BLE] Timer disconnected");
                            }
                        }
                    }
                });
            }

            // Start BLE background auto-scan when the app opens.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(_e) = ble::cube::start_auto_scan(handle).await {
                    debug_log!("[BLE] Auto-scan background task error: {}", _e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
