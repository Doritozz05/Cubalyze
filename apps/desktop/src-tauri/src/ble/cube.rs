use btleplug::api::{Central, CharPropFlags, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::{Adapter, Peripheral};
use btleplug::api::Characteristic;
use futures::StreamExt;
use tauri::{AppHandle, Emitter, Manager, State};
use crate::state::AppState;
use super::{
    GAN_CUBE_NAME_PREFIXES,
    GAN_GEN2_SERVICE, GAN_GEN2_COMMAND, GAN_GEN2_STATE,
    GAN_GEN3_SERVICE, GAN_GEN3_COMMAND, GAN_GEN3_STATE,
    GAN_GEN4_SERVICE, GAN_GEN4_COMMAND, GAN_GEN4_STATE,
};

// ── Helpers ──────────────────────────────────────────────────────────────

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

fn is_gan_cube(name: &str) -> bool {
    GAN_CUBE_NAME_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
}

/// Detect the generation of a GAN cube by matching its advertised service UUIDs.
fn detect_cube_gen(_peripheral: &Peripheral, props: &btleplug::api::PeripheralProperties) -> Option<(&'static str, &'static str, &'static str)> {
    let service_uuids = &props.services;
    for uuid in service_uuids {
        let uuid_str = uuid.to_string().to_lowercase();
        if uuid_str == GAN_GEN2_SERVICE {
            return Some((GAN_GEN2_SERVICE, GAN_GEN2_COMMAND, GAN_GEN2_STATE));
        }
        if uuid_str == GAN_GEN3_SERVICE {
            return Some((GAN_GEN3_SERVICE, GAN_GEN3_COMMAND, GAN_GEN3_STATE));
        }
        if uuid_str == GAN_GEN4_SERVICE {
            return Some((GAN_GEN4_SERVICE, GAN_GEN4_COMMAND, GAN_GEN4_STATE));
        }
    }
    None
}

// ── Background auto-scan ─────────────────────────────────────────────────

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
        let _ = app.emit("ble:devices_found", serde_json::json!({ "cubes": found_cubes }));
        let _ = app.emit("ble:status", serde_json::json!({
            "status": "idle",
            "message": format!("Found {} GAN cube(s)", found_cubes.len())
        }));
    }

    Ok(())
}

// ── Connect / Disconnect ─────────────────────────────────────────────────

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

    adapter.stop_scan().await.ok();
    adapter.start_scan(ScanFilter::default()).await
        .map_err(|e| format!("Scan failed: {}", e))?;

    tokio::time::sleep(std::time::Duration::from_secs(4)).await;

    let peripherals = adapter.peripherals().await
        .map_err(|e| format!("Failed to list peripherals: {}", e))?;

    // Find the target device
    let device = if let Some(ref target_mac) = mac {
        peripherals.iter().find(|p| p.address().to_string() == *target_mac)
            .ok_or_else(|| format!("Cube with MAC {} not found", target_mac))?
    } else {
        let mut device: Option<&Peripheral> = None;
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

    // ── GATT Connect + Service Discovery ─────────────────────────────
    device.connect().await
        .map_err(|e| format!("GATT connect failed: {}", e))?;

    device.discover_services().await
        .map_err(|e| format!("Service discovery failed: {}", e))?;

    // Detect cube generation from advertised services
    let props = device.properties().await
        .ok()
        .flatten()
        .ok_or("Failed to read peripheral properties")?;

    let gen = detect_cube_gen(device, &props)
        .ok_or("Connected but could not identify GAN cube generation — no matching service UUID found")?;

    let (service_uuid, cmd_uuid, state_uuid) = gen;
    let name = props.local_name.unwrap_or_else(|| "Unknown GAN Cube".into());
    let address = device.address().to_string();

    // Find the command characteristic (write) and state characteristic (notify)
    let services = device.services();
    let mut cmd_char: Option<Characteristic> = None;
    let mut state_char: Option<Characteristic> = None;

    for svc in &services {
        if svc.uuid.to_string().to_lowercase() != service_uuid { continue; }
        for ch in &svc.characteristics {
            let ch_uuid = ch.uuid.to_string().to_lowercase();
            if ch_uuid == cmd_uuid && ch.properties.contains(CharPropFlags::WRITE) {
                cmd_char = Some(ch.clone());
            }
            if ch_uuid == state_uuid && ch.properties.contains(CharPropFlags::NOTIFY) {
                state_char = Some(ch.clone());
            }
        }
    }

    let cmd_char = cmd_char.ok_or("Command characteristic not found")?;
    let state_char = state_char.ok_or("State characteristic not found")?;

    // Subscribe to notifications on the state characteristic
    device.subscribe(&state_char).await
        .map_err(|e| format!("Notification subscribe failed: {}", e))?;

    // Clone to an owned Peripheral — the reference to `peripherals` won't
    // survive the function, but the spawned background task needs 'static.
    let device_owned = device.clone();

    // Store connected peripheral and characteristic handles
    state.connected_cube.lock().replace(device_owned.clone());
    state.cube_command_char.lock().replace(cmd_char);
    state.cube_state_char.lock().replace(state_char);
    state.last_cube_mac.lock().replace(address.clone());

    adapter.stop_scan().await.ok();

    // Spawn a background task that polls the BLE notification stream
    // and forwards raw data to the TypeScript protocol layer.
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut stream = match device_owned.notifications().await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[BLE] Failed to get notification stream: {}", e);
                return;
            }
        };

        while let Some(notification) = stream.next().await {
            let _ = app_clone.emit("ble:data", serde_json::json!({
                "value": notification.value,
            }));
        }

        // Stream ended → device disconnected
        let _ = app_clone.emit("ble:status", serde_json::json!({
            "status": "disconnected",
            "message": "Cube disconnected"
        }));
    });

    let payload = serde_json::json!({
        "status": "connected",
        "name": name,
        "mac": address,
        "generation": service_uuid,
    });
    let _ = app.emit("ble:status", payload.clone());

    Ok(payload)
}

/// Tauri command: send an encrypted command to the connected cube.
/// The TypeScript protocol layer handles encryption and command encoding;
/// Rust only writes the bytes to the GATT command characteristic.
#[tauri::command]
pub async fn send_cube_command(
    _app: AppHandle,
    state: State<'_, AppState>,
    data: Vec<u8>,
) -> Result<(), String> {
    let peripheral = state.connected_cube.lock().clone()
        .ok_or("No cube connected")?;

    let cmd_char = state.cube_command_char.lock().clone()
        .ok_or("Command characteristic not discovered")?;

    peripheral.write(&cmd_char, &data, btleplug::api::WriteType::WithoutResponse).await
        .map_err(|e| format!("GATT write failed: {}", e))?;

    Ok(())
}

/// Tauri command: Disconnect from the currently connected GAN cube.
#[tauri::command]
pub async fn disconnect_gan_cube(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let peripheral = state.connected_cube.lock().take();

    // Clear stored characteristic handles
    state.cube_command_char.lock().take();
    state.cube_state_char.lock().take();

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
