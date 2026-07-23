pub mod cube;
pub mod timer;

// ── GAN Smart Cube BLE Service UUIDs ──────────────────────────────────────
// These match the UUIDs defined in packages/gan-protocol/src/gan-cube-definitions.ts

/// GAN Gen2 service (GAN Mini ui, GAN12 ui, GAN356 i Carry, GAN356 i 3, Monster Go 3Ai)
#[allow(dead_code)]
pub const GAN_GEN2_SERVICE: &str = "0000fff0-0000-1000-8000-00805f9b34fb";
/// GAN Gen3 service (GAN356 i Carry 2)
#[allow(dead_code)]
pub const GAN_GEN3_SERVICE: &str = "0000fff0-0000-1000-8000-00805f9b34fb";
/// GAN Gen4 service (GAN12 ui Maglev, GAN14 ui FreePlay)
#[allow(dead_code)]
pub const GAN_GEN4_SERVICE: &str = "0000fff0-0000-1000-8000-00805f9b34fb";

/// All known GAN cube service UUIDs — used for scanning filters.
/// Reserved for future GATT-level service discovery.
#[allow(dead_code)]
pub const GAN_CUBE_SERVICES: &[&str] = &[
    GAN_GEN2_SERVICE,
    GAN_GEN3_SERVICE,
    GAN_GEN4_SERVICE,
];

/// Device name prefixes used to identify GAN cubes during BLE scanning
pub const GAN_CUBE_NAME_PREFIXES: &[&str] = &["GAN", "MG", "AiCube"];
