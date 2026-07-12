---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-20"
tags: "oss, open-source, governance, community"
document_type: "ADR"
---

# ADR-022-Open_Source_Readiness

## Summary
Este RFC propone la formalizaciÃ³n inmediata de las prÃ¡cticas estÃ¡ndar de cÃ³digo abierto (OSS) en el repositorio de CubeForge. Esto incluye la adiciÃ³n de guÃ­as de contribuciÃ³n explÃ­citas, un cÃ³digo de conducta, plantillas de Issues/Pull Requests, y el uso estricto de Conventional Commits para asegurar que el proyecto estÃ© listo para atraer talento de la comunidad desde su inicio.

## Motivation
CubeForge serÃ¡ liberado bajo GPLv3. Un repositorio Open Source sin guÃ­as claras genera fricciÃ³n: los contribuyentes no saben cÃ³mo reportar errores correctamente, cÃ³mo configurar su entorno local ni cuÃ¡les son las expectativas de estilo de cÃ³digo. Sentar estas bases en la "DÃ­a 1" incrementa radicalmente la posibilidad de recibir contribuciones Ãºtiles (Pull Requests) y mitiga la carga de mantenimiento del equipo nÃºcleo.

## Proposed Solution
*   **CONTRIBUTING.md:** Un documento detallado sobre cÃ³mo clonar, instalar dependencias (usando `pnpm`), levantar la PWA y ejecutar los tests.
*   **CODE_OF_CONDUCT.md:** AdopciÃ³n del Contributor Covenant (versiÃ³n estÃ¡ndar de la industria).
*   **Templates de GitHub (`.github/ISSUE_TEMPLATE/`):** Formularios estructurados para Bug Reports y Feature Requests.
*   **Commit Linting:** Hacer cumplir el formato Conventional Commits (`feat:`, `fix:`, `docs:`) utilizando hooks (Husky) para facilitar la generaciÃ³n automÃ¡tica de Changelogs.

## Detailed Design
*   La gobernanza inicial serÃ¡ el modelo "Dictador Benevolente" (Benevolent Dictator for Life - BDFL) guiado por el Architecture Lead, con el *Architecture Decision Register* como fuente de la verdad para debatir el diseÃ±o tÃ©cnico.
*   Se aÃ±adirÃ¡n etiquetas (`good first issue`, `help wanted`, `architecture`) a GitHub para facilitar el descubrimiento por parte de nuevos devs.

## Drawbacks
*   **Burocracia temprana:** Exigir Conventional Commits y Pull Requests perfectos puede asustar a contribuyentes casuales que solo querÃ­an arreglar un typo (aunque herramientas como Husky automatizan parte del dolor).
*   **Tiempo de mantenimiento:** Mantener las Issues y guiar a desarrolladores junior toma tiempo que compite con el desarrollo del producto.

## Alternatives
*   **Modo "Catedral" cerrado:** Desarrollar en privado y liberar el cÃ³digo sin guÃ­as "tal cual" (Dump). Rechazado, destruye el potencial de la comunidad de speedcubing que es altamente tÃ©cnica.

## Unresolved Questions
*   Â¿QuÃ© estÃ¡ndar o bot (ej. Release Please de Google) utilizaremos para auto-generar los Changelogs basados en los Conventional Commits?

