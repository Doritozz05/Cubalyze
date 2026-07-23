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
        eprintln!("[BLE DEBUG] Reusing cached BLE adapter");
        return Ok(adapter);
    }
    eprintln!("[BLE DEBUG] Initializing BLE Manager...");
    let manager = btleplug::platform::Manager::new().await
        .map_err(|e| {
            eprintln!("[BLE DEBUG] BLE Manager init FAILED: {}", e);
            format!("BLE manager init failed: {}", e)
        })?;
    eprintln!("[BLE DEBUG] BLE Manager initialized OK");

    let adapters = manager.adapters().await
        .map_err(|e| {
            eprintln!("[BLE DEBUG] No BLE adapters: {}", e);
            format!("No BLE adapters found: {}", e)
        })?;
    eprintln!("[BLE DEBUG] Found {} BLE adapter(s)", adapters.len());

    let adapter = adapters.into_iter().next()
        .ok_or_else(|| {
            eprintln!("[BLE DEBUG] No BLE adapter available");
            "No BLE adapter available — check Bluetooth is enabled"
        })?;
    eprintln!("[BLE DEBUG] Using BLE adapter");
    state.ble_adapter.lock().replace(adapter.clone());
    Ok(adapter)
}

fn is_gan_cube(name: &str) -> bool {
    GAN_CUBE_NAME_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
}

/// Detect GAN cube generation by matching discovered GATT service UUIDs
/// (not advertised services — those may be empty after GATT connect).
/// Mirrors the Web Bluetooth approach: iterates gatt.getPrimaryServices().
fn detect_cube_gen_from_services(services: &std::collections::BTreeSet<btleplug::api::Service>) -> Option<(&'static str, &'static str, &'static str)> {
    eprintln!("[BLE DEBUG] detect_cube_gen_from_services: {} discovered services", services.len());
    for svc in services {
        let uuid_str = svc.uuid.to_string().to_lowercase();
        eprintln!("[BLE DEBUG]   service: {}", uuid_str);
        if uuid_str == GAN_GEN2_SERVICE {
            eprintln!("[BLE DEBUG]   → matched GEN2");
            return Some((GAN_GEN2_SERVICE, GAN_GEN2_COMMAND, GAN_GEN2_STATE));
        }
        if uuid_str == GAN_GEN3_SERVICE {
            eprintln!("[BLE DEBUG]   → matched GEN3");
            return Some((GAN_GEN3_SERVICE, GAN_GEN3_COMMAND, GAN_GEN3_STATE));
        }
        if uuid_str == GAN_GEN4_SERVICE {
            eprintln!("[BLE DEBUG]   → matched GEN4");
            return Some((GAN_GEN4_SERVICE, GAN_GEN4_COMMAND, GAN_GEN4_STATE));
        }
    }
    eprintln!("[BLE DEBUG]   → no GAN generation matched");
    None
}

/// Look through cached peripherals (no active scan) for a GAN cube.
async fn find_cached_gan_cube(
    adapter: &Adapter,
    target_mac: Option<&str>,
) -> Option<Peripheral> {
    let peripherals = adapter.peripherals().await.ok()?;
    eprintln!("[BLE DEBUG] find_cached: {} cached peripherals, target_mac={:?}", peripherals.len(), target_mac);
    for (i, p) in peripherals.iter().enumerate() {
        let addr = p.address().to_string();
        if let Some(mac) = target_mac {
            if addr.eq_ignore_ascii_case(mac) {
                eprintln!("[BLE DEBUG] find_cached: FOUND by MAC match: {}", addr);
                return Some(p.clone());
            }
            continue;
        }
        if let Ok(Some(props)) = p.properties().await {
            let name = props.local_name.unwrap_or_default();
            eprintln!("[BLE DEBUG] find_cached[{}]: addr={} name=\"{}\"", i, addr, name);
            if is_gan_cube(&name) {
                eprintln!("[BLE DEBUG] find_cached: FOUND GAN cube: {}", name);
                return Some(p.clone());
            }
        }
    }
    eprintln!("[BLE DEBUG] find_cached: no GAN cube in cache");
    None
}

/// Short-circuit scan: poll peripherals every 500ms and stop the moment a
/// GAN cube appears. Uses ScanFilter::default() to avoid filtering out
/// cubes that don't advertise GAN service UUIDs during active scanning.
async fn scan_for_gan_cube(
    adapter: &Adapter,
    target_mac: Option<&str>,
) -> Option<Peripheral> {
    adapter.stop_scan().await.ok();

    eprintln!("[BLE DEBUG] Starting BLE scan (ScanFilter::default)...");
    if let Err(e) = adapter.start_scan(ScanFilter::default()).await {
        eprintln!("[BLE DEBUG] Scan start FAILED: {}", e);
        return None;
    }
    eprintln!("[BLE DEBUG] Scan active — polling every 500ms...");

    for attempt in 0..16 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(peripherals) = adapter.peripherals().await {
            eprintln!("[BLE DEBUG] Scan poll #{}: {} peripherals visible", attempt + 1, peripherals.len());
            for (i, p) in peripherals.iter().enumerate() {
                let addr = p.address().to_string();

                if let Some(mac) = target_mac {
                    if addr.eq_ignore_ascii_case(mac) {
                        eprintln!("[BLE DEBUG]   [{}] addr={} → FOUND by MAC", i, addr);
                        adapter.stop_scan().await.ok();
                        return Some(p.clone());
                    }
                }

                match p.properties().await {
                    Ok(Some(props)) => {
                        let name = props.local_name.unwrap_or_default();
                        let rssi = props.rssi.map(|r| r.to_string()).unwrap_or_default();
                        let svc_count = props.services.len();
                        eprintln!("[BLE DEBUG]   [{}] addr={} name=\"{}\" rssi={} services={}",
                            i, addr, name, rssi, svc_count);
                        if is_gan_cube(&name) {
                            eprintln!("[BLE DEBUG]   → STOPPING SCAN: GAN cube found!");
                            adapter.stop_scan().await.ok();
                            return Some(p.clone());
                        }
                    }
                    Ok(None) => {
                        eprintln!("[BLE DEBUG]   [{}] addr={} (no properties)", i, addr);
                    }
                    Err(e) => {
                        eprintln!("[BLE DEBUG]   [{}] addr={} props error: {}", i, addr, e);
                    }
                }
            }
        }
    }

    eprintln!("[BLE DEBUG] Scan exhausted — no GAN cube found");
    adapter.stop_scan().await.ok();
    None
}

// ── Connect helpers ────────────────────────────────────────────────────

async fn do_gatt_connect(
    device: &Peripheral,
    state: &AppState,
    app: &AppHandle,
) -> Result<serde_json::Value, String> {
    eprintln!("[BLE DEBUG] GATT connecting to {}...", device.address());
    device.connect().await
        .map_err(|e| {
            eprintln!("[BLE DEBUG] GATT connect FAILED: {}", e);
            format!("GATT connect failed: {}", e)
        })?;
    eprintln!("[BLE DEBUG] GATT connected OK");

    eprintln!("[BLE DEBUG] Discovering services...");
    device.discover_services().await
        .map_err(|e| {
            eprintln!("[BLE DEBUG] Service discovery FAILED: {}", e);
            format!("Service discovery failed: {}", e)
        })?;
    eprintln!("[BLE DEBUG] Services discovered OK");

    // ⚠ CRITICAL: Use discovered GATT services (device.services()), NOT
    // advertised services (props.services). After GATT connect, the
    // advertised services list is often empty. The Web Bluetooth API
    // uses gatt.getPrimaryServices() — this is the equivalent.
    let services = device.services();
    let gen = detect_cube_gen_from_services(&services)
        .ok_or("Connected but could not identify GAN cube generation — no matching service UUID found")?;

    let (service_uuid, cmd_uuid, state_uuid) = gen;

    // Read device name from properties (advertised data — still available)
    let name = device.properties().await
        .ok()
        .flatten()
        .map(|props| props.local_name.unwrap_or_default())
        .unwrap_or_else(|| "Unknown GAN Cube".into());
    let address = device.address().to_string();
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

    eprintln!("[BLE DEBUG] Subscribing to notifications...");
    device.subscribe(&state_char).await
        .map_err(|e| format!("Notification subscribe failed: {}", e))?;
    eprintln!("[BLE DEBUG] Subscribed OK");

    let device_owned = device.clone();

    state.connected_cube.lock().replace(device_owned.clone());
    state.cube_command_char.lock().replace(cmd_char);
    state.cube_state_char.lock().replace(state_char);
    state.last_cube_mac.lock().replace(address.clone());

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
    eprintln!("[BLE DEBUG] Connection complete: {} ({})", name, address);

    Ok(payload)
}

// ── Diagnostic command ─────────────────────────────────────────────────

#[tauri::command]
pub async fn debug_ble_status(app: AppHandle) -> Result<serde_json::Value, String> {
    eprintln!("[BLE DEBUG] === BLE DIAGNOSTIC ===");
    let state = app.state::<AppState>();

    // Check if adapter is cached
    let has_cached = state.ble_adapter.lock().is_some();
    eprintln!("[BLE DEBUG] Cached adapter: {}", has_cached);

    // Try to init adapter
    let adapter = match get_or_init_adapter(&state).await {
        Ok(a) => a,
        Err(e) => {
            return Ok(serde_json::json!({
                "ok": false,
                "error": e,
                "cached_adapter": has_cached,
            }));
        }
    };

    // List cached peripherals (no scan)
    let cached = adapter.peripherals().await
        .map_err(|e| format!("Failed to list: {}", e))?;
    eprintln!("[BLE DEBUG] Cached peripherals: {}", cached.len());

    let mut cached_info = Vec::new();
    for p in &cached {
        let addr = p.address().to_string();
        let name = if let Ok(Some(props)) = p.properties().await {
            props.local_name.unwrap_or_default()
        } else {
            String::new()
        };
        let connected = p.is_connected().await.unwrap_or(false);
        cached_info.push(serde_json::json!({
            "address": addr,
            "name": name,
            "is_gan": is_gan_cube(&name),
            "is_connected": connected,
        }));
    }

    // Also check connected cube state
    let connected_mac = state.last_cube_mac.lock().clone();
    let has_connected = state.connected_cube.lock().is_some();

    eprintln!("[BLE DEBUG] === DIAGNOSTIC COMPLETE ===");

    Ok(serde_json::json!({
        "ok": true,
        "cached_adapter": has_cached,
        "cached_peripherals": cached.len(),
        "peripherals": cached_info,
        "stored_mac": connected_mac,
        "has_connected_cube": has_connected,
    }))
}

// ── Background auto-scan ────────────────────────────────────────────────

#[tauri::command]
pub async fn start_auto_scan(app: AppHandle) -> Result<(), String> {
    eprintln!("[BLE DEBUG] === start_auto_scan ===");
    let state = app.state::<AppState>();
    let adapter = get_or_init_adapter(&state).await?;

    let peripherals = adapter.peripherals().await
        .map_err(|e| format!("Failed to list peripherals: {}", e))?;
    eprintln!("[BLE DEBUG] Auto-scan: {} cached peripherals", peripherals.len());

    let mut has_cubes = false;
    for p in &peripherals {
        if let Ok(Some(props)) = p.properties().await {
            let name = props.local_name.unwrap_or_default();
            if is_gan_cube(&name) {
                has_cubes = true;
                break;
            }
        }
    }

    if !has_cubes {
        eprintln!("[BLE DEBUG] Auto-scan: no GAN in cache, starting scan...");
        let _ = app.emit("ble:status", serde_json::json!({
            "status": "scanning",
            "message": "Looking for GAN cubes..."
        }));

        if let Some(device) = scan_for_gan_cube(&adapter, None).await {
            let name = if let Ok(Some(props)) = device.properties().await {
                props.local_name.unwrap_or_default()
            } else {
                "Unknown".into()
            };
            let address = device.address().to_string();

            let _ = app.emit("ble:devices_found", serde_json::json!({
                "cubes": [{
                    "name": name,
                    "address": address,
                }]
            }));
            let _ = app.emit("ble:status", serde_json::json!({
                "status": "idle",
                "message": "Found 1 GAN cube"
            }));
            return Ok(());
        }
    }

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

// ── Connect / Reconnect / Disconnect ──────────────────────────────────

#[tauri::command]
pub async fn connect_gan_cube(
    app: AppHandle,
    state: State<'_, AppState>,
    mac: Option<String>,
) -> Result<serde_json::Value, String> {
    eprintln!("[BLE DEBUG] === connect_gan_cube mac={:?} ===", mac);
    let adapter = get_or_init_adapter(&state).await?;

    let _ = app.emit("ble:status", serde_json::json!({
        "status": "connecting",
        "message": "Connecting to cube..."
    }));

    // Strategy 1: cached MAC → direct
    if mac.is_none() {
        let cached_mac = state.last_cube_mac.lock().clone();
        if let Some(ref addr) = cached_mac {
            eprintln!("[BLE DEBUG] Strategy 1: trying cached MAC {}", addr);
            if let Some(device) = find_cached_gan_cube(&adapter, Some(addr)).await {
                let result = do_gatt_connect(&device, &state, &app).await;
                if result.is_ok() {
                    return result;
                }
                eprintln!("[BLE DEBUG] Strategy 1 FAILED for {} — falling through", addr);
            }
        }
    }

    // Strategy 2: cached peripherals (no scan)
    eprintln!("[BLE DEBUG] Strategy 2: checking cached peripherals");
    let target_mac = mac.as_deref();
    if let Some(device) = find_cached_gan_cube(&adapter, target_mac).await {
        return do_gatt_connect(&device, &state, &app).await;
    }

    // Strategy 3: active scan
    eprintln!("[BLE DEBUG] Strategy 3: active scan");
    if let Some(device) = scan_for_gan_cube(&adapter, target_mac).await {
        return do_gatt_connect(&device, &state, &app).await;
    }

    eprintln!("[BLE DEBUG] === ALL STRATEGIES FAILED ===");
    Err("No GAN cube found nearby. Make sure the cube is turned on and in range.".into())
}

#[tauri::command]
pub async fn reconnect_gan_cube(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let adapter = get_or_init_adapter(&state).await?;

    let cached_mac = state.last_cube_mac.lock().clone()
        .ok_or("No previously connected cube to reconnect to")?;

    let _ = app.emit("ble:status", serde_json::json!({
        "status": "reconnecting",
        "message": "Reconnecting to last cube..."
    }));

    if let Some(device) = find_cached_gan_cube(&adapter, Some(&cached_mac)).await {
        return do_gatt_connect(&device, &state, &app).await;
    }

    if let Some(device) = scan_for_gan_cube(&adapter, Some(&cached_mac)).await {
        return do_gatt_connect(&device, &state, &app).await;
    }

    Err(format!("Could not reconnect to cube {}", cached_mac))
}

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

#[tauri::command]
pub async fn disconnect_gan_cube(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let peripheral = state.connected_cube.lock().take();

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

#[tauri::command]
pub fn is_cube_connected(state: State<'_, AppState>) -> bool {
    state.connected_cube.lock().is_some()
}
