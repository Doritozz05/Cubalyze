use tauri::{AppHandle, State};
use crate::state::AppState;

/// Tauri command: Connect to a GAN Smart Timer.
/// Placeholder — full implementation will use btleplug GATT operations
/// mirroring the gan-smart-timer.ts protocol.
#[tauri::command]
pub async fn connect_gan_timer(
    _app: AppHandle,
    _state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    Err("GAN Timer BLE support is not yet implemented in the Tauri backend.".into())
}

/// Tauri command: Disconnect from the GAN Smart Timer.
#[tauri::command]
pub async fn disconnect_gan_timer(
    _app: AppHandle,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    Err("GAN Timer BLE support is not yet implemented in the Tauri backend.".into())
}
