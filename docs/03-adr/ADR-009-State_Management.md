---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-009-State_Management"
tags: "frontend, state, zustand, react"
document_type: "ADR"
---

# ADR-009-State_Management

## Context and Problem Statement

En Cubalyze coexisten dos tipos de estado muy distintos:
1.  **Estado de Baja Frecuencia:** Preferencias del usuario, sesión, listas de tiempos históricos.
2.  **Estado de Alta Frecuencia:** El temporizador activo (actualizándose a 60fps), el estado de los sensores del cubo Bluetooth, y las rotaciones 3D.
Usar el *Context API* nativo de React para el estado de alta frecuencia causaría re-renderizados masivos en todo el árbol de componentes, colapsando el rendimiento. Se requiere una solución para separar ambos estados y permitir actualizaciones transitorias (Transient Updates) directamente en los componentes interesados (o fuera del ciclo de renderizado de React).

## Decision Drivers

* **Rendimiento:** Evitar re-renders de React para estados que cambian cada milisegundo (temporizador).
* **Simplicidad:** API clara sin boilerplate excesivo para el estado global y de sesión.
* **Compatibilidad 3D:** Capacidad de inyectar estado directamente al bucle de renderizado de WebGL/Three.js de forma imperativa.

## Considered Options

* **Opción 1:** Zustand.
* **Opción 2:** Redux Toolkit.
* **Opción 3:** Context API nativo de React.
* **Opción 4:** Atomic State (Jotai / Recoil).

## Decision Outcome

Chosen option: **Opción 1: Zustand**.
Se elige Zustand para gestionar tanto el estado de alta frecuencia (Temporizador, Hardware BLE) como de sesión en memoria (slices separados). Zustand permite acceder y mutar el estado sin forzar un re-render de React (`useStore.getState()`), lo que es indispensable para actualizar la lógica de alto rendimiento (60fps) sin impactar el DOM. El estado asíncrono y de servidor se delegará a otras herramientas (ej. React Query), manteniendo a Zustand enfocado puramente en la UI y hardware.

### Positive Consequences

* Mantenimiento de los 60fps constantes del temporizador al evadir el ciclo de reconciliación de React.
* Simplicidad en el código sin el *boilerplate* de acciones o reducers.
* Fácil integración del estado fuera del componente (ej. directamente en los event listeners del Cubo Bluetooth o el bucle del motor 3D).

### Negative Consequences

* Riesgo de inconsistencias o código desordenado si los desarrolladores mutan el estado y olvidan conectar reactivamente los componentes que sí lo necesitan.

## Pros and Cons of the Options

### Opción 1: Zustand
* **Good, because:** *Transient updates* permiten rendimiento de 60fps fuera del árbol de React.
* **Good, because:** API minimalista y fácil de modularizar mediante "slices".
* **Bad, because:** Riesgo de datos desfasados en el DOM si no se subscribe correctamente.

### Opción 2: Redux Toolkit
* **Good, because:** Patrón ultra estandarizado y robusto.
* **Bad, because:** Excesivo *overhead* y verbosidad; cada actualización de estado pasa por reducers, lo que puede afectar los tiempos submilisegundo.

### Opción 3: Context API
* **Good, because:** Nativo, cero dependencias adicionales.
* **Bad, because:** Rendimiento desastroso para alta frecuencia; cualquier cambio fuerza un re-render de todos los consumidores del contexto.
