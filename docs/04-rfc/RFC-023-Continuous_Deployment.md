---
status: "Ready for ADR"
owner: "Ops Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-15, DEC-23"
tags: "ops, CD, deployment, vercel, supabase"
document_type: "RFC"
---

# RFC-023-Continuous_Deployment

## Summary
Este RFC formaliza la estrategia de **Continuous Deployment (CD)** para el ciclo de vida del frontend (PWA) en **Vercel** y la base de datos backend en **Supabase**. Se establece que cualquier "merge" a la rama `main` resultará en un despliegue inmutable y automático en Producción, previas validaciones de CI.

## Motivation
Tras asegurar la integración continua (CI, RFC-006) y decidir la infraestructura (RFC-007), se requiere orquestar *cuándo y cómo* se despliega el código. Los despliegues manuales son propensos a errores y bloquean entregas rápidas. El uso del ecosistema Vercel permite automatizar completamente este paso basándose en el ciclo de Pull Requests.

## Proposed Solution
*   **Frontend (PWA):** La integración nativa de Vercel con el repositorio en GitHub se utilizará para generar un **Preview Environment** en cada PR. Tras el merge a `main`, Vercel construirá y desplegará automáticamente la PWA en el entorno de Producción.
*   **Base de Datos (Supabase):** Las migraciones de esquema SQL se gestionarán con la CLI de Supabase dentro de un paso dedicado en los GitHub Actions (`pnpm supabase db push`), ejecutado *antes* del despliegue del frontend para asegurar compatibilidad de esquema.
*   **Gestión de Secretos:** Los secretos de producción (`SUPABASE_URL`, `ANON_KEY`) residirán en Vercel Environment Variables.

## Detailed Design
*   **Pipeline de CD de Supabase:** 
    1. El PR añade un archivo `.sql` de migración en `supabase/migrations/`.
    2. Al hacer merge, GitHub Actions ejecuta `supabase link` y `supabase db push` contra la instancia `Production`.
*   **Invalidación de PWA:** Para forzar a los clientes a actualizar la aplicación offline instalada en sus dispositivos, se implementará un flujo en el Service Worker (ej. `vite-plugin-pwa`) que detecte nuevas versiones del `index.html` en Vercel y proponga un modal "Update Available" a los usuarios conectados.

## Drawbacks
*   **Migraciones Destructivas:** Ejecutar `db push` automáticamente en producción es riesgoso si un script contiene comandos de borrado (`DROP TABLE`). Requerirá políticas muy estrictas en el Code Review.
*   **Despliegue Asíncrono:** Vercel despliega el front, pero GitHub Actions despliega la DB. Podría haber una ventana de milisegundos a segundos donde el front antiguo habla con una DB nueva o viceversa, causando errores 500 esporádicos.

## Alternatives
*   **Despliegue Manual (Click-Ops):** Revisar PRs y luego presionar botones manualmente en las consolas. Más "seguro" psicológicamente, pero escala mal y desmotiva las entregas pequeñas.
*   **Docker/K8s:** Kubernetes para CD ofrece control total sobre Rollouts (Canary, Blue/Green), pero Vercel provee suficientes primitivas serverless sin la sobrecarga operativa.

## Unresolved Questions
*   ¿Cómo garantizaremos que las migraciones de Base de Datos tengan compatibilidad "hacia atrás" de al menos una versión (Backward Compatible DDLs) para mitigar el riesgo del desfase temporal entre el despliegue del frontend y backend?
