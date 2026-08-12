# Overview — Visión de Alto Nivel de la Arquitectura

Documentos que describen el sistema a vista de pájaro: qué piezas existen, cómo
se relacionan y por qué. El punto de entrada es
[`System_Architecture_Overview.md`](./System_Architecture_Overview.md).

## Contenido

- `System_Architecture_Overview.md` — el mapa del sistema (apps, packages, flujos).
- `research/` — informes de investigación previos a decisiones (Bluetooth, PWA
  storage, auditoría legal).
- `diagrams/` — diagramas de la arquitectura (ver README de esa carpeta).
- `../Widgets_System.md` — arquitectura del sistema de widgets (SDK, dock,
  store) con fichas por implementación en `../widgets/`.
- `../web/` — arquitectura de la app web: estado/stores, componentes, hooks,
  servicios y lib.
- `../Desktop_App.md` — la app de escritorio Tauri (puente BLE, overrides de
  base de datos y hardware, decisión de `apps/api` vacío).
- `../validation/` — auditorías de que la arquitectura coincide con el código.
