# Research Report: PWA Storage & Eviction Policies (DEC-02)

## 1. Metadata
- **ID**: A.1 (DEC-02)
- **Title**: PWA Storage & Eviction Policies (iOS Safari Focus)
- **Purpose**: Determinar si OPFS/IndexedDB es seguro frente a la eliminación arbitraria por parte del sistema operativo en iOS/Android.
- **Status**: Complete
- **Date**: 2026-07-12
- **Confidence Level**: High

## 2. Contexto del Problema
CubeForge requiere una arquitectura **Offline-First**, almacenando hasta 10,000 tiempos de resolución y métricas complejas en la base de datos local del usuario usando OPFS (Origin Private File System) o IndexedDB.
El mayor riesgo técnico para una PWA local-first es que los navegadores móviles (especialmente Safari en iOS) implementan políticas de limpieza de almacenamiento muy agresivas para liberar espacio.

## 3. Políticas de Evicción de Safari (WebKit)
Tras investigar el comportamiento oficial y empírico de WebKit (iOS Safari) en 2023-2026, los hallazgos son:

### 3.1. La regla de los 7 días (Inactivity Eviction)
Safari borra proactivamente los datos (incluyendo IndexedDB, OPFS y Cache API) de cualquier origen web (página) con el que el usuario no haya interactuado en un periodo de **7 días**.
*   **Mitigación**: Si el usuario instala la PWA en su pantalla de inicio ("Add to Home Screen"), WebKit **exime** a esa aplicación de la regla estricta de 7 días. La PWA instalada recibe un contenedor de almacenamiento más permanente.

### 3.2. Presión de Almacenamiento (Storage Pressure)
Aun estando instalada, la cuota de almacenamiento de una PWA no es infinita. En Safari 17+, las PWAs instaladas pueden ocupar hasta un ~60% del disco disponible, pero bajo presión extrema de almacenamiento del dispositivo, el SO puede decidir purgar datos clasificados como "Best Effort".
*   La API `navigator.storage.persist()` permite solicitar que el almacenamiento se marque como "Persistente". Sin embargo, **WebKit no muestra un *prompt* al usuario para esto**. En su lugar, decide otorgarlo silenciosamente basado en heurísticas (principalmente, si la app está instalada en el Home Screen).

## 4. Estrategia de Mitigación Recomendada

No existe una garantía de **0% de pérdida de datos** puramente en el navegador en iOS. Para evitar que un usuario pierda miles de *solves*, CubeForge debe implementar la siguiente arquitectura de almacenamiento:

### Nivel 1: OPFS (Primary Database)
*   Usar OPFS (SQLite WASM) para la base de datos principal por su rendimiento masivo.
*   Llamar a `navigator.storage.persist()` en el arranque de la app.
*   **Obligar** (mediante UI/UX agresiva) a los usuarios móviles a instalar la PWA ("Add to Home Screen") antes de permitirles almacenar datos importantes.

### Nivel 2: Sistema de Exportación de Respaldo (Backup)
*   **Exportación Manual Automática**: Implementar un botón "Descargar Backup (JSON/CSV)" y educar a los usuarios competitivos a hacer copias semanales si no usan la nube.
*   **Cloud Sync (Recomendado)**: Esta investigación acelera la necesidad de resolver la **DEC-18 (Cloud Sync)**. Para una app de competición, depender exclusivamente del disco local del navegador es demasiado riesgoso. Debe existir un servidor (Supabase) que sincronice el OPFS local periódicamente (CRDTs o Time-based).

## 5. Prototipo de Prueba (Storage Tester)
Se recomienda incluir el siguiente fragmento en la aplicación final para diagnosticar la persistencia del cliente:

```javascript
// storage-diagnostic.ts
export async function checkStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      return granted;
    }
    return true;
  }
  return false;
}
```

## 6. Conclusión y Siguientes Pasos
**Estado de DEC-02**: Completado.
*   La base de datos local (DEC-09) puede avanzar usando OPFS/SQLite, pero el equipo de producto DEBE aceptar el riesgo de que **sin una estrategia de sincronización en la nube (DEC-18), habrá usuarios de iOS que perderán datos**.
*   **Next Action**: Actualizar el PRD para incluir el requerimiento de "PWA Install Prompt" obligatorio y avanzar con la investigación de DEC-18.
