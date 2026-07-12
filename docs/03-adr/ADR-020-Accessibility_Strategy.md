---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-07"
tags: "accessibility, a11y, aria, ux"
document_type: "ADR"
---

# ADR-020-Accessibility_Strategy

## Summary
Este RFC propone implementar soporte de primera clase de accesibilidad (A11y) enfocado especÃ­ficamente en discapacidades visuales o de atenciÃ³n mediante **WAI-ARIA Live Regions** para comunicar el estado del cronÃ³metro, las inspecciones y los resultados por voz (Screen Readers).

## Motivation
La gran mayorÃ­a de aplicaciones visuales y juegos 3D (especialmente simuladores y timers de speedcubing) ignoran a los usuarios que usan lectores de pantalla. Aunque un cubo de Rubik es visual, los cronÃ³metros son herramientas universales. Proveer notificaciones auditivas semÃ¡nticas garantiza que la plataforma sea verdaderamente inclusiva, sirviendo a cuberos invidentes o aquellos que compiten usando interfaces no visuales (auditivas).

## Proposed Solution
*   **Live Regions:** Uso de elementos `aria-live="polite"` y `aria-live="assertive"` ocultos visualmente (utilizando una clase utilitaria CSS como `.sr-only`).
*   **Eventos Clave:** 
    *   Inicio de inspecciÃ³n de 15 segundos: Aviso "InspecciÃ³n iniciada".
    *   Advertencias de penalizaciÃ³n (8s, 12s): "8 segundos".
    *   DetenciÃ³n: "Tiempo: 12.34 segundos. Nuevo rÃ©cord personal".
*   **Atajos de Teclado:** Asegurar que todo se pueda operar mediante la barra espaciadora y *Tab*.

## Detailed Design
*   Se crearÃ¡ un hook en React (ej. `useA11yAnnouncer`) conectado globalmente a Zustand.
*   Un componente en la raÃ­z del Ã¡rbol React mantendrÃ¡ las regiones ARIA, recibiendo actualizaciones de texto que forzarÃ¡n al lector de pantalla (NVDA, VoiceOver, TalkBack) a hablar.
*   El Canvas 3D de Three.js debe tener los atributos `role="img"` o `role="application"` correspondientes, y las caras interactivas no deben tapar el foco de elementos HTML crÃ­ticos (como botones flotantes superpuestos).

## Drawbacks
*   **Pruebas tediosas:** RequerirÃ¡ instalar y utilizar NVDA/VoiceOver durante la fase de control de calidad, ralentizando el ciclo QA inicial.
*   **InterrupciÃ³n de Audio:** En ciertos navegadores mÃ³viles, mezclar audio del sistema (si aÃ±adimos pitidos de inicio de cronÃ³metro) con sintetizadores de voz puede generar bugs molestos.

## Alternatives
*   **Ignorar A11y:** No es Ã©tico, pero reducirÃ­a la fricciÃ³n de desarrollo en un 5-10%. Se rechaza porque CubeForge busca sentar un estÃ¡ndar comunitario de alta calidad.
*   **Audio pregrabado (.mp3) solo:** No es dinÃ¡mico para leer tiempos exactos a menos que se concatenen muchos archivos de audio cortos. Los screen readers son la mejor vÃ­a semÃ¡ntica.

## Unresolved Questions
*   Â¿CÃ³mo abordaremos la accesibilidad del propio cubo 3D interactivo? Â¿Proveemos una interfaz de texto plana como alternativa al canvas para editar el estado manual?

