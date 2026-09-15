---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-08-12"
version: "1.1.0"
related_rfc: "RFC-012-Web_Bluetooth_Mobile_Fallbacks"
tags: "hardware, bluetooth, ios, capacitor, pwa"
document_type: "ADR"
---

# ADR-012-Web_Bluetooth_Mobile_Fallbacks

## Context and Problem Statement
La conexión a Smart Cubes vía Bluetooth es clave para CubeForge. Mientras en escritorio y Android se puede usar la API Web nativa (`navigator.bluetooth`), Safari en iOS carece de este soporte. Debemos resolver la limitación para los usuarios de iPhone sin duplicar esfuerzos creando una app nativa completa (Swift).

## Decision Drivers
*   **DRY (Don't Repeat Yourself):** Usar el mismo código frontend (React/Vite) para web, Android y iOS.
*   **Soporte iOS:** Asegurar conectividad BLE en dispositivos de Apple.

## Considered Options
*   **Opción 1:** Obligar al uso de navegadores especializados de terceros en iOS (WebBLE).
*   **Opción 2:** Envolver la SPA con Capacitor.js y usar un plugin BLE nativo para iOS.

## Decision Outcome
Chosen option: **Hardware Abstraction Layer (HAL) + Tauri para escritorio** (Capacitor para iOS diferido).

> **Estado de implementación (2026-08-12):** la app de escritorio `apps/desktop` está implementada con **Tauri** (plugins `@tauri-apps/api`, `plugin-sql`, `plugin-updater`), no con Capacitor como planteaba la decisión original. Los adaptadores `GanCubeAdapterTauri.ts` y `GanTimerAdapterTauri.ts` extienden la interfaz del HAL (`@cubalyze/hardware-hal`) para el entorno Tauri; en navegador (web/PWA) se usa Web Bluetooth nativo. El wrapper móvil (Capacitor para iOS App Store) sigue diferido (DEC-22, bloqueado hasta Milestone 2+).

### Positive Consequences
*   Permite lanzar CubeForge en la App Store de Apple sin reescribir la UI o el Core matemático.
*   Asegura experiencia de hardware premium en iPhone.

### Negative Consequences
*   Mayor sobrecarga al requerir mantener entornos de compilación Xcode/Android Studio para publicar los wrappers de Capacitor, aunque el código siga siendo web.
