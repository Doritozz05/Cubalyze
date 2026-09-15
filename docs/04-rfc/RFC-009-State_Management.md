---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-07"
tags: "frontend, state, zustand, react"
document_type: "RFC"
---

# RFC-009-State_Management

## Summary
Este RFC propone el uso de **Zustand** para el manejo de estado global del cliente, específicamente diseñado para lidiar con el estado de alta frecuencia (el cronómetro corriendo a sub-milisegundos) sin provocar re-renders completos del árbol de React.

## Motivation
En Cubalyze coexisten dos tipos de estado muy distintos:
1.  **Estado de Baja Frecuencia:** Preferencias del usuario, sesión, listas de tiempos históricos.
2.  **Estado de Alta Frecuencia:** El temporizador activo (actualizándose a 60fps), el estado de los sensores del cubo Bluetooth, y las rotaciones 3D.

Usar el *Context API* nativo de React para el temporizador causaría un colapso de rendimiento, ya que cada milisegundo se re-renderizaría toda la aplicación. Se requiere un gestor de estado fuera del árbol de React que permita a componentes específicos suscribirse a cambios granulares (Transient Updates).

## Proposed Solution
*   **Zustand:** Se usará para el store del Temporizador y del Cubo Bluetooth. Permite acceder y mutar el estado sin forzar un re-render de React (`useStore.getState().time`), lo que es vital para la lógica de rendimiento puro.
*   *Nota:* Las peticiones asíncronas y mutaciones de datos del backend se manejarán posteriormente (posiblemente con React Query o SWR), dejando a Zustand enfocado puramente en el estado de la UI y del hardware local.

## Detailed Design
*   Se crearán *slices* de estado separados:
    *   `createTimerSlice`: Maneja el inicio, detención, DNF y +2 del solve actual.
    *   `createHardwareSlice`: Mantiene el estado de la conexión BLE.
    *   `createSessionSlice`: Guarda la lista actual de tiempos de la sesión en curso en memoria antes de persistirla en SQLite.

## Drawbacks
*   Si no se usa con cuidado, extraer estado fuera de React puede llevar a inconsistencias en la UI (datos desfasados entre el DOM y la memoria de Zustand).

## Alternatives
*   **Redux Toolkit:** Excesivamente verboso y "pesado" para lo que necesitamos. El overhead de las acciones puede afectar los tiempos del timer.
*   **Jotai / Recoil (Atomic State):** Son buenas opciones, pero Zustand destaca en el manejo de estado externo a los componentes (útil para inyectar estado directamente al bucle de renderizado de Three.js).

## Unresolved Questions
*   ¿Deberíamos conectar Zustand directamente a IndexedDB/OPFS usando su middleware `persist`, o mantener la persistencia como un efecto lateral asíncrono manual para no bloquear el hilo principal durante un "solve"?
