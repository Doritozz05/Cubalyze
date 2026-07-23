pub mod cube;
pub mod timer;

// ── GAN Smart Cube BLE Service UUIDs ──────────────────────────────────────
// Source: packages/gan-protocol/src/gan-cube-definitions.ts
//
// GAN uses different service UUIDs per hardware generation.
// The Rust backend probes all three on connect and uses whichever matches.

/// Gen2 (GAN Mini ui, GAN12 ui, GAN356 i Carry, GAN356 i 3, Monster Go 3Ai)
#[allow(dead_code)]
pub const GAN_GEN2_SERVICE: &str = "6e400001-b5a3-f393-e0a9-e50e24dc4179";
/// Gen2 command characteristic (write)
#[allow(dead_code)]
pub const GAN_GEN2_COMMAND: &str = "28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4";
/// Gen2 state characteristic (notify)
#[allow(dead_code)]
pub const GAN_GEN2_STATE: &str = "28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4";

/// Gen3 (GAN356 i Carry 2)
#[allow(dead_code)]
pub const GAN_GEN3_SERVICE: &str = "8653000a-43e6-47b7-9cb0-5fc21d4ae340";
/// Gen3 command characteristic (write)
#[allow(dead_code)]
pub const GAN_GEN3_COMMAND: &str = "8653000c-43e6-47b7-9cb0-5fc21d4ae340";
/// Gen3 state characteristic (notify)
#[allow(dead_code)]
pub const GAN_GEN3_STATE: &str = "8653000b-43e6-47b7-9cb0-5fc21d4ae340";

/// Gen4 (GAN12 ui Maglev, GAN14 ui FreePlay)
#[allow(dead_code)]
pub const GAN_GEN4_SERVICE: &str = "00000010-0000-fff7-fff6-fff5fff4fff0";
/// Gen4 command characteristic (write)
#[allow(dead_code)]
pub const GAN_GEN4_COMMAND: &str = "0000fff5-0000-1000-8000-00805f9b34fb";
/// Gen4 state characteristic (notify)
#[allow(dead_code)]
pub const GAN_GEN4_STATE: &str = "0000fff6-0000-1000-8000-00805f9b34fb";

/// Device name prefixes used to identify GAN cubes during BLE scanning
pub const GAN_CUBE_NAME_PREFIXES: &[&str] = &["GAN", "MG", "AiCube"];
