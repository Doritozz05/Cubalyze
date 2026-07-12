---
status: "Draft"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-04"
tags: "ops, CD, hosting, infrastructure"
document_type: "RFC"
---

# RFC-007-Hosting_Strategy

## Summary
Este RFC evaluará las estrategias de alojamiento y despliegue (Continuous Deployment) para la aplicación PWA y los microservicios de backend de CubeForge.

## Motivation
Separar la estrategia de alojamiento del pipeline básico de CI (abordado en RFC-006) evita el acoplamiento prematuro. Dado que el backend podría requerir microservicios Node.js complejos o integrarse con Supabase, la decisión de dónde hospedar el frontend (Vercel, AWS, Cloudflare Pages, etc.) debe tomarse evaluando el ecosistema completo y no como una consecuencia del CI.

## Proposed Solution
(Pendiente de investigación. El objetivo es identificar la infraestructura más rentable y escalable de acuerdo con el *System Architecture Overview*).

## Detailed Design
(TBD tras la selección de alternativas)

## Alternatives
*   **Vercel para Frontend + Supabase para BD:** La opción serverless más estándar para frontend, pero que puede quedar corta si requerimos contenedores.
*   **PaaS (Render, Railway, Fly.io):** Si se utilizan contenedores Docker para los microservicios.
*   **AWS / GCP (Servicios manejados):** Mayor control, pero con gran complejidad inicial.

## Unresolved Questions
*   ¿Cuál será la carga de los microservicios en el backend y cómo impacta esto en la decisión de hosting?
*   ¿Vercel es suficiente si el proyecto crece más allá de un SPA estático hacia requerimientos pesados de WebSocket (Sync Engine)?
