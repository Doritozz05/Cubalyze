---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-20"
tags: "oss, open-source, governance, community"
document_type: "RFC"
---

# RFC-022-Open_Source_Readiness

## Summary
Este RFC propone la formalización inmediata de las prácticas estándar de código abierto (OSS) en el repositorio de CubeForge. Esto incluye la adición de guías de contribución explícitas, un código de conducta, plantillas de Issues/Pull Requests, y el uso estricto de Conventional Commits para asegurar que el proyecto esté listo para atraer talento de la comunidad desde su inicio.

## Motivation
CubeForge será liberado bajo GPLv3. Un repositorio Open Source sin guías claras genera fricción: los contribuyentes no saben cómo reportar errores correctamente, cómo configurar su entorno local ni cuáles son las expectativas de estilo de código. Sentar estas bases en la "Día 1" incrementa radicalmente la posibilidad de recibir contribuciones útiles (Pull Requests) y mitiga la carga de mantenimiento del equipo núcleo.

## Proposed Solution
*   **CONTRIBUTING.md:** Un documento detallado sobre cómo clonar, instalar dependencias (usando `pnpm`), levantar la PWA y ejecutar los tests.
*   **CODE_OF_CONDUCT.md:** Adopción del Contributor Covenant (versión estándar de la industria).
*   **Templates de GitHub (`.github/ISSUE_TEMPLATE/`):** Formularios estructurados para Bug Reports y Feature Requests.
*   **Commit Linting:** Hacer cumplir el formato Conventional Commits (`feat:`, `fix:`, `docs:`) utilizando hooks (Husky) para facilitar la generación automática de Changelogs.

## Detailed Design
*   La gobernanza inicial será el modelo "Dictador Benevolente" (Benevolent Dictator for Life - BDFL) guiado por el Architecture Lead, con el *Architecture Decision Register* como fuente de la verdad para debatir el diseño técnico.
*   Se añadirán etiquetas (`good first issue`, `help wanted`, `architecture`) a GitHub para facilitar el descubrimiento por parte de nuevos devs.

## Drawbacks
*   **Burocracia temprana:** Exigir Conventional Commits y Pull Requests perfectos puede asustar a contribuyentes casuales que solo querían arreglar un typo (aunque herramientas como Husky automatizan parte del dolor).
*   **Tiempo de mantenimiento:** Mantener las Issues y guiar a desarrolladores junior toma tiempo que compite con el desarrollo del producto.

## Alternatives
*   **Modo "Catedral" cerrado:** Desarrollar en privado y liberar el código sin guías "tal cual" (Dump). Rechazado, destruye el potencial de la comunidad de speedcubing que es altamente técnica.

## Unresolved Questions
*   ¿Qué estándar o bot (ej. Release Please de Google) utilizaremos para auto-generar los Changelogs basados en los Conventional Commits?
