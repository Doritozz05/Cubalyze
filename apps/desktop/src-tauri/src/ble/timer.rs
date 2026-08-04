use btleplug::api::{Central, CharPropFlags, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::{Adapter, Peripheral};
use futures::StreamExt;
use tauri::{AppHandle, Emitter, State};
use crate::debug_log;
use crate::state::AppState;
use super::{
    GAN_TIMER_SERVICE, GAN_TIMER_TIME_CHAR, GAN_TIMER_STATE_CHAR,
    GAN_TIMER_NAME_PREFIXES,
};

// ── Helpers ──────────────────────────────────────────────────────────────

async fn get_adapter(state: &AppState) -> Result<Adapter, String> {
    if let Some(adapter) = state.ble_adapter.lock().clone() {
        return Ok(adapter);
    }
    let manager = btleplug::platform::Manager::new().await
        .map_err(|e| format!("BLE manager init failed: {}", e))?;
    let adapters = manager.adapters().await
        .map_err(|e| format!("No BLE adapters: {}", e))?;
    let adapter = adapters.into_iter().next()
        .ok_or_else(|| "No BLE adapter available".to_string())?;
    state.ble_adapter.lock().replace(adapter.clone());
    Ok(adapter)
}

fn is_gan_timer(name: &str) -> bool {
    GAN_TIMER_NAME_PREFIXES.iter().any(|prefix| name.starts_with(prefix))
}

/// CRC-16/CCITT-FALSE (polynomial 0x1021, init 0xFFFF)
/// Matches the TypeScript implementation in gan-smart-timer.ts.
fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

/// Validate a GAN Timer event packet:
/// - Byte 0 must be 0xFE (magic)
/// - CRC-16/CCITT over bytes[2..len-2] must match bytes[len-2..len]
fn validate_timer_event(data: &[u8]) -> bool {
    if data.is_empty() || data[0] != 0xFE {
        return false;
    }
    if data.len() < 4 {
        return false; // Too short for magic + state + CRC
    }
    let event_crc = u16::from_le_bytes([data[data.len() - 2], data[data.len() - 1]]);
    let calculated = crc16_ccitt(&data[2..data.len() - 2]);
    event_crc == calculated
}

/// Timer states matching the TS GanTimerState enum exactly.
#[derive(Debug, Clone, Copy, PartialEq)]
enum TimerState {
    Disconnect  = 0,
    GetSet      = 1,
    HandsOff    = 2,
    Running     = 3,
    Stopped     = 4,
    Idle        = 5,
    HandsOn     = 6,
    Finished    = 7,
}

impl TimerState {
    fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Disconnect),
            1 => Some(Self::GetSet),
            2 => Some(Self::HandsOff),
            3 => Some(Self::Running),
            4 => Some(Self::Stopped),
            5 => Some(Self::Idle),
            6 => Some(Self::HandsOn),
            7 => Some(Self::Finished),
            _ => None,
        }
    }
}

/// Parse a recorded time from raw data at the given offset.
/// Each time entry is 4 bytes: min(u8), sec(u8), msec(u16 LE).
fn parse_time(data: &[u8], offset: usize) -> serde_json::Value {
    if offset + 4 > data.len() {
        return serde_json::json!({ "minutes": 0, "seconds": 0, "milliseconds": 0, "asTimestamp": 0 });
    }
    let min = data[offset] as u32;
    let sec = data[offset + 1] as u32;
    let msec = u16::from_le_bytes([data[offset + 2], data[offset + 3]]) as u32;
    let ts = 60_000 * min + 1000 * sec + msec;
    serde_json::json!({
        "minutes": min,
        "seconds": sec,
        "milliseconds": msec,
        "asTimestamp": ts,
    })
}

/// Build a JSON timer event from validated raw data.
/// Matches the TS buildTimerEvent() and GanTimerEvent interface.
fn build_timer_event(data: &[u8]) -> serde_json::Value {
    let state_val = data.get(3).copied().unwrap_or(0);
    let state_enum = TimerState::from_u8(state_val);
    let state_name = match state_enum {
        Some(s) => match s {
            TimerState::Disconnect => "DISCONNECT",
            TimerState::GetSet => "GET_SET",
            TimerState::HandsOff => "HANDS_OFF",
            TimerState::Running => "RUNNING",
            TimerState::Stopped => "STOPPED",
            TimerState::Idle => "IDLE",
            TimerState::HandsOn => "HANDS_ON",
            TimerState::Finished => "FINISHED",
        },
        None => "UNKNOWN",
    };

    let mut evt = serde_json::json!({
        "state": state_val,
        "stateName": state_name,
    });

    // If STOPPED, parse the recorded time at offset 4 (min, sec, msec)
    if state_val == 4 && data.len() >= 8 {
        evt["recordedTime"] = parse_time(data, 4);
    }

    evt
}

// ── Scan for GAN Timer ─────────────────────────────────────────────────

async fn scan_for_gan_timer(adapter: &Adapter) -> Result<Peripheral, String> {
    adapter.stop_scan().await.ok();
    debug_log!("[BLE Timer] Starting scan for GAN Timer...");

    adapter.start_scan(ScanFilter::default()).await
        .map_err(|e| format!("Scan start failed: {}", e))?;

    for attempt in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let peripherals = adapter.peripherals().await.unwrap_or_default();

        for p in &peripherals {
            if let Ok(Some(props)) = p.properties().await {
                if let Some(ref name) = props.local_name {
                    if is_gan_timer(name) {
                        debug_log!("[BLE Timer] Found: {} ({})", name, p.address());
                        adapter.stop_scan().await.ok();
                        return Ok(p.clone());
                    }
                }
            }
        }

        if attempt == 4 {
            debug_log!("[BLE Timer] Still scanning... (attempts: {})", attempt + 1);
        }
    }

    adapter.stop_scan().await.ok();
    Err("No GAN Timer found nearby. Ensure the timer is turned on.".into())
}

// ── Connect ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn connect_gan_timer(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    debug_log!("[BLE Timer] === connect_gan_timer ===");
    let adapter = get_adapter(&state).await?;

    let _ = app.emit("ble:timer_status", serde_json::json!({
        "status": "connecting",
        "message": "Connecting to GAN Timer..."
    }));

    let device = scan_for_gan_timer(&adapter).await?;
    let address = device.address().to_string();

    debug_log!("[BLE Timer] GATT connecting to {}...", address);
    device.connect().await
        .map_err(|e| format!("GATT connect failed: {}", e))?;
    debug_log!("[BLE Timer] Connected, discovering services...");
    device.discover_services().await
        .map_err(|e| format!("Service discovery failed: {}", e))?;

    // Find timer service and characteristics
    let services = device.services();
    let mut state_char: Option<btleplug::api::Characteristic> = None;
    let mut time_char: Option<btleplug::api::Characteristic> = None;

    for svc in &services {
        let svc_uuid = svc.uuid.to_string().to_lowercase();
        if svc_uuid != GAN_TIMER_SERVICE {
            continue;
        }
        debug_log!("[BLE Timer] Found timer service, scanning characteristics...");
        for ch in &svc.characteristics {
            let ch_uuid = ch.uuid.to_string().to_lowercase();
            if ch_uuid == GAN_TIMER_STATE_CHAR && ch.properties.contains(CharPropFlags::NOTIFY) {
                state_char = Some(ch.clone());
                debug_log!("[BLE Timer]  → state characteristic (notify): {}", ch_uuid);
            }
            if ch_uuid == GAN_TIMER_TIME_CHAR && ch.properties.contains(CharPropFlags::READ) {
                time_char = Some(ch.clone());
                debug_log!("[BLE Timer]  → time characteristic (read): {}", ch_uuid);
            }
        }
    }

    let state_char = state_char.ok_or("Timer state characteristic not found")?;
    let time_char = time_char.ok_or("Timer time characteristic not found")?;

    debug_log!("[BLE Timer] Subscribing to state notifications...");
    device.subscribe(&state_char).await
        .map_err(|e| format!("Notification subscribe failed: {}", e))?;
    debug_log!("[BLE Timer] Subscribed OK");

    // Store in app state
    state.connected_timer.lock().replace(device.clone());
    state.timer_state_char.lock().replace(state_char.clone());
    state.timer_time_char.lock().replace(time_char.clone());

    // Spawn notification listener
    let device_clone = device.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut stream = match device_clone.notifications().await {
            Ok(s) => s,
            Err(_e) => {
                debug_log!("[BLE Timer] Failed to get notification stream: {}", _e);
                return;
            }
        };

        debug_log!("[BLE Timer] Notification listener started");
        while let Some(notification) = stream.next().await {
            if validate_timer_event(&notification.value) {
                let evt = build_timer_event(&notification.value);
                let _ = app_clone.emit("ble:timer_event", &evt);

                // Also emit a generic status for disconnection
                if evt["state"] == 0 {
                    let _ = app_clone.emit("ble:timer_status", serde_json::json!({
                        "status": "disconnected",
                        "message": "Timer disconnected"
                    }));
                }
            } else {
                debug_log!("[BLE Timer] Invalid event data (CRC or magic failed)");
            }
        }
        debug_log!("[BLE Timer] Notification stream ended");
        let _ = app_clone.emit("ble:timer_status", serde_json::json!({
            "status": "disconnected",
            "message": "Timer disconnected"
        }));
    });

    // Read timer name for display
    let name = device.properties().await
        .ok()
        .flatten()
        .and_then(|p| p.local_name)
        .unwrap_or_else(|| "GAN Smart Timer".into());

    let payload = serde_json::json!({
        "status": "connected",
        "name": name,
        "mac": address,
    });
    let _ = app.emit("ble:timer_status", payload.clone());
    debug_log!("[BLE Timer] Connection complete: {}", name);

    Ok(payload)
}

// ── Get Recorded Times ─────────────────────────────────────────────────

#[tauri::command]
pub async fn get_timer_recorded_times(
    _app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let device = state.connected_timer.lock().clone()
        .ok_or("No timer connected")?;
    let time_char = state.timer_time_char.lock().clone()
        .ok_or("Timer time characteristic not found")?;

    let data = device.read(&time_char).await
        .map_err(|e| format!("Failed to read timer time characteristic: {}", e))?;

    // The time characteristic returns 16 bytes: 4 time entries (display + 3 previous),
    // each 4 bytes (min, sec, msec LE).
    if data.len() < 16 {
        return Err("Invalid time characteristic length".into());
    }

    let result = serde_json::json!({
        "displayTime": parse_time(&data, 0),
        "previousTimes": [
            parse_time(&data, 4),
            parse_time(&data, 8),
            parse_time(&data, 12),
        ],
    });

    Ok(result)
}

// ── Disconnect ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn disconnect_gan_timer(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    debug_log!("[BLE Timer] Disconnecting...");
    let peripheral = state.connected_timer.lock().take();
    state.timer_state_char.lock().take();
    state.timer_time_char.lock().take();

    if let Some(p) = peripheral {
        p.disconnect().await
            .map_err(|e| format!("Disconnect failed: {}", e))?;
        let _ = app.emit("ble:timer_status", serde_json::json!({
            "status": "disconnected",
            "message": "Timer disconnected"
        }));
        debug_log!("[BLE Timer] Disconnected OK");
    }
    Ok(())
}
