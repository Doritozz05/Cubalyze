//! Conditional debug logging.
//!
//! `debug_log!` only writes to stderr in debug builds (`debug_assertions`).
//! In release builds the macro expands to nothing, so BLE device names,
//! MAC addresses and other diagnostic detail never leak to stderr in
//! production — while `cargo run` / `cargo build` (dev) keeps full logs.
//!
//! Real error paths still return a user-facing `Err(...)` to the frontend;
//! use `debug_log!` for the diagnostics around them.

/// Log a message to stderr in debug builds only.
#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        {
            eprintln!($($arg)*);
        }
    };
}
