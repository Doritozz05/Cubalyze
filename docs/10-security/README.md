# 10 — Seguridad

> Estado real (2026-08-12): la seguridad del proyecto está documentada en los
> ADRs y en las configuraciones desplegadas; aquí el punto de entrada.

## Postura actual

- **Local-first**: la mayoría de datos nunca salen del dispositivo (reduce
  superficie de ataque).
- **CSP estricta** en producción (web en Vercel y desktop Tauri):
  `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` y
  `worker-src blob:` —
  [`../11-devops/Deploy_and_Hosting.md`](../11-devops/Deploy_and_Hosting.md).
  **Pendiente real:** `connect-src` permite hoy **cualquier** https
  (`'self' https: wss:`), no está acotado al origen de Supabase. Ver
  auditoría §M3; acotarlo es el paso P2 del plan de remediación.
- **Permissions-Policy** bloquea cámara/geolocalización/pago/USB (vercel.json).
- **Widgets**: solo built-ins; los widgets custom por URL **se eliminaron** por
  el modelo local-first (ADR-026).
- **BLE**: logs `debug_log!` que no filtran MACs/nombres en release (ADR-027).

## Dónde está documentado

| Tema | Lugar |
|---|---|
| Crypto/firmas (decidido, **no implementado**) | ADR-018 |
| CSP y cabeceras de producción | [`../11-devops/Deploy_and_Hosting.md`](../11-devops/Deploy_and_Hosting.md) |
| Seguridad del protocolo GAN (BLE cifrado) | `docs/06-api/hardware.md` + `@cubalyze/gan-protocol` |
| Policy de reportes de vulnerabilidades | [`SECURITY.md`](../../SECURITY.md) (raíz) |
| **Auditoría 2026-09-12** (RLS, sync, cuentas, cuotas) | [`Auditoria-2026-09-12.md`](./Auditoria-2026-09-12.md) |

## Pendiente

- Las firmas criptográficas de ADR-018 (asociadas al backend diferido).
- Modelo de amenazas formal (cuando exista sync en la nube).
- Los arreglos **P1–P7** de la
  [auditoría 2026-09-12](./Auditoria-2026-09-12.md#7-plan-de-remediación-priorizado).
  Los tres hallazgos de integridad del sync (C1, A1, H3) **ya están corregidos y
  desplegados** en la migración `20260912000015`.
