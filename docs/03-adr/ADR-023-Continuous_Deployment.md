---
status: "Accepted"
owner: "Ops Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-15, DEC-23"
tags: "ops, CD, deployment, vercel, supabase"
document_type: "ADR"
---

# ADR-023-Continuous_Deployment

## Summary
Este RFC formaliza la estrategia de **Continuous Deployment (CD)** para el ciclo de vida del frontend (PWA) en **Vercel** y la base de datos backend en **Supabase**. Se establece que cualquier "merge" a la rama `main` resultarÃ¡ en un despliegue inmutable y automÃ¡tico en ProducciÃ³n, previas validaciones de CI.

## Motivation
Tras asegurar la integraciÃ³n continua (CI, RFC-006) y decidir la infraestructura (RFC-007), se requiere orquestar *cuÃ¡ndo y cÃ³mo* se despliega el cÃ³digo. Los despliegues manuales son propensos a errores y bloquean entregas rÃ¡pidas. El uso del ecosistema Vercel permite automatizar completamente este paso basÃ¡ndose en el ciclo de Pull Requests.

## Proposed Solution
*   **Frontend (PWA):** La integraciÃ³n nativa de Vercel con el repositorio en GitHub se utilizarÃ¡ para generar un **Preview Environment** en cada PR. Tras el merge a `main`, Vercel construirÃ¡ y desplegarÃ¡ automÃ¡ticamente la PWA en el entorno de ProducciÃ³n.
*   **Base de Datos (Supabase):** Las migraciones de esquema SQL se gestionarÃ¡n con la CLI de Supabase dentro de un paso dedicado en los GitHub Actions (`pnpm supabase db push`), ejecutado *antes* del despliegue del frontend para asegurar compatibilidad de esquema.
*   **GestiÃ³n de Secretos:** Los secretos de producciÃ³n (`SUPABASE_URL`, `ANON_KEY`) residirÃ¡n en Vercel Environment Variables.

## Detailed Design
*   **Pipeline de CD de Supabase:** 
    1. El PR aÃ±ade un archivo `.sql` de migraciÃ³n en `supabase/migrations/`.
    2. Al hacer merge, GitHub Actions ejecuta `supabase link` y `supabase db push` contra la instancia `Production`.
*   **InvalidaciÃ³n de PWA:** Para forzar a los clientes a actualizar la aplicaciÃ³n offline instalada en sus dispositivos, se implementarÃ¡ un flujo en el Service Worker (ej. `vite-plugin-pwa`) que detecte nuevas versiones del `index.html` en Vercel y proponga un modal "Update Available" a los usuarios conectados.

## Implementation Status (2026-08-12)

**Parcialmente implementado.** El deploy de la PWA en Vercel existe (integración GitHub + `vercel.json`). El pipeline de migraciones Supabase **no implementado**; no hay tags git (0 releases hasta la fecha).

## Drawbacks
*   **Migraciones Destructivas:** Ejecutar `db push` automÃ¡ticamente en producciÃ³n es riesgoso si un script contiene comandos de borrado (`DROP TABLE`). RequerirÃ¡ polÃ­ticas muy estrictas en el Code Review.
*   **Despliegue AsÃ­ncrono:** Vercel despliega el front, pero GitHub Actions despliega la DB. PodrÃ­a haber una ventana de milisegundos a segundos donde el front antiguo habla con una DB nueva o viceversa, causando errores 500 esporÃ¡dicos.

## Alternatives
*   **Despliegue Manual (Click-Ops):** Revisar PRs y luego presionar botones manualmente en las consolas. MÃ¡s "seguro" psicolÃ³gicamente, pero escala mal y desmotiva las entregas pequeÃ±as.
*   **Docker/K8s:** Kubernetes para CD ofrece control total sobre Rollouts (Canary, Blue/Green), pero Vercel provee suficientes primitivas serverless sin la sobrecarga operativa.

## Unresolved Questions
*   Â¿CÃ³mo garantizaremos que las migraciones de Base de Datos tengan compatibilidad "hacia atrÃ¡s" de al menos una versiÃ³n (Backward Compatible DDLs) para mitigar el riesgo del desfase temporal entre el despliegue del frontend y backend?

