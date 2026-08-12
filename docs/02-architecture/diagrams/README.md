# Diagrams — Diagramas de Arquitectura

Diagramas de la arquitectura de CubeForge, generados a partir del **código real**
(Fase 9, 2026-08-12). Formato Mermaid (renderiza nativo en GitHub).

## Índice

- [`monorepo-dependencies.mmd`](./monorepo-dependencies.mmd) — grafo de
  dependencias reales entre apps y paquetes (verificado con grep de imports;
  los edges solo-de-tests no se representan).
- [`data-flow.mmd`](./data-flow.mmd) — flujo de datos de un solve: hardware →
  TimerEngine → stores → SQLite → widgets/análisis.

> Para verlos: abrir el `.mmd` en GitHub (renderizado nativo), o en
> [mermaid.live](https://mermaid.live) pegando el contenido.
