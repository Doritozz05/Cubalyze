---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-06, DEC-07"
tags: "plugins, architecture, esm, extensibility"
document_type: "RFC"
---

# RFC-017-Plugin_System

## Summary
Este RFC define el diseño del sistema de plugins de CubeForge. Para permitir la adición dinámica de nuevas categorías de rompecabezas, métodos de entrenamiento y temas visuales sin sobrecargar el *bundle* principal, se adoptará un enfoque basado en **ESM (ECMAScript Modules) nativos e importaciones dinámicas** (`import()`) integrado estrechamente con Vite y React.

## Motivation
CubeForge crecerá orgánicamente. Si incluimos la lógica de Megaminx, Pyraminx, Square-1 y decenas de algoritmos de entrenamiento en el build inicial, la PWA inicial pesará demasiados megabytes. Una arquitectura orientada a plugins mediante code-splitting garantiza que el núcleo sea ligero y solo se descargue lo que el usuario decida instalar o utilizar.

## Proposed Solution
*   **Contrato de Plugin:** Se definirá una interfaz TypeScript estándar (ej. `ICubePlugin`) que cada plugin debe exportar por defecto.
*   **Lazy Loading:** Usaremos `React.lazy()` en combinación con importaciones dinámicas para renderizar componentes de UI inyectados por los plugins.
*   **Registry Central:** Existirá un almacén Zustand (`usePluginStore`) que registrará y despachará eventos a los plugins instalados.

## Detailed Design
*   Los plugins vivirán en paquetes separados dentro del Monorepo (ej. `packages/plugins/plugin-megaminx`).
*   Vite se encargará de realizar el *code-splitting* (chunks separados) de cada plugin registrado en la configuración.
*   Si se implementa una "Tienda de Plugins" futura, se podría explorar la inyección remota (Federated Modules / Module Federation), pero para la iteración actual nos limitaremos a plugins empacados estáticamente con carga perezosa (Lazy Load) a demanda.

## Drawbacks
*   **Complejidad de Tipado:** Mantener tipos estrictos a través de las fronteras de los plugins puede ser desafiante.
*   **Manejo de Errores:** Si un plugin asíncrono falla al cargar (ej. red caída en un instante sin caché), la UI debe estar preparada con robustos `ErrorBoundaries` de React.

## Alternatives
*   **Module Federation (Webpack/Rspack):** Permite inyectar código verdaderamente remoto en runtime sin re-deploy de la app. Es muy potente, pero overkill para esta etapa inicial (y Vite prefiere configuraciones más estáticas mediante ESM estándar).
*   **Monolítico Fuerte:** Sin plugins. Rechazado, no escala con la visión de la plataforma.

## Unresolved Questions
*   ¿Deberán los plugins tener acceso directo a la instancia global de SQLite (OPFS) para crear sus propias tablas de telemetría/estadísticas, o deberán usar una API limitada (wrapper) expuesta por el Core?
