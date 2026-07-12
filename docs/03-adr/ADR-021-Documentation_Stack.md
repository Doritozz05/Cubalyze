---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-021-Documentation_Stack"
tags: "documentation, tooling, markdown"
document_type: "ADR"
---

# ADR-021-Documentation_Stack

## Context and Problem Statement

La documentación arquitectónica y de producto (PRD, ADRs, RFCs) debe residir junto al código para evitar que quede desactualizada (des-sincronización). Las wikis externas (Notion, Confluence) requieren cambio de contexto, frecuentemente se abandonan y carecen de control de versiones unificado con el código. Además, un formato fácilmente legible e indexable por IA es esencial para asistir en el desarrollo y mantenimiento del monorepo CubeForge.

## Decision Drivers

* **Single Source of Truth:** Mantener código y documentación sincronizados en un mismo lugar.
* **Control de Versiones:** Revisión de cambios de diseño a través de Pull Requests.
* **Compatibilidad con IA:** Fácil consumo de la documentación por asistentes de IA generativa.
* **Baja fricción:** Sin depender de herramientas o plataformas externas privativas.

## Considered Options

* **Opción 1:** Estructura de carpetas versionada junto al código fuente en formato Markdown puro (GitHub Flavored).
* **Opción 2:** Wiki Externa (Notion, Confluence, Jira).
* **Opción 3:** Static Site Generator (Docusaurus, VitePress) inicializado desde el día 1.

## Decision Outcome

Chosen option: "Opción 1: Markdown puro versionado junto al código", porque mantiene la simplicidad, asegura sincronización mediante Pull Requests, es nativamente renderizado por GitHub, y provee el formato óptimo para ingesta por herramientas de IA o asistentes de código (ej. CodeGraph).

### Positive Consequences

* Documentación unificada en un solo repositorio y flujo de PRs.
* Ideal para agentes de IA que leen Markdown de texto plano.
* Uso de plantillas gobernadas de forma sencilla en `_templates`.
* Costo cero y cero fricción de autenticación.

### Negative Consequences

* Navegación menos amigable para usuarios no técnicos comparada a una Wiki web estilizada.
* La búsqueda recae en comandos CLI (grep, codegraph) en vez de un buscador web global de Wiki.

## Pros and Cons of the Options

### Opción 1: Markdown puro en Repositorio

* Good, because se lee excelentemente en GitHub UI.
* Good, because sincroniza los cambios de arquitectura y código en un mismo PR.
* Bad, because no tiene un buscador full-text nativo visual y estructurado tan avanzado como Notion.

### Opción 2: Wiki Externa (Notion/Confluence)

* Good, because provee interfaces altamente visuales, tablas de base de datos interactivas y búsqueda.
* Bad, because separa la documentación del código y los desarrolladores tienden a olvidarse de actualizarla.

### Opción 3: SSG (Docusaurus) desde el día 1

* Good, because genera una web de documentación hermosa con búsqueda.
* Bad, because añade una sobrecarga de compilación y mantenimiento que es innecesaria en la etapa inicial de arquitectura interna. (Considerable como migración a futuro).
