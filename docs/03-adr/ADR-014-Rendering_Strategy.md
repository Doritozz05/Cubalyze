---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-01, DEC-08"
tags: "rendering, 3d, threejs, graphics"
document_type: "ADR"
---

# ADR-014-Rendering_Strategy

## Summary
Este RFC propone utilizar **Three.js puro** para el renderizado del cubo 3D interactivo en la aplicaciÃ³n, descartando el uso de integraciones reactivas como React Three Fiber (R3F) para asegurar el mÃ¡ximo rendimiento a 60fps constantes en dispositivos de gama baja y control absoluto sobre la gestiÃ³n de memoria y el ciclo de vida del canvas.

## Motivation
La experiencia interactiva del "Cubo" requiere baja latencia y alta fluidez. Si bien la aplicaciÃ³n principal estÃ¡ en React, envolver el canvas 3D con React Three Fiber aÃ±ade un nivel de indirecciÃ³n. En interacciones rÃ¡pidas (swipes continuos para rotar caras), R3F puede disparar excesivas reconciliaciones de React, reduciendo los fotogramas por segundo. Usar Three.js puro permite un control determinista estricto del `requestAnimationFrame`.

## Proposed Solution
*   **Engine:** `three` (Three.js puro).
*   **IntegraciÃ³n con React:** Se crearÃ¡ un componente envoltorio (ej. `<CubeCanvas />`) que inicializarÃ¡ Three.js dentro de un `useLayoutEffect` o `useEffect`. Este componente delegarÃ¡ toda la lÃ³gica de renderizado, animaciones y raycasting a una clase gestora independiente (`CubeSceneManager`).
*   **Eventos:** La UI de React se comunicarÃ¡ con el `CubeSceneManager` de forma imperativa (ej. `cubeManager.scramble(sequence)`), y este despacharÃ¡ eventos (CustomEvents o callbacks) de vuelta a React si el estado 3D cambia.

## Detailed Design
*   Se implementarÃ¡ un sistema de pooling de geometrÃ­as y materiales para minimizar el Garbage Collection.
*   Uso de `Raycaster` optimizado para la detecciÃ³n de toques y gestos en dispositivos mÃ³viles.
*   Las animaciones de giro de capas se manejarÃ¡n con interpolaciones manuales (lerp/slerp) dentro del loop de renderizado principal, no dependiendo del state de React.

## Drawbacks
*   **PÃ©rdida de la declaratividad de React:** DiseÃ±ar la escena 3D implicarÃ¡ escribir cÃ³digo imperativo de Three.js (mÃ¡s verboso que R3F).
*   **GestiÃ³n de Memoria Manual:** Se requiere llamar a `.dispose()` en geometrÃ­as, texturas y materiales manualmente cuando el canvas se desmonta para evitar memory leaks.

## Alternatives
*   **React Three Fiber (R3F):** Es mucho mÃ¡s rÃ¡pido para desarrollar, fÃ¡cil de integrar y su ecosistema (Drei) es fantÃ¡stico. Sin embargo, para un solo componente altamente interactivo y central (el cubo), el overhead no compensa los beneficios declarativos en este caso de uso tan especÃ­fico.
*   **Babylon.js:** Excelente motor, pero el ecosistema, comunidad y cantidad de ejemplos orientados a rompecabezas/cubos estÃ¡ abrumadoramente en favor de Three.js.

## Unresolved Questions
*   Â¿QuÃ© tÃ©cnica exacta utilizaremos para la aplicaciÃ³n de texturas sobre los "stickers" del cubo (textura atlas vs materiales individuales por cara) para reducir *draw calls*?

