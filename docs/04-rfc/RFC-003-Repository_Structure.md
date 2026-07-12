---
status: "Approved"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "RFC-001, RFC-002"
tags: "architecture, folder-structure"
document_type: "RFC"
---

# RFC-003-Repository_Structure

## Summary
Este RFC define el esqueleto fundacional físico de carpetas para el monorepo de CubeForge, maximizando la modularidad y separando claramente la lógica pura de la interfaz de usuario.

## Motivation
CubeForge no es un solo "sitio web". Es un ecosistema que incluirá el Frontend (PWA), la documentación (Docusaurus/Storybook), wrappers nativos, y paquetes internos de matemáticas y estado. Si todo esto viviera en una misma carpeta `src/`, el código se volvería fuertemente acoplado (ej. código de UI llamando a Bluetooth directamente), impidiendo escalar, crear testing aislado, o exponer un SDK.

## Proposed Solution
Adopción del estándar de estructura en Monorepos separando aplicaciones consumibles (`apps/`) de librerías de dominio aislado (`packages/`).

## Detailed Design

La estructura base aprobada en la raíz del repositorio será:

```text
cubeforge/
├── apps/                 # Entidades desplegables o ejecutables
│   ├── web/              # La PWA principal (React + Vite)
│   ├── docs/             # Documentación pública (Docusaurus)
│   └── desktop/          # El wrapper de escritorio (Tauri) [Futuro]
│
├── packages/             # Librerías internas aisladas (Framework Agnostic en lo posible)
│   ├── core-math/        # Scrambles, notación (min2phase) - Node/JS puro.
│   ├── core-state/       # Manejo de estado del negocio (Zustand, DB sync).
│   ├── core-hal/         # Hardware Abstraction Layer (Web Bluetooth / Capacitor BLE).
│   ├── engine-3d/        # Lógica de renderizado Three.js abstracta.
│   ├── config/           # Configuraciones compartidas (ESLint, TSConfig, Tailwind).
│   └── ui-kit/           # Componentes de React puros, estúpidos y testeables (Storybook).
│
├── turbo.json            # Orquestador
├── pnpm-workspace.yaml   # Declaración del workspace
└── package.json          # Root dependencias comunes (Husky, Prettier)
```

**Regla Arquitectónica Obligatoria:** 
Los `packages` tienen prohibido depender de las `apps`. Las `apps` consumen de los `packages`. Los paquetes como `core-math` no pueden tener ninguna dependencia de `react` o `DOM` para poder ser ejecutados en Node.js, Web Workers o empaquetados como SDK.

## Drawbacks
* Múltiples `package.json` para gestionar.
* Configuración cruzada de TypeScript (paths/references) puede ser frustrante inicialmente.

## Alternatives
* Un repositorio estándar (sin monorepo). Descartado por el nivel de escala del PRD.

## Unresolved Questions
* Ninguna.
