use btleplug::api::Characteristic;
use btleplug::platform::Peripheral;
use parking_lot::Mutex;

/// Thread-safe shared application state accessible from all Tauri commands.
///
/// Uses parking_lot::Mutex for high-performance locking (no async needed).
/// The state is managed by Tauri's `.manage()` system.
pub struct AppState {
    /// The BLE adapter used for scanning and connecting.
    pub ble_adapter: Mutex<Option<btleplug::platform::Adapter>>,
    /// The currently connected cube peripheral (if any).
    pub connected_cube: Mutex<Option<Peripheral>>,
    /// The MAC address of the last connected cube — used for auto-reconnect.
    pub last_cube_mac: Mutex<Option<String>>,
    /// The command characteristic of the connected cube (write).
    #[allow(dead_code)]
    pub cube_command_char: Mutex<Option<Characteristic>>,
    /// The state characteristic of the connected cube (notify).
    #[allow(dead_code)]
    pub cube_state_char: Mutex<Option<Characteristic>>,
    /// The currently connected timer peripheral (if any).
    pub connected_timer: Mutex<Option<Peripheral>>,
    /// The state characteristic of the connected timer (notify) — emits timer events.
    pub timer_state_char: Mutex<Option<Characteristic>>,
    /// The time characteristic of the connected timer (read) — stores recorded times.
    pub timer_time_char: Mutex<Option<Characteristic>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            ble_adapter: Mutex::new(None),
            connected_cube: Mutex::new(None),
            last_cube_mac: Mutex::new(None),
            cube_command_char: Mutex::new(None),
            cube_state_char: Mutex::new(None),
            connected_timer: Mutex::new(None),
            timer_state_char: Mutex::new(None),
            timer_time_char: Mutex::new(None),
        }
    }
}
