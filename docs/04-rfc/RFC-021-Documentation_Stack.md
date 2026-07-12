---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-04"
tags: "documentation, tooling, markdown"
document_type: "RFC"
---

# RFC-021-Documentation_Stack

## Summary
Este RFC consolida la decisión de utilizar una **estructura de carpetas versionada junto al código fuente** con formato **Markdown (GitHub Flavored)** como el único estándar de documentación, apoyándose de herramientas locales (CodeGraph) e indexación por IA, en lugar de wikis externas como Notion o Confluence.

## Motivation
La documentación arquitectónica y de producto (PRD, ADRs, RFCs) debe residir junto al código para evitar que quede desactualizada (des-sincronización). Las wikis externas requieren cambio de contexto y frecuentemente se abandonan. Además, un repositorio de documentación Markdown es ideal para ser leído e ingerido por agentes de IA generativa que asisten en el desarrollo.

## Proposed Solution
*   **Formato:** Markdown puro.
*   **Almacenamiento:** Carpeta `/docs/` en la raíz del monorepo, dividida en subcarpetas numeradas por dominio (`00-product`, `01-roadmap`, `02-architecture`, etc.).
*   **Gobernanza:** Uso obligatorio de plantillas almacenadas en `_templates` para RFCs, ADRs, PRDs y TDDs.

## Detailed Design
*   No introduciremos un SSG (Static Site Generator) como Docusaurus o VitePress inicialmente para mantener la simplicidad, apoyándonos en el renderizador nativo de GitHub.
*   Se requerirá que los Pull Requests arquitectónicos que modifiquen ADRs y RFCs actualicen concurrentemente el `Architecture_Index.md` o el `Architecture_Decision_Register.md`.
*   Se utilizará sintaxis compatible con GitHub Alerts (`> [!WARNING]`) para destacar información crítica.

## Drawbacks
*   **Navegación inicial:** Para usuarios no técnicos, leer un repositorio de GitHub es menos intuitivo que una web generada bonita como Notion.
*   **Búsqueda Semántica (Local):** La búsqueda en archivos Markdown depende de `grep` o herramientas de indexación externas, a diferencia del potente buscador de wikis corporativas.

## Alternatives
*   **Notion / Confluence / Jira:** Cero integración natural con Git y el ciclo de PRs. Costos asociados.
*   **Docusaurus:** Excelente alternativa para renderizar Markdown como web. Será la alternativa natural a implementar en una Milestone futura si el proyecto crece a nivel público.

## Unresolved Questions
*   ¿Cuándo consideramos la transición oficial de este repositorio estático de Markdown hacia un sistema SSG publicado (ej. docs.cubeforge.com)?
