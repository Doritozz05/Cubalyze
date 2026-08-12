# 10 — Seguridad

> Estado real (2026-08-12): la seguridad del proyecto está documentada en los
> ADRs y en las configuraciones desplegadas; aquí el punto de entrada.

## Postura actual

- **Local-first**: la mayoría de datos nunca salen del dispositivo (reduce
  superficie de ataque).
- **CSP estricta** en producción (web en Vercel y desktop Tauri): sin
  `unsafe-inline`, `worker-src blob:`, `connect-src` acotado —
  [`../11-devops/Deploy_and_Hosting.md`](../11-devops/Deploy_and_Hosting.md).
- **Permissions-Policy** bloquea cámara/geolocalización/pago/USB (vercel.json).
- **Widgets**: solo built-ins; los widgets custom por URL **se eliminaron** por
  el modelo local-first (ADR-026).
- **BLE**: logs `debug_log!` que no filtran MACs/nombres en release (ADR-027).

## Dónde está documentado

| Tema | Lugar |
|---|---|
| Crypto/firmas (decidido, **no implementado**) | ADR-018 |
| CSP y cabeceras de producción | [`../11-devops/Deploy_and_Hosting.md`](../11-devops/Deploy_and_Hosting.md) |
| Seguridad del protocolo GAN (BLE cifrado) | `docs/06-api/hardware.md` + `@cubeforge/gan-protocol` |
| Policy de reportes de vulnerabilidades | [`SECURITY.md`](../../SECURITY.md) (raíz) |

## Pendiente

- Las firmas criptográficas de ADR-018 (asociadas al backend diferido).
- Modelo de amenazas formal (cuando exista sync en la nube).
