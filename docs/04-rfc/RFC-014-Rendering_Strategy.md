---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-01, DEC-08"
tags: "rendering, 3d, threejs, graphics"
document_type: "RFC"
---

# RFC-014-Rendering_Strategy

## Summary
Este RFC propone utilizar **Three.js puro** para el renderizado del cubo 3D interactivo en la aplicación, descartando el uso de integraciones reactivas como React Three Fiber (R3F) para asegurar el máximo rendimiento a 60fps constantes en dispositivos de gama baja y control absoluto sobre la gestión de memoria y el ciclo de vida del canvas.

## Motivation
La experiencia interactiva del "Cubo" requiere baja latencia y alta fluidez. Si bien la aplicación principal está en React, envolver el canvas 3D con React Three Fiber añade un nivel de indirección. En interacciones rápidas (swipes continuos para rotar caras), R3F puede disparar excesivas reconciliaciones de React, reduciendo los fotogramas por segundo. Usar Three.js puro permite un control determinista estricto del `requestAnimationFrame`.

## Proposed Solution
*   **Engine:** `three` (Three.js puro).
*   **Integración con React:** Se creará un componente envoltorio (ej. `<CubeCanvas />`) que inicializará Three.js dentro de un `useLayoutEffect` o `useEffect`. Este componente delegará toda la lógica de renderizado, animaciones y raycasting a una clase gestora independiente (`CubeSceneManager`).
*   **Eventos:** La UI de React se comunicará con el `CubeSceneManager` de forma imperativa (ej. `cubeManager.scramble(sequence)`), y este despachará eventos (CustomEvents o callbacks) de vuelta a React si el estado 3D cambia.

## Detailed Design
*   Se implementará un sistema de pooling de geometrías y materiales para minimizar el Garbage Collection.
*   Uso de `Raycaster` optimizado para la detección de toques y gestos en dispositivos móviles.
*   Las animaciones de giro de capas se manejarán con interpolaciones manuales (lerp/slerp) dentro del loop de renderizado principal, no dependiendo del state de React.

## Drawbacks
*   **Pérdida de la declaratividad de React:** Diseñar la escena 3D implicará escribir código imperativo de Three.js (más verboso que R3F).
*   **Gestión de Memoria Manual:** Se requiere llamar a `.dispose()` en geometrías, texturas y materiales manualmente cuando el canvas se desmonta para evitar memory leaks.

## Alternatives
*   **React Three Fiber (R3F):** Es mucho más rápido para desarrollar, fácil de integrar y su ecosistema (Drei) es fantástico. Sin embargo, para un solo componente altamente interactivo y central (el cubo), el overhead no compensa los beneficios declarativos en este caso de uso tan específico.
*   **Babylon.js:** Excelente motor, pero el ecosistema, comunidad y cantidad de ejemplos orientados a rompecabezas/cubos está abrumadoramente en favor de Three.js.

## Unresolved Questions
*   ¿Qué técnica exacta utilizaremos para la aplicación de texturas sobre los "stickers" del cubo (textura atlas vs materiales individuales por cara) para reducir *draw calls*?
