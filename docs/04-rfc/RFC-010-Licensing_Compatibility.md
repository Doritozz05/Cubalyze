---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "None"
tags: "legal, licensing, open-source, gplv3"
document_type: "RFC"
---

# RFC-010-Licensing_Compatibility

## Summary
Este RFC evaluará la selección y aplicación de la licencia de código abierto para CubeForge, asegurando la viabilidad legal del proyecto a largo plazo y la compatibilidad con las dependencias elegidas.

## Motivation
CubeForge será un proyecto de código abierto. Elegir la licencia correcta desde el principio (DEC-01 en el registro de decisiones) es fundamental para evitar problemas legales a futuro, especialmente si se planea monetizar características premium o si se utilizan componentes open source restrictivos (como solvers matemáticos).

## Proposed Solution
(Pendiente de investigación y redacción formal). Se propone investigar el uso de **GPLv3** o **MIT** evaluando el riesgo comercial frente a la libertad de modificación, y el impacto de dependencias clave como el solver `min2phase` o librerías 3D.

## Detailed Design
(TBD)

## Alternatives
*   **MIT / Apache 2.0:** Mayor permisividad, facilita adopción pero permite forks comerciales privativos.
*   **GPLv3 / AGPLv3:** Protege el código de apropiación privativa, pero puede dificultar la publicación en ciertas App Stores.

## Unresolved Questions
*   ¿Qué licencias tienen nuestras dependencias críticas (Three.js, React, min2phase)?
*   Si queremos publicar envoltorios móviles (Tauri/Capacitor) en las tiendas de Apple o Google, ¿entra la licencia GPLv3 en conflicto con sus términos de servicio?
