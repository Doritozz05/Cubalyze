use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::Adapter;
use tauri::{AppHandle, Emitter, Manager, State};
use crate::state::AppState;
use super::{GAN_CUBE_NAME_PREFIXES};

/// Initialize the BLE adapter and store it in AppState.
/// Called once at app startup.
async fn get_or_init_adapter(state: &AppState) -> Result<Adapter, String> {
    if let Some(adapter) = state.ble_adapter.lock().clone() {
        return Ok(adapter);
    }

    let manager = btleplug::platform::Manager::new().await
        .map_err(|e| format!("BLE manager init failed: {}", e))?;

    let adapters = manager.adapters().await
        .map_err(|e| format!("No BLE adapters found: {}", e))?;

    let adapter = adapters.into_iter().next()
        .ok_or("No BLE adapter available — check Bluetooth is enabled")?;

    state.ble_adapter.lock().replace(adapter.clone());
    Ok(adapter)
}

/// Check if a peripheral is a GAN cube based on its advertised name.
fn is_gan_cube(name: &str) -> bool {
    GAN_CUBE_NAME_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
}

/// Background auto-scan: starts scanning for GAN cubes and emits events to the frontend.
/// Runs as a Tokio background task — does NOT block the app startup.
#[tauri::command]
pub async fn start_auto_scan(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let adapter = get_or_init_adapter(&state).await?;

    let _ = app.emit("ble:status", serde_json::json!({
        "status": "scanning",
        "message": "Looking for GAN cubes..."
    }));

    adapter.start_scan(ScanFilter::default()).await
        .map_err(|e| format!("BLE scan start failed: {}", e))?;

    // Let the scan run for a few seconds to discover devices
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    let peripherals = adapter.peripherals().await
        .map_err(|e| format!("Failed to list peripherals: {}", e))?;

    let mut found_cubes = Vec::new();
    for p in &peripherals {
        if let Ok(Some(props)) = p.properties().await {
            let name = props.local_name.unwrap_or_default();
            if is_gan_cube(&name) {
                found_cubes.push(serde_json::json!({
                    "name": name,
                    "address": p.address().to_string(),
                }));
            }
        }
    }

    adapter.stop_scan().await.ok();

    if found_cubes.is_empty() {
        let _ = app.emit("ble:status", serde_json::json!({
            "status": "idle",
            "message": "No GAN cubes found nearby"
        }));
    } else {
        let _ = app.emit("ble:devices_found", serde_json::json!({
            "cubes": found_cubes
        }));
        let _ = app.emit("ble:status", serde_json::json!({
            "status": "idle",
            "message": format!("Found {} GAN cube(s)", found_cubes.len())
        }));
    }

    Ok(())
}

/// Tauri command: Connect to a GAN cube.
/// If `mac` is provided, connects directly. Otherwise auto-discovers the first GAN cube.
#[tauri::command]
pub async fn connect_gan_cube(
    app: AppHandle,
    state: State<'_, AppState>,
    mac: Option<String>,
) -> Result<serde_json::Value, String> {
    let adapter = get_or_init_adapter(&state).await?;

    let _ = app.emit("ble:status", serde_json::json!({
        "status": "connecting",
        "message": "Connecting to cube..."
    }));

    // Stop any existing scan, then start fresh
    adapter.stop_scan().await.ok();
    adapter.start_scan(ScanFilter::default()).await
        .map_err(|e| format!("Scan failed: {}", e))?;

    // Give the scan time to discover devices
    tokio::time::sleep(std::time::Duration::from_secs(4)).await;

    let peripherals = adapter.peripherals().await
        .map_err(|e| format!("Failed to list peripherals: {}", e))?;

    // Find the target device
    let device = if let Some(ref target_mac) = mac {
        peripherals.iter().find(|p| p.address().to_string() == *target_mac)
            .ok_or_else(|| format!("Cube with MAC {} not found", target_mac))?
    } else {
        // Auto-detect first GAN cube nearby — iterate with proper async await
        let mut device: Option<&btleplug::platform::Peripheral> = None;
        for p in &peripherals {
            if let Ok(Some(props)) = p.properties().await {
                let name = props.local_name.unwrap_or_default();
                if is_gan_cube(&name) {
                    device = Some(p);
                    break;
                }
            }
        }
        device.ok_or("No GAN cube found nearby")?
    };

    // Connect to GATT
    device.connect().await
        .map_err(|e| format!("GATT connect failed: {}", e))?;

    // Discover services & characteristics
    device.discover_services().await
        .map_err(|e| format!("Service discovery failed: {}", e))?;

    // Get device info
    let name = device.properties().await
        .ok()
        .flatten()
        .and_then(|p| p.local_name)
        .unwrap_or_else(|| "Unknown GAN Cube".into());

    let address = device.address().to_string();

    // Store in state
    state.connected_cube.lock().replace(device.clone());
    state.last_cube_mac.lock().replace(address.clone());

    adapter.stop_scan().await.ok();

    let payload = serde_json::json!({
        "status": "connected",
        "name": name,
        "mac": address,
    });
    let _ = app.emit("ble:status", payload.clone());

    Ok(payload)
}

/// Tauri command: Disconnect from the currently connected GAN cube.
#[tauri::command]
pub async fn disconnect_gan_cube(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let peripheral = state.connected_cube.lock().take();
    if let Some(p) = peripheral {
        p.disconnect().await
            .map_err(|e| format!("Disconnect failed: {}", e))?;
        let _ = app.emit("ble:status", serde_json::json!({
            "status": "disconnected",
            "message": "Cube disconnected"
        }));
    }
    Ok(())
}

/// Tauri command: Check if a cube is currently connected.
#[tauri::command]
pub fn is_cube_connected(state: State<'_, AppState>) -> bool {
    state.connected_cube.lock().is_some()
}
