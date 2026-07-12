---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-04"
tags: "ops, CD, hosting, infrastructure, vercel, supabase"
document_type: "RFC"
---

# RFC-007-Hosting_Strategy

## Summary
Este RFC evaluará las estrategias de alojamiento y despliegue (Continuous Deployment) para la aplicación PWA y los microservicios de backend de CubeForge.

## Motivation
Separar la estrategia de alojamiento del pipeline básico de CI (abordado en RFC-006) evita el acoplamiento prematuro. Se requiere un entorno "Full Gratuito" que soporte el desarrollo, MVP y primeros compases de producción sin requerir administración de servidores, encajando a la perfección con la arquitectura estática de la PWA.

## Proposed Solution
Se empleará la combinación de **Vercel** para el alojamiento del frontend estático y **Supabase** como Backend-as-a-Service (BaaS) relacional.

## Detailed Design
1. **Vercel:** La aplicación React+Vite se compilará a un `dist` estático (SPA). Vercel alojará estos archivos en su CDN global de forma gratuita. Al no haber SSR (Server-Side Rendering), el consumo de Serverless Functions será cero.
2. **Supabase:** Se usará como Postgres administrado. Los usuarios se identificarán a través de Supabase Auth. Los tiempos del cronómetro y sesiones se guardarán localmente (offline-first) y luego se sincronizarán mediante llamadas a la API REST de Supabase automáticamente generada por PostgREST. Esto evita requerir un servidor Node.js/Go intermedio consumiendo memoria 24/7.

## Alternatives
*   **Vercel para Frontend + Supabase para BD:** (Solución Escogida).
*   **PaaS (Render, Railway, Fly.io):** Si se utilizaran contenedores Docker para los microservicios Node.js, pero se ha decidido prescindir de ellos a favor del BaaS.
*   **AWS / GCP (Servicios manejados):** Mayor control, pero con gran complejidad inicial y riesgo de costes imprevistos.

## Unresolved Questions
*   Si a futuro se implementan funcionalidades multijugador en tiempo real (ej: "batallas de tiempos"), ¿serán suficientes las conexiones concurrentes del nivel gratuito de Supabase Realtime?
