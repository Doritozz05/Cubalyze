---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-06, DEC-07"
tags: "plugins, architecture, esm, extensibility"
document_type: "ADR"
---

# ADR-017-Plugin_System

## Summary
Este RFC define el diseÃ±o del sistema de plugins de CubeForge. Para permitir la adiciÃ³n dinÃ¡mica de nuevas categorÃ­as de rompecabezas, mÃ©todos de entrenamiento y temas visuales sin sobrecargar el *bundle* principal, se adoptarÃ¡ un enfoque basado en **ESM (ECMAScript Modules) nativos e importaciones dinÃ¡micas** (`import()`) integrado estrechamente con Vite y React.

## Motivation
CubeForge crecerÃ¡ orgÃ¡nicamente. Si incluimos la lÃ³gica de Megaminx, Pyraminx, Square-1 y decenas de algoritmos de entrenamiento en el build inicial, la PWA inicial pesarÃ¡ demasiados megabytes. Una arquitectura orientada a plugins mediante code-splitting garantiza que el nÃºcleo sea ligero y solo se descargue lo que el usuario decida instalar o utilizar.

## Proposed Solution
*   **Contrato de Plugin:** Se definirÃ¡ una interfaz TypeScript estÃ¡ndar (ej. `ICubePlugin`) que cada plugin debe exportar por defecto.
*   **Lazy Loading:** Usaremos `React.lazy()` en combinaciÃ³n con importaciones dinÃ¡micas para renderizar componentes de UI inyectados por los plugins.
*   **Registry Central:** ExistirÃ¡ un almacÃ©n Zustand (`usePluginStore`) que registrarÃ¡ y despacharÃ¡ eventos a los plugins instalados.

## Detailed Design
*   Los plugins vivirÃ¡n en paquetes separados dentro del Monorepo (ej. `packages/plugins/plugin-megaminx`).
*   Vite se encargarÃ¡ de realizar el *code-splitting* (chunks separados) de cada plugin registrado en la configuraciÃ³n.
*   Si se implementa una "Tienda de Plugins" futura, se podrÃ­a explorar la inyecciÃ³n remota (Federated Modules / Module Federation), pero para la iteraciÃ³n actual nos limitaremos a plugins empacados estÃ¡ticamente con carga perezosa (Lazy Load) a demanda.

## Drawbacks
*   **Complejidad de Tipado:** Mantener tipos estrictos a travÃ©s de las fronteras de los plugins puede ser desafiante.
*   **Manejo de Errores:** Si un plugin asÃ­ncrono falla al cargar (ej. red caÃ­da en un instante sin cachÃ©), la UI debe estar preparada con robustos `ErrorBoundaries` de React.

## Alternatives
*   **Module Federation (Webpack/Rspack):** Permite inyectar cÃ³digo verdaderamente remoto en runtime sin re-deploy de la app. Es muy potente, pero overkill para esta etapa inicial (y Vite prefiere configuraciones mÃ¡s estÃ¡ticas mediante ESM estÃ¡ndar).
*   **MonolÃ­tico Fuerte:** Sin plugins. Rechazado, no escala con la visiÃ³n de la plataforma.

## Unresolved Questions
*   Â¿DeberÃ¡n los plugins tener acceso directo a la instancia global de SQLite (OPFS) para crear sus propias tablas de telemetrÃ­a/estadÃ­sticas, o deberÃ¡n usar una API limitada (wrapper) expuesta por el Core?

