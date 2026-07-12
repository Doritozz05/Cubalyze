---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-07"
tags: "accessibility, a11y, aria, ux"
document_type: "RFC"
---

# RFC-020-Accessibility_Strategy

## Summary
Este RFC propone implementar soporte de primera clase de accesibilidad (A11y) enfocado específicamente en discapacidades visuales o de atención mediante **WAI-ARIA Live Regions** para comunicar el estado del cronómetro, las inspecciones y los resultados por voz (Screen Readers).

## Motivation
La gran mayoría de aplicaciones visuales y juegos 3D (especialmente simuladores y timers de speedcubing) ignoran a los usuarios que usan lectores de pantalla. Aunque un cubo de Rubik es visual, los cronómetros son herramientas universales. Proveer notificaciones auditivas semánticas garantiza que la plataforma sea verdaderamente inclusiva, sirviendo a cuberos invidentes o aquellos que compiten usando interfaces no visuales (auditivas).

## Proposed Solution
*   **Live Regions:** Uso de elementos `aria-live="polite"` y `aria-live="assertive"` ocultos visualmente (utilizando una clase utilitaria CSS como `.sr-only`).
*   **Eventos Clave:** 
    *   Inicio de inspección de 15 segundos: Aviso "Inspección iniciada".
    *   Advertencias de penalización (8s, 12s): "8 segundos".
    *   Detención: "Tiempo: 12.34 segundos. Nuevo récord personal".
*   **Atajos de Teclado:** Asegurar que todo se pueda operar mediante la barra espaciadora y *Tab*.

## Detailed Design
*   Se creará un hook en React (ej. `useA11yAnnouncer`) conectado globalmente a Zustand.
*   Un componente en la raíz del árbol React mantendrá las regiones ARIA, recibiendo actualizaciones de texto que forzarán al lector de pantalla (NVDA, VoiceOver, TalkBack) a hablar.
*   El Canvas 3D de Three.js debe tener los atributos `role="img"` o `role="application"` correspondientes, y las caras interactivas no deben tapar el foco de elementos HTML críticos (como botones flotantes superpuestos).

## Drawbacks
*   **Pruebas tediosas:** Requerirá instalar y utilizar NVDA/VoiceOver durante la fase de control de calidad, ralentizando el ciclo QA inicial.
*   **Interrupción de Audio:** En ciertos navegadores móviles, mezclar audio del sistema (si añadimos pitidos de inicio de cronómetro) con sintetizadores de voz puede generar bugs molestos.

## Alternatives
*   **Ignorar A11y:** No es ético, pero reduciría la fricción de desarrollo en un 5-10%. Se rechaza porque CubeForge busca sentar un estándar comunitario de alta calidad.
*   **Audio pregrabado (.mp3) solo:** No es dinámico para leer tiempos exactos a menos que se concatenen muchos archivos de audio cortos. Los screen readers son la mejor vía semántica.

## Unresolved Questions
*   ¿Cómo abordaremos la accesibilidad del propio cubo 3D interactivo? ¿Proveemos una interfaz de texto plana como alternativa al canvas para editar el estado manual?
