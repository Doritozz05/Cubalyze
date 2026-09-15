---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-010-Licensing_Compatibility"
tags: "legal, licensing, open-source, mit"
document_type: "ADR"
---

# ADR-010-Licensing_Compatibility

## Context and Problem Statement
Cubalyze será un proyecto de código abierto. Elegir la licencia correcta es fundamental para definir el modelo de uso, distribución y compatibilidad con tiendas de aplicaciones móviles en el futuro, así como la compatibilidad con las dependencias utilizadas en el desarrollo.

## Decision Drivers
*   **Permisividad:** Facilitar la adopción, contribución y *forks* del código por parte de la comunidad.
*   **Tiendas de Aplicaciones:** Compatibilidad total con los Términos de Servicio de Apple App Store y Google Play Store para los wrappers de Capacitor.
*   **Libertad:** El autor no busca restringir el uso comercial derivado.

## Considered Options
*   **Opción 1:** Licencia MIT
*   **Opción 2:** Licencia GPLv3 / AGPLv3

## Decision Outcome
Chosen option: **Opción 1: Licencia MIT**.
Se elige MIT por ser la licencia open source más permisiva y estándar del ecosistema JavaScript. Permite a cualquier persona usar, copiar, modificar y distribuir el software sin restricciones comerciales. A diferencia de la GPL, la licencia MIT no presenta ambigüedades ni conflictos con las condiciones restrictivas de distribución de plataformas cerradas como la App Store de iOS, lo cual es crítico dado que se usará Capacitor para el soporte Bluetooth en iPhone (ADR-012).

### Positive Consequences
*   Cero fricción legal para publicar la aplicación en cualquier tienda (iOS/Android/Windows).
*   Facilita contribuciones de la comunidad.
*   Alta compatibilidad con dependencias de NPM, que mayoritariamente son MIT.

### Negative Consequences
*   El código puede ser bifurcado (fork) y convertido en software privativo cerrado sin obligar a devolver los cambios a la comunidad.
