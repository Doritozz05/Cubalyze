# Lista maestra de commits — CubeForge

> Generado automáticamente el 2026-09-02 por `scripts/generate-changelog.cjs`.
> **1105 commits** · 2026-07-12 → 2026-09-02 · repositorio undefined

## Metodología

- **Total real de commits: 1105**, verificado con `git rev-list --count HEAD` (contaba 1.100 al inicio del análisis; entró un commit nuevo (2739e3c6, TechnicalSection) durante la sesión, por lo que el número verificado final es 1105). Las cifras "1000" y "1080" que circularon antes no coinciden con el valor real del repositorio; este documento usa el valor verificado.
- Cada commit se revisó en orden cronológico (del más antiguo al más reciente). Se registran hash, fecha exacta, mensaje original y archivos tocados.
- **Categoría:** si el mensaje sigue Conventional Commits (convención adoptada en las fases posteriores), el prefijo es la categoría. Si el mensaje es genérico ("fix", "fixes", "Update X.ts", …), la categoría se infiere de los archivos modificados con una heurística conservadora (solo markdown → `docs`; solo tests → `test`; solo manifests → `chore`). Sin evidencia suficiente se marca **sin clasificar** (`other`) — nunca se adivina.
- Las descripciones por versión (resúmenes y destacados) están respaldadas por los mensajes y archivos de sus commits, los documentos del repositorio (`docs/`, PRD, roadmap, auditorías) y los PR fusionados (#4–#30).
- Las versiones son una **reconstrucción retrospectiva**: el repositorio no tiene tags ni releases publicados. El único marcador explícito es el bump del paquete web a `0.8.0` (cc813171, 2026-08-22).

## Determinación de la versión actual (SemVer)

Política del repositorio (`docs/08-standards/Versioning_and_Dependency_Management.md`, `docs/17-releases/RELEASE_PROCESS.md`): en `0.x` el salto **minor** marca funcionalidad nueva y el **patch** arreglos; `1.0.0` solo cuando la API de los paquetes se estabilice (hoy los paquetes son privados, las cuentas acaban de llegar y el sync está en fase de endurecimiento → **sigue siendo 0.x**).
Cada ola temática del historial es un salto minor. El bump existente a `0.8.0` (22 de agosto) marca el corte de la ola "nube"; después aterrizó una ola completa de features (inteligencia de casos unificada #26, replay de cine, Infinite F2L #29/#30, Pyraminx y multi-puzzle #27/#28) → **la versión actual es `0.9.1`**.

| Versión | Periodo | Commits | Ola |
|---|---|---|---|
| v0.1.0 | 2026-07-12 → 2026-07-12 | 42 | Monorepo & Core Engine Architecture / Arquitectura monorepo y motor central |
| v0.1.1 | 2026-07-12 → 2026-07-12 | 0 | Offscreen Canvas & Render Worker / Offscreen Canvas y worker de render |
| v0.1.2 | 2026-07-13 → 2026-07-13 | 42 | WCA Timer State Machine & Penalties / Estados de timer WCA y penalizaciones |
| v0.1.3 | 2026-07-13 → 2026-07-13 | 0 | Design Tokens & Responsive Layout / Tokens de diseño y diseño adaptativo |
| v0.2.0 | 2026-07-14 → 2026-07-14 | 16 | Timer Stage & Responsive Display / Timer Stage y pantalla adaptativa |
| v0.2.1 | 2026-07-14 → 2026-07-14 | 0 | Smart Cube Web Bluetooth / Smart Cube y Web Bluetooth |
| v0.2.2 | 2026-07-15 → 2026-07-15 | 10 | Gyroscope & Quaternion Tracking / Giroscopio y seguimiento de cuaterniones |
| v0.2.3 | 2026-07-16 → 2026-07-16 | 6 | Orientation Auto-Calibration / Auto-calibración de orientación |
| v0.2.4 | 2026-07-17 → 2026-07-17 | 21 | CFOP Solver Engine & Phase Split / Motor de resolución CFOP y fases |
| v0.2.5 | 2026-07-17 → 2026-07-17 | 0 | Color Neutrality & Face Mapping / Neutralidad de color y mapeo de caras |
| v0.2.6 | 2026-07-18 → 2026-07-18 | 16 | PB Milestones & Session Bests / Hitos PB y mejores de sesión |
| v0.2.7 | 2026-07-19 → 2026-07-19 | 15 | 2D Scramble Net & Verification / Red 2D de mezcla y verificación |
| v0.2.8 | 2026-07-20 → 2026-07-20 | 29 | 3D Gyroscope Replay / Replay giroscópico 3D |
| v0.2.9 | 2026-07-20 → 2026-07-20 | 0 | Solve History & Quick Stats Panel / Historial de solves y panel de stats |
| v0.3.0 | 2026-07-21 → 2026-07-21 | 84 | Cube Skins & Texture Studio / Skins de cubo y estudio de texturas |
| v0.3.1 | 2026-07-21 → 2026-07-21 | 0 | 3D Diagram Generator / Generador de diagramas 3D |
| v0.3.2 | 2026-07-22 → 2026-07-22 | 10 | Algorithm Database Modeling / Modelado de base de algoritmos |
| v0.3.3 | 2026-07-23 → 2026-07-23 | 32 | Cross Trainer & Optimal Solver / Entrenador de cruz y solver óptimo |
| v0.3.4 | 2026-07-23 → 2026-07-23 | 0 | Training Engine Architecture / Arquitectura del motor de entrenamiento |
| v0.3.5 | 2026-07-24 → 2026-07-24 | 27 | Algorithm Drills & Flash Recall / Drills de algoritmos y recuerdo rápido |
| v0.3.6 | 2026-07-24 → 2026-07-24 | 0 | Practice Calendar & Habit Tracker / Calendario de práctica y hábitos |
| v0.3.7 | 2026-07-25 → 2026-07-25 | 6 | Skill Tree Graph Canvas / Lienzo del árbol de habilidades |
| v0.3.8 | 2026-07-26 → 2026-07-26 | 26 | Spaced Repetition (SRS) Engine / Motor de repetición espaciada (SRS) |
| v0.3.9 | 2026-07-27 → 2026-07-27 | 7 | F2L 41 Case Modeling & Full Solve / Modelado de los 41 F2L y full solve |
| v0.4.0 | 2026-07-28 → 2026-07-28 | 11 | Draggable Dock & Floating Architecture / Dock arrastrable y arquitectura flotante |
| v0.4.1 | 2026-07-28 → 2026-07-28 | 0 | Metronome & Scratchpad Notes / Metrónomo y bloc de notas |
| v0.4.2 | 2026-07-29 → 2026-07-29 | 11 | csTimer Manual Entry Parser / Parser de entrada manual csTimer |
| v0.4.3 | 2026-07-29 → 2026-07-29 | 0 | 2×2 Cube Mathematical Engine / Motor matemático de cubo 2×2 |
| v0.4.4 | 2026-07-30 → 2026-07-30 | 64 | Layout Organizer & Snap-to-Grid / Organizador de layouts y ajuste magnético |
| v0.4.5 | 2026-07-30 → 2026-07-30 | 0 | 2×2 Algorithm Database & Time Histogram / Base de algoritmos 2×2 e histograma |
| v0.4.6 | 2026-07-31 → 2026-07-31 | 52 | PB Progression & BPA/WPA Projections / Evolución de PB y proyecciones BPA/WPA |
| v0.4.7 | 2026-08-01 → 2026-08-01 | 58 | Skill Node Detail & Custom Algorithm Editor / Detalle de skill y editor de algoritmos |
| v0.4.8 | 2026-08-02 → 2026-08-02 | 26 | PWA Deployment & COOP/COEP Headers / Despliegue PWA y cabeceras COOP/COEP |
| v0.4.9 | 2026-08-03 → 2026-08-03 | 23 | Manual Focus Mode & Confirmation Dialogs / Modo foco manual y diálogos de borrado |
| v0.5.0 | 2026-08-04 → 2026-08-05 | 71 | Typed i18n Foundation & Bilingual Support / Infraestructura i18n tipada y bilingüe |
| v0.5.1 | 2026-08-05 → 2026-08-05 | 0 | Configurable Precision & Timer Preferences / Precisión configurable y preferencias |
| v0.5.2 | 2026-08-06 → 2026-08-06 | 18 | SCDB Seed Merge & COLL/WV Algorithms / Integración SCDB y algoritmos COLL/WV |
| v0.5.3 | 2026-08-06 → 2026-08-06 | 0 | BirdF2L Advanced Notation Codes / Códigos de notación avanzada BirdF2L |
| v0.5.4 | 2026-08-07 → 2026-08-07 | 21 | Automated Case Verification Pipeline / Pipeline de verificación de casos |
| v0.5.5 | 2026-08-08 → 2026-08-08 | 23 | Solve Re-analysis Pipeline / Pipeline de reanálisis de solves |
| v0.5.6 | 2026-08-08 → 2026-08-08 | 0 | Replay Move Grip Smooth Timeline / Cronología de replay y transiciones de agarre |
| v0.5.7 | 2026-08-09 → 2026-08-09 | 27 | Color-Neutral Scrambler & Standard Deviation / Mezclador color-neutral y desviación estándar |
| v0.5.8 | 2026-08-10 → 2026-08-10 | 37 | Algorithm Creator Credits Attribution / Atribución de créditos a creadores |
| v0.5.9 | 2026-08-10 → 2026-08-10 | 0 | Complete Typed Translation Sweep / Barrido completo de traducción tipada |
| v0.6.0 | 2026-08-11 → 2026-08-11 | 34 | Virtual Cube Simulator csTimer Style / Simulador de cubo virtual estilo csTimer |
| v0.6.1 | 2026-08-11 → 2026-08-11 | 0 | Web Audio Mechanical Turn Sounds / Sonidos mecánicos Web Audio |
| v0.6.2 | 2026-08-12 → 2026-08-12 | 36 | Modular Dock Pieces Architecture / Arquitectura de piezas modulares del dock |
| v0.6.3 | 2026-08-12 → 2026-08-12 | 0 | DockExplorer Catalog & Virtual Solve Tag / Catálogo DockExplorer y tag virtual |
| v0.6.4 | 2026-08-13 → 2026-08-13 | 36 | Dock Edit Mode & Removal Badges / Modo edición del dock e insignias de borrado |
| v0.6.5 | 2026-08-13 → 2026-08-13 | 0 | Modular Bottom Layout Templates / Plantillas modulares de layout inferior |
| v0.6.6 | 2026-08-14 → 2026-08-14 | 19 | Dock Auto-Hide Tri-State Top Bar / Auto-hide del dock y barra tri-estado |
| v0.6.7 | 2026-08-14 → 2026-08-14 | 0 | Trackball Orbit Camera & Tablet Layout / Cámara trackball y layout para tablet |
| v0.6.8 | 2026-08-15 → 2026-08-15 | 8 | WCA Event Registry & Solid UI Surfaces / Registro de eventos WCA y superficies sólidas |
| v0.6.9 | 2026-08-16 → 2026-08-17 | 11 | 2×2 Virtual Cube & iOS Ghost Click Filter / Cubo virtual 2×2 y filtro anticlic iOS |
| v0.7.0 | 2026-08-18 → 2026-08-18 | 6 | Supabase User Accounts & Authentication / Cuentas de usuario y auth Supabase |
| v0.7.1 | 2026-08-19 → 2026-08-19 | 3 | Offline-First Cloud Sync Service / Servicio de sync offline-first |
| v0.7.2 | 2026-08-20 → 2026-08-20 | 17 | OPFS Storage Worker & Fallbacks / Worker de almacenamiento OPFS y fallbacks |
| v0.7.3 | 2026-08-21 → 2026-08-21 | 19 | Crash Diagnostics & Settings SHA Footer / Diagnósticos de caídas y pie SHA en ajustes |
| v0.7.4 | 2026-08-21 → 2026-08-21 | 0 | Solve Multi-Select & Bulk Operations / Selección múltiple de solves y acciones en bloque |
| v0.7.5 | 2026-08-22 → 2026-08-22 | 7 | Profile View & 52-Week Activity Heatmap / Vista de perfil y heatmap de 52 semanas |
| v0.7.6 | 2026-08-22 → 2026-08-22 | 0 | Sub-X Milestone Badges & 5 Performance Tabs / Insignias Sub-X y 5 pestañas de rendimiento |
| v0.7.7 | 2026-08-23 → 2026-08-23 | 1 | Zero-Latency SoundManager / SoundManager de latencia cero |
| v0.7.8 | 2026-08-24 → 2026-08-24 | 3 | Advanced F2L Slot Views & Fixed Pair Geometry / Vistas de slot F2L avanzado y geometría fija |
| v0.7.9 | 2026-08-24 → 2026-08-24 | 0 | BirdF2L Notation Badges & Profile Country Sorting / Insignias BirdF2L y orden de países en perfil |
| v0.8.0 | 2026-08-25 → 2026-08-25 | 0 | Slot-Agnostic Relational Signatures / Signaturas relacionales independientes del slot |
| v0.8.1 | 2026-08-26 → 2026-08-26 | 9 | Mini 3D Case Cubes with Real Sticker Colors / Mini-cubos 3D con colores reales |
| v0.8.2 | 2026-08-26 → 2026-08-26 | 0 | Unified CFOP Case Analysis Architecture / Arquitectura unificada de análisis CFOP |
| v0.8.3 | 2026-08-27 → 2026-08-27 | 0 | 100% Color-Neutral Recognition Engine / Motor de reconocimiento 100% color-neutral |
| v0.8.4 | 2026-08-28 → 2026-08-28 | 17 | Floating Stickers & Direct Replay Seek / Stickers flotantes y salto en replay |
| v0.8.5 | 2026-08-28 → 2026-08-28 | 0 | Reconstruction Detail Redesign & Vertical Layout / Rediseño de detalle de reconstrucción |
| v0.8.6 | 2026-08-29 → 2026-08-29 | 21 | In-App Theater Fullscreen Replay / Replay de cine en pantalla completa |
| v0.8.7 | 2026-08-29 → 2026-08-29 | 0 | Spherical Turntable Orbit Camera / Cámara orbital esférica tipo turntable |
| v0.8.8 | 2026-08-30 → 2026-08-30 | 7 | Professional Pause Analytics & Case Intelligence / Analítica de pausas e inteligencia de casos |
| v0.8.9 | 2026-08-31 → 2026-08-31 | 1 | Puzzle Roulette & Reconstruction Table Polish / Ruleta de puzzles y tablas de reconstrucción |
| v0.9.0 | 2026-09-01 → 2026-09-01 | 1 | 3D Pyraminx Engine & Face Simulator / Motor 3D de Pyraminx y simulador |
| v0.9.1 | 2026-09-02 → 2026-09-02 | 18 | Infinite F2L, Skill Radar & Changelog / Infinite F2L, radar de skills y changelog |
| v0.9.2 ⭐ (actual) | 2026-09-02 → 2026-09-09 | 30 | Theme Studio Avance: Temas, Tipografía, Scramble, Liquid Glass & UI Polish / Theme Studio: Themes, Typography, Scramble, Liquid Glass & UI Polish |

## Changelog completo

### v0.1.0 — Monorepo & Core Engine Architecture / Arquitectura monorepo y motor central — 2026-07-12 → 2026-07-12 — 42 commits

**Resumen:** Configuración del monorepo con pnpm workspaces, máquina de estados WCA y motor 3D Three.js.

**Destacados:**
- Monorepo structure with pnpm workspaces and isolated packages.
- WCA inspection and solve timing state machine with high-precision timestamping.
- Core Three.js 3D cube engine with sticker mapping and orbit controls.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-12 | [`e4925de`](https://github.com/Doritozz05/Cubeforge/commit/e4925de) | sin clasificar | Initial commit | .gitattributes · LICENSE · README.md |
| 2026-07-12 | [`cc153db`](https://github.com/Doritozz05/Cubeforge/commit/cc153db) | docs | Create PRD.md | PRD.md |
| 2026-07-12 | [`3d1dc7c`](https://github.com/Doritozz05/Cubeforge/commit/3d1dc7c) | docs | Update PRD.md | PRD.md |
| 2026-07-12 | [`2bd4aca`](https://github.com/Doritozz05/Cubeforge/commit/2bd4aca) | docs | roadmap | PRD.md · roadmap.md |
| 2026-07-12 | [`94b656b`](https://github.com/Doritozz05/Cubeforge/commit/94b656b) | sin clasificar | Reorganize and standardize docs | .codegraph/.gitignore · PRD.md · docs/00-product/PRD.md · docs/01-roadmap/Master_Roadmap.md · … (10 en total) |
| 2026-07-12 | [`6bda61f`](https://github.com/Doritozz05/Cubeforge/commit/6bda61f) | docs | Add docs, issue/PR templates and governance | .github/ISSUE_TEMPLATE/bug_report.md · .github/ISSUE_TEMPLATE/feature_request.md · .github/pull_request_template.md · CODE_OF_CONDUCT.md · … (22 en total) |
| 2026-07-12 | [`9a25e80`](https://github.com/Doritozz05/Cubeforge/commit/9a25e80) | docs | Add initial architecture research report | docs/02-architecture/research/Intial_Architecture_Research_Report.md · docs/README.md |
| 2026-07-12 | [`16b15af`](https://github.com/Doritozz05/Cubeforge/commit/16b15af) | sin clasificar | Organize architecture docs and indexes | docs/00-product/domain/README.md · docs/02-architecture/Architecture_Index.md · docs/02-architecture/Architecture_Lifecycle.md · docs/02-architecture/README.md · … (8 en total) |
| 2026-07-12 | [`82e8aad`](https://github.com/Doritozz05/Cubeforge/commit/82e8aad) | docs | Expand docs governance and templates | docs/00-product/README.md · docs/01-roadmap/README.md · docs/05-tdd/README.md · docs/06-api/README.md · … (28 en total) |
| 2026-07-12 | [`3b519ee`](https://github.com/Doritozz05/Cubeforge/commit/3b519ee) | docs | Tighten docs lifecycle governance | docs/00-product/PRD.md · docs/00-product/README.md · docs/01-roadmap/Master_Roadmap.md · docs/01-roadmap/README.md · … (30 en total) |
| 2026-07-12 | [`5ecf810`](https://github.com/Doritozz05/Cubeforge/commit/5ecf810) | docs | Create Architecture_Decision_Register.md | docs/02-architecture/Architecture_Decision_Register.md |
| 2026-07-12 | [`d5b062e`](https://github.com/Doritozz05/Cubeforge/commit/d5b062e) | docs | Document architecture research and RFCs | docs/02-architecture/Architecture_Decision_Register.md · docs/02-architecture/research/Architecture_Research_Roadmap.md · docs/02-architecture/research/platform/Bluetooth_Connectivity_Report.md · docs/02-architecture/research/platform/Legal_Audit_Report.md · … (11 en total) |
| 2026-07-12 | [`06df17d`](https://github.com/Doritozz05/Cubeforge/commit/06df17d) | docs | Add ADRs/RFCs and update ADR register | docs/02-architecture/Architecture_Decision_Register.md · docs/03-adr/ADR-004-Code_Quality_Standards.md · docs/03-adr/ADR-005-Testing_Stack.md · docs/03-adr/ADR-006-CI_NPM_Publishing.md · … (8 en total) |
| 2026-07-12 | [`04f1fa1`](https://github.com/Doritozz05/Cubeforge/commit/04f1fa1) | docs | Update Architecture_Decision_Register.md | docs/02-architecture/Architecture_Decision_Register.md |
| 2026-07-12 | [`d6d066e`](https://github.com/Doritozz05/Cubeforge/commit/d6d066e) | docs | Add ADRs and RFCs for hosting, frontend, and state management | docs/02-architecture/Architecture_Decision_Register.md · docs/03-adr/ADR-007-Hosting_Strategy.md · docs/03-adr/ADR-008-Frontend_Framework_Architecture.md · docs/03-adr/ADR-009-State_Management.md · … (10 en total) |
| 2026-07-12 | [`0a4f836`](https://github.com/Doritozz05/Cubeforge/commit/0a4f836) | docs | Finalize ADRs for licensing, storage, and Bluetooth | docs/02-architecture/Architecture_Decision_Register.md · docs/03-adr/ADR-010-Licensing_Compatibility.md · docs/03-adr/ADR-011-PWA_Storage_Eviction_Policies.md · docs/03-adr/ADR-012-Web_Bluetooth_Mobile_Fallbacks.md · … (7 en total) |
| 2026-07-12 | [`9bb1c4d`](https://github.com/Doritozz05/Cubeforge/commit/9bb1c4d) | docs | Update Architecture_Decision_Register.md | docs/02-architecture/Architecture_Decision_Register.md |
| 2026-07-12 | [`d2ea6ef`](https://github.com/Doritozz05/Cubeforge/commit/d2ea6ef) | docs | Add RFC documentation for core architecture decisions | docs/02-architecture/Architecture_Decision_Register.md · docs/04-rfc/RFC-013-Offline_Database.md · docs/04-rfc/RFC-014-Rendering_Strategy.md · docs/04-rfc/RFC-015-Solver_Engine.md · … (12 en total) |
| 2026-07-12 | [`c403602`](https://github.com/Doritozz05/Cubeforge/commit/c403602) | docs | Add ADRs and mark RFCs Approved | docs/03-adr/ADR-013-Offline_Database.md · docs/03-adr/ADR-021-Documentation_Stack.md · docs/04-rfc/RFC-004-Code_Quality_Standards.md · docs/04-rfc/RFC-005-Testing_Stack.md · … (7 en total) |
| 2026-07-12 | [`b7b0509`](https://github.com/Doritozz05/Cubeforge/commit/b7b0509) | docs | Update Architecture_Decision_Register.md | docs/02-architecture/Architecture_Decision_Register.md |
| 2026-07-12 | [`74cdabb`](https://github.com/Doritozz05/Cubeforge/commit/74cdabb) | sin clasificar | Add monorepo web scaffold and ADR updates | .gitignore · apps/web/.gitignore · apps/web/.oxlintrc.json · apps/web/README.md · … (43 en total) |
| 2026-07-12 | [`50d5ea9`](https://github.com/Doritozz05/Cubeforge/commit/50d5ea9) | chore | Add workspace package manifests | apps/api/package.json · packages/ai-core/package.json · packages/analysis-engine/package.json · packages/database/package.json · … (8 en total) |
| 2026-07-12 | [`bd6a8ae`](https://github.com/Doritozz05/Cubeforge/commit/bd6a8ae) | sin clasificar | Set up UI package with shadcn and Tailwind | packages/ui/components.json · packages/ui/package.json · packages/ui/src/components/ui/button.tsx · packages/ui/src/lib/utils.ts · … (8 en total) |
| 2026-07-12 | [`58874f0`](https://github.com/Doritozz05/Cubeforge/commit/58874f0) | chore | Add three new monorepo packages | packages/3d-engine/package.json · packages/statistics/package.json · packages/timer-engine/package.json · pnpm-lock.yaml |
| 2026-07-12 | [`4b34b98`](https://github.com/Doritozz05/Cubeforge/commit/4b34b98) | sin clasificar | Add CI, release, formatter, ESLint & TS configs | .github/workflows/ci.yml · .github/workflows/release.yml · .prettierrc · apps/web/eslint.config.js · … (14 en total) |
| 2026-07-12 | [`5b7ff75`](https://github.com/Doritozz05/Cubeforge/commit/5b7ff75) | sin clasificar | Add database and state management packages | packages/database/eslint.config.js · packages/database/package.json · packages/database/src/__tests__/db.test.ts · packages/database/src/client.ts · … (15 en total) |
| 2026-07-12 | [`6314422`](https://github.com/Doritozz05/Cubeforge/commit/6314422) | sin clasificar | Add @cubeforge/models package with Zod schemas | .changeset/README.md · .changeset/config.json · packages/models/eslint.config.js · packages/models/package.json · … (10 en total) |
| 2026-07-12 | [`165914d`](https://github.com/Doritozz05/Cubeforge/commit/165914d) | chore | Update package.json | package.json |
| 2026-07-12 | [`28202d8`](https://github.com/Doritozz05/Cubeforge/commit/28202d8) | sin clasificar | Add timer engine package | packages/timer-engine/package.json · packages/timer-engine/src/TimerEngine.ts · packages/timer-engine/src/TimerState.ts · packages/timer-engine/src/WcaRules.ts · … (10 en total) |
| 2026-07-12 | [`8c47a63`](https://github.com/Doritozz05/Cubeforge/commit/8c47a63) | sin clasificar | Add core TDD docs and models unit test | docs/05-tdd/core/0001-monorepo-cicd.md · docs/05-tdd/core/0002-global-state-architecture.md · docs/05-tdd/core/0003-data-models.md · docs/05-tdd/core/0004-timer-engine.md · … (5 en total) |
| 2026-07-12 | [`fa2bc23`](https://github.com/Doritozz05/Cubeforge/commit/fa2bc23) | sin clasificar | Add advanced WCA timer states | docs/05-tdd/core/0004-timer-engine.md · packages/timer-engine/src/TimerEngine.ts · packages/timer-engine/src/TimerState.ts · packages/timer-engine/src/events.ts · … (5 en total) |
| 2026-07-12 | [`a493062`](https://github.com/Doritozz05/Cubeforge/commit/a493062) | docs | Expand HAL roadmap for timers and cubes | docs/01-roadmap/Master_Roadmap.md · docs/05-tdd/core/0005-hardware-hal.md |
| 2026-07-12 | [`47c62ac`](https://github.com/Doritozz05/Cubeforge/commit/47c62ac) | docs | Update 0005-hardware-hal.md | docs/05-tdd/core/0005-hardware-hal.md |
| 2026-07-12 | [`fa06eb5`](https://github.com/Doritozz05/Cubeforge/commit/fa06eb5) | sin clasificar | Add gan-protocol and hardware-hal packages | packages/gan-protocol/package.json · packages/gan-protocol/src/gan-cube-definitions.ts · packages/gan-protocol/src/gan-cube-encrypter.ts · packages/gan-protocol/src/gan-cube-protocol.ts · … (23 en total) |
| 2026-07-12 | [`cb03f0a`](https://github.com/Doritozz05/Cubeforge/commit/cb03f0a) | sin clasificar | fixes | .github/workflows/ci.yml · .github/workflows/release.yml |
| 2026-07-12 | [`db6a454`](https://github.com/Doritozz05/Cubeforge/commit/db6a454) | sin clasificar | fixes | packages/hardware-hal/package.json · packages/hardware-hal/tsconfig.json · pnpm-lock.yaml |
| 2026-07-12 | [`2130639`](https://github.com/Doritozz05/Cubeforge/commit/2130639) | sin clasificar | Implement Stackmat processor and improve adapter error handling | packages/hardware-hal/src/audio/StackmatProcessor.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts · packages/hardware-hal/src/bluetooth/GanTimerAdapter.ts · packages/hardware-hal/tests/stackmat-test.ts |
| 2026-07-12 | [`f88c3f7`](https://github.com/Doritozz05/Cubeforge/commit/f88c3f7) | sin clasificar | Improve GAN cube connection fallback | packages/gan-protocol/src/gan-smart-cube.ts · packages/hardware-hal/demo.ts · packages/hardware-hal/index.html · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-12 | [`bcf3c07`](https://github.com/Doritozz05/Cubeforge/commit/bcf3c07) | sin clasificar | Update GanCubeAdapter.ts | packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-12 | [`cef956a`](https://github.com/Doritozz05/Cubeforge/commit/cef956a) | sin clasificar | Create LICENSE | packages/gan-protocol/LICENSE |
| 2026-07-12 | [`48ea895`](https://github.com/Doritozz05/Cubeforge/commit/48ea895) | docs | Create TDD-0006-3D-Engine.md | docs/05-tdd/TDD-0006-3D-Engine.md |
| 2026-07-12 | [`b61d673`](https://github.com/Doritozz05/Cubeforge/commit/b61d673) | sin clasificar | Integrate 3D cube engine with Web Workers and improve Bluetooth UX | apps/web/package.json · apps/web/src/App.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/animation/RotationEngine.ts · … (15 en total) |

### v0.1.1 — Offscreen Canvas & Render Worker / Offscreen Canvas y worker de render — 2026-07-12 → 2026-07-12 — 0 commits

**Resumen:** Web Worker dedicado para el renderizado 3D mediante OffscreenCanvas para fluidez a 60fps.

**Destacados:**
- OffscreenCanvas worker rendering to prevent UI thread frame drops during fast solves.
- Modular geometry allocation reusing buffers across scramble changes.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.1.2 — WCA Timer State Machine & Penalties / Estados de timer WCA y penalizaciones — 2026-07-13 → 2026-07-13 — 42 commits

**Resumen:** Cuenta atrás precisa de 15 segundos WCA, barra de retención y evaluación de penalizaciones +2/DNF.

**Destacados:**
- Strict WCA inspection protocol with color transitions (orange 8s, red 12s, +2 at 15s, DNF at 17s).
- Hold-to-start timing mechanism with spacebar and multi-touch support.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-13 | [`de6e11a`](https://github.com/Doritozz05/Cubeforge/commit/de6e11a) | sin clasificar | Extract types pkg and fix cube rotation precision | apps/web/package.json · apps/web/src/App.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/animation/Easing.ts · … (19 en total) |
| 2026-07-13 | [`ba75361`](https://github.com/Doritozz05/Cubeforge/commit/ba75361) | sin clasificar | Fix worker exports and app imports | apps/web/package.json · apps/web/src/App.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/core/CubeMeshFactory.ts · … (6 en total) |
| 2026-07-13 | [`19805e0`](https://github.com/Doritozz05/Cubeforge/commit/19805e0) | sin clasificar | Fix rotation math and improve position snapping | packages/cube-3d-engine/src/animation/RotationEngine.ts · packages/cube-3d-engine/src/core/CubeMeshFactory.ts · packages/cube-3d-engine/src/core/CubeModel.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts · … (5 en total) |
| 2026-07-13 | [`f0d6b8b`](https://github.com/Doritozz05/Cubeforge/commit/f0d6b8b) | sin clasificar | Fix 3D camera and gyro alignment | packages/cube-3d-engine/src/core/SceneManager.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts |
| 2026-07-13 | [`6f452d6`](https://github.com/Doritozz05/Cubeforge/commit/6f452d6) | docs | Create auditoria.md | docs/auditoria.md |
| 2026-07-13 | [`7cb767f`](https://github.com/Doritozz05/Cubeforge/commit/7cb767f) | docs | Update auditoria.md | docs/auditoria.md |
| 2026-07-13 | [`fb4dc1f`](https://github.com/Doritozz05/Cubeforge/commit/fb4dc1f) | sin clasificar | Fix audit issues in hardware HAL and protocol | docs/auditoria.md · packages/gan-protocol/src/gan-cube-protocol.ts · packages/hardware-hal/demo.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts · … (9 en total) |
| 2026-07-13 | [`84cfe65`](https://github.com/Doritozz05/Cubeforge/commit/84cfe65) | sin clasificar | Fix GAN sync and move parsing | apps/web/src/App.tsx · docs/auditoria.md · packages/gan-protocol/src/gan-cube-protocol.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-13 | [`bf3ceb6`](https://github.com/Doritozz05/Cubeforge/commit/bf3ceb6) | sin clasificar | Refactor timer events to RxJS | apps/web/src/App.tsx · docs/auditoria.md · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/constants/faceRotation.ts · … (17 en total) |
| 2026-07-13 | [`0171f7b`](https://github.com/Doritozz05/Cubeforge/commit/0171f7b) | sin clasificar | Various fixes: pwa, engine, sync, db, hal, tests | apps/web/src/App.css · apps/web/src/App.tsx · apps/web/src/index.css · apps/web/src/vite-env.d.ts · … (42 en total) |
| 2026-07-13 | [`d1a3a9d`](https://github.com/Doritozz05/Cubeforge/commit/d1a3a9d) | docs | Update auditoria.md | docs/auditoria.md |
| 2026-07-13 | [`bfaa390`](https://github.com/Doritozz05/Cubeforge/commit/bfaa390) | sin clasificar | Update tsconfig.json | packages/timer-engine/tsconfig.json |
| 2026-07-13 | [`9f1a81e`](https://github.com/Doritozz05/Cubeforge/commit/9f1a81e) | sin clasificar | fixes | packages/database/src/__tests__/db.test.ts · packages/database/src/migrations/migrations.ts · packages/database/src/repositories/algorithms.repository.ts · packages/database/src/repositories/sessions.repository.ts · … (12 en total) |
| 2026-07-13 | [`7b5f845`](https://github.com/Doritozz05/Cubeforge/commit/7b5f845) | docs | Update auditoria.md | docs/auditoria.md |
| 2026-07-13 | [`9c939ae`](https://github.com/Doritozz05/Cubeforge/commit/9c939ae) | sin clasificar | Add vitest integration and fix hardware adapters | apps/web/tests/integration/TimerEngine.integration.test.ts · docs/02-architecture/Architecture_Decision_Register.md · package.json · packages/cube-3d-engine/src/hardware/SyncBridge.ts · … (14 en total) |
| 2026-07-13 | [`5a975f0`](https://github.com/Doritozz05/Cubeforge/commit/5a975f0) | docs | Update auditoria.md | docs/auditoria.md |
| 2026-07-13 | [`5561839`](https://github.com/Doritozz05/Cubeforge/commit/5561839) | sin clasificar | Build complete speedcubing timer UI | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · … (74 en total) |
| 2026-07-13 | [`ea13a7c`](https://github.com/Doritozz05/Cubeforge/commit/ea13a7c) | sin clasificar | Add Cube connector & DB-backed persistent session | apps/web/package.json · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Stats/TrendChart.tsx · … (10 en total) |
| 2026-07-13 | [`eea25c2`](https://github.com/Doritozz05/Cubeforge/commit/eea25c2) | sin clasificar | Update client.ts | packages/database/src/client.ts |
| 2026-07-13 | [`40e6cbb`](https://github.com/Doritozz05/Cubeforge/commit/40e6cbb) | sin clasificar | Add cube 3D panel and session actions | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · … (6 en total) |
| 2026-07-13 | [`9c2ad73`](https://github.com/Doritozz05/Cubeforge/commit/9c2ad73) | sin clasificar | Use global cube adapter and simplify UI | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/Header.tsx · packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-07-13 | [`cc48411`](https://github.com/Doritozz05/Cubeforge/commit/cc48411) | sin clasificar | fixes | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/Header.tsx |
| 2026-07-13 | [`4fa9eaf`](https://github.com/Doritozz05/Cubeforge/commit/4fa9eaf) | sin clasificar | fixes | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-13 | [`3710015`](https://github.com/Doritozz05/Cubeforge/commit/3710015) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/theme-toggle.tsx · … (5 en total) |
| 2026-07-13 | [`937d745`](https://github.com/Doritozz05/Cubeforge/commit/937d745) | sin clasificar | Rebrand UI and storage keys to cubeforge | apps/web/index.html · apps/web/public/favicon.svg · apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · … (6 en total) |
| 2026-07-13 | [`70ebd4b`](https://github.com/Doritozz05/Cubeforge/commit/70ebd4b) | sin clasificar | Fix session seeding, timer handlers, header styles | apps/web/src/components/Layout/Header.tsx · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/hooks/useTimerUI.ts |
| 2026-07-13 | [`01edacc`](https://github.com/Doritozz05/Cubeforge/commit/01edacc) | docs | Update PRD.md | docs/00-product/PRD.md |
| 2026-07-13 | [`db77da0`](https://github.com/Doritozz05/Cubeforge/commit/db77da0) | sin clasificar | Refactor cube rendering with modular core+sticker design | packages/cube-3d-engine/src/core/CubeMeshFactory.ts · packages/cube-3d-engine/src/core/CubeModel.ts · packages/cube-3d-engine/src/hardware/SyncBridge.ts |
| 2026-07-13 | [`5bb945a`](https://github.com/Doritozz05/Cubeforge/commit/5bb945a) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-13 | [`138246f`](https://github.com/Doritozz05/Cubeforge/commit/138246f) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-13 | [`c9432a6`](https://github.com/Doritozz05/Cubeforge/commit/c9432a6) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-13 | [`2a7cf0c`](https://github.com/Doritozz05/Cubeforge/commit/2a7cf0c) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-13 | [`8b63e2c`](https://github.com/Doritozz05/Cubeforge/commit/8b63e2c) | sin clasificar | Add drag camera orbit controls | apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/src/core/SceneManager.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts |
| 2026-07-13 | [`de75561`](https://github.com/Doritozz05/Cubeforge/commit/de75561) | sin clasificar | Add facelet parsing and cube reset | apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/core/CubeModel.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts · … (8 en total) |
| 2026-07-13 | [`b1927ea`](https://github.com/Doritozz05/Cubeforge/commit/b1927ea) | sin clasificar | Update FaceletParser.ts | packages/math-core/src/FaceletParser.ts |
| 2026-07-13 | [`f300b84`](https://github.com/Doritozz05/Cubeforge/commit/f300b84) | sin clasificar | Add cube disconnect and connection state UI | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Hardware/CubeConnector.tsx |
| 2026-07-13 | [`422dfd3`](https://github.com/Doritozz05/Cubeforge/commit/422dfd3) | feat | feat: move coalesce heuristic with multi-layer animation | packages/cube-3d-engine/src/animation/RotationEngine.ts · packages/cube-3d-engine/src/hardware/SyncBridge.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts |
| 2026-07-13 | [`b288437`](https://github.com/Doritozz05/Cubeforge/commit/b288437) | sin clasificar | Add clock drift reconciliation | packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts · packages/hardware-hal/src/sync/ClockDrift.ts · packages/hardware-hal/tests/ClockDrift.test.ts |
| 2026-07-13 | [`05fd86c`](https://github.com/Doritozz05/Cubeforge/commit/05fd86c) | docs | Update auditoria.md | docs/auditoria.md |
| 2026-07-13 | [`e25b490`](https://github.com/Doritozz05/Cubeforge/commit/e25b490) | sin clasificar | Support concurrent rotations with pivot task pool | packages/cube-3d-engine/src/animation/RotationEngine.ts · packages/cube-3d-engine/src/core/CubeModel.ts · packages/cube-3d-engine/src/hardware/SyncBridge.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts |
| 2026-07-13 | [`90a5b9d`](https://github.com/Doritozz05/Cubeforge/commit/90a5b9d) | docs | Create TDD-04-Solver-Engine.md | docs/05-tdd/TDD-04-Solver-Engine.md |
| 2026-07-13 | [`8ff225c`](https://github.com/Doritozz05/Cubeforge/commit/8ff225c) | sin clasificar | Add cube state math core | packages/math-core/package.json · packages/math-core/src/Constants.ts · packages/math-core/src/CubeState.test.ts · packages/math-core/src/CubeState.ts · … (6 en total) |

### v0.1.3 — Design Tokens & Responsive Layout / Tokens de diseño y diseño adaptativo — 2026-07-13 → 2026-07-13 — 0 commits

**Resumen:** Escala tipográfica, tokens CSS personalizados, paleta de tema oscuro y estructura responsive.

**Destacados:**
- Custom design system with semantic color tokens, monospaced tabular numerals and smooth transitions.
- Adaptive sidebar navigation for mobile and desktop screens.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.2.0 — Timer Stage & Responsive Display / Timer Stage y pantalla adaptativa — 2026-07-14 → 2026-07-14 — 16 commits

**Resumen:** Layout de timer con tipografía clamp adaptable e indicadores de inicio WCA.

**Destacados:**
- Responsive timer display using viewport clamp scaling to fit mobile, tablet, and ultra-wide screens.
- Hold-to-start tactile feedback with visual state transitions (IDLE → ARMED → READY).

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-14 | [`b4ab8a7`](https://github.com/Doritozz05/Cubeforge/commit/b4ab8a7) | sin clasificar | Add RandomStateGenerator for cube state generation | apps/web/src/App.tsx · apps/web/src/utils/MockSolver.ts · apps/web/src/utils/mockData.ts · packages/math-core/src/RandomStateGenerator.test.ts · … (6 en total) |
| 2026-07-14 | [`34f9c27`](https://github.com/Doritozz05/Cubeforge/commit/34f9c27) | sin clasificar | Replace MockSolver with Min2PhaseSolver | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Stats/StatsPanel.tsx · apps/web/src/utils/MockSolver.ts · … (11 en total) |
| 2026-07-14 | [`f50e443`](https://github.com/Doritozz05/Cubeforge/commit/f50e443) | sin clasificar | Add method phase masks and matcher | packages/math-core/src/index.ts · packages/math-core/src/methods/IMethodDefinition.ts · packages/math-core/src/methods/StateMatcher.test.ts · packages/math-core/src/methods/StateMatcher.ts · … (6 en total) |
| 2026-07-14 | [`a6b25eb`](https://github.com/Doritozz05/Cubeforge/commit/a6b25eb) | sin clasificar | Add sidebar toggle to main layout | apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-14 | [`263a381`](https://github.com/Doritozz05/Cubeforge/commit/263a381) | sin clasificar | Scramble validation, smart-cube timing, and audio | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Timer/TimerContainer.tsx · … (9 en total) |
| 2026-07-14 | [`0e67af3`](https://github.com/Doritozz05/Cubeforge/commit/0e67af3) | sin clasificar | fixes | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-14 | [`9215543`](https://github.com/Doritozz05/Cubeforge/commit/9215543) | sin clasificar | Add inspection penalties to timer | apps/web/src/App.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Timer/TimerDisplay.tsx · apps/web/src/hooks/useTimerUI.ts · … (6 en total) |
| 2026-07-14 | [`25812a4`](https://github.com/Doritozz05/Cubeforge/commit/25812a4) | sin clasificar | Update vite.config.ts | apps/web/vite.config.ts |
| 2026-07-14 | [`c7b34e4`](https://github.com/Doritozz05/Cubeforge/commit/c7b34e4) | sin clasificar | Fix Vite headers for SQLite worker | apps/web/vite.config.ts · packages/database/src/worker.ts |
| 2026-07-14 | [`d2c86eb`](https://github.com/Doritozz05/Cubeforge/commit/d2c86eb) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-14 | [`d24642f`](https://github.com/Doritozz05/Cubeforge/commit/d24642f) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-14 | [`70dddcf`](https://github.com/Doritozz05/Cubeforge/commit/70dddcf) | sin clasificar | Stabilize rotations and cube rendering | packages/cube-3d-engine/src/animation/RotationEngine.ts · packages/cube-3d-engine/src/core/CubeMeshFactory.ts · packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-07-14 | [`5632a36`](https://github.com/Doritozz05/Cubeforge/commit/5632a36) | sin clasificar | Add gyroscope rotation detection and orientation tracking | apps/web/src/components/Cube3D/Cube3DPanel.tsx · docs/plan.md · packages/cube-3d-engine/src/hardware/RotationDetector.ts · packages/cube-3d-engine/src/hardware/SyncBridge.ts · … (8 en total) |
| 2026-07-14 | [`8fe0483`](https://github.com/Doritozz05/Cubeforge/commit/8fe0483) | sin clasificar | Update shared UI utilities | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/ui/calendar.tsx · … (20 en total) |
| 2026-07-14 | [`24ff9ed`](https://github.com/Doritozz05/Cubeforge/commit/24ff9ed) | sin clasificar | Revert recent unstable changes and restore stable state | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/ui/calendar.tsx · … (27 en total) |
| 2026-07-14 | [`4aed01a`](https://github.com/Doritozz05/Cubeforge/commit/4aed01a) | sin clasificar | Prevent timer start from unscrambled state | apps/web/src/hooks/useScrambleValidator.ts · apps/web/src/hooks/useTimerUI.ts |

### v0.2.1 — Smart Cube Web Bluetooth / Smart Cube y Web Bluetooth — 2026-07-14 → 2026-07-14 — 0 commits

**Resumen:** Integración de Web Bluetooth API para cubos inteligentes GAN y GoCube con sincronización de estado.

**Destacados:**
- Smart Cube Bluetooth connectivity layer with auto-reconnection and battery monitoring.
- Move packet decoding pipeline mapping physical rotations to standard move notation.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.2.2 — Gyroscope & Quaternion Tracking / Giroscopio y seguimiento de cuaterniones — 2026-07-15 → 2026-07-15 — 10 commits

**Resumen:** Telemetría de giroscopio en tiempo real, normalizador de cuaterniones y seguimiento sin deriva.

**Destacados:**
- Real-time 3D gyroscope tracking with quaternion filtering and gimbal-lock elimination.
- Smooth 60fps orientation interpolation matching physical cube orientation on screen.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-15 | [`70327f5`](https://github.com/Doritozz05/Cubeforge/commit/70327f5) | sin clasificar | Update MainLayout.tsx | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-15 | [`929b223`](https://github.com/Doritozz05/Cubeforge/commit/929b223) | sin clasificar | Update Header.tsx | apps/web/src/components/Layout/Header.tsx |
| 2026-07-15 | [`b353ada`](https://github.com/Doritozz05/Cubeforge/commit/b353ada) | sin clasificar | Update Cube3DPanel.tsx | apps/web/src/components/Cube3D/Cube3DPanel.tsx |
| 2026-07-15 | [`b0bf4b7`](https://github.com/Doritozz05/Cubeforge/commit/b0bf4b7) | sin clasificar | Update Cube3DPanel.tsx | apps/web/src/components/Cube3D/Cube3DPanel.tsx |
| 2026-07-15 | [`17d89ee`](https://github.com/Doritozz05/Cubeforge/commit/17d89ee) | sin clasificar | Improve cube visuals, easing, and cleanup | apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/animation/Easing.ts · packages/cube-3d-engine/src/animation/RotationEngine.ts · … (8 en total) |
| 2026-07-15 | [`b0bbc37`](https://github.com/Doritozz05/Cubeforge/commit/b0bbc37) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-15 | [`afd9386`](https://github.com/Doritozz05/Cubeforge/commit/afd9386) | sin clasificar | Stabilize cube sync and scramble UI | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/hooks/useScrambleValidator.ts · … (10 en total) |
| 2026-07-15 | [`d546ace`](https://github.com/Doritozz05/Cubeforge/commit/d546ace) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-15 | [`0636e2a`](https://github.com/Doritozz05/Cubeforge/commit/0636e2a) | sin clasificar | Handle unsolved start in scramble validation | apps/web/src/App.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-15 | [`fbc2ef9`](https://github.com/Doritozz05/Cubeforge/commit/fbc2ef9) | sin clasificar | Refactor useScrambleValidator error handling | apps/web/src/App.tsx · apps/web/src/hooks/useScrambleValidator.ts |

### v0.2.3 — Orientation Auto-Calibration / Auto-calibración de orientación — 2026-07-16 → 2026-07-16 — 6 commits

**Resumen:** Reinicio de orientación en un toque, auto-calibración de caras e indicador de estado de hardware.

**Destacados:**
- Quick-tap orientation reset button and keyboard shortcut to align the virtual and physical cube.
- Visual connection pill showing signal strength and hardware telemetry.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-16 | [`cee2c88`](https://github.com/Doritozz05/Cubeforge/commit/cee2c88) | sin clasificar | Handle worker canvas reconnect on remount | apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/workers/EngineWorker.ts · pnpm-lock.yaml |
| 2026-07-16 | [`dd5b1a1`](https://github.com/Doritozz05/Cubeforge/commit/dd5b1a1) | sin clasificar | Standardize linting and tighten TS types | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Stats/TrendChart.tsx · apps/web/src/components/ui/calendar.tsx · … (38 en total) |
| 2026-07-16 | [`d1a1165`](https://github.com/Doritozz05/Cubeforge/commit/d1a1165) | sin clasificar | Use .cjs/.mjs outputs in package builds | packages/gan-protocol/package.json · packages/gan-protocol/tsup.config.ts · packages/hardware-hal/package.json · packages/hardware-hal/tsup.config.ts · … (8 en total) |
| 2026-07-16 | [`bae9c20`](https://github.com/Doritozz05/Cubeforge/commit/bae9c20) | sin clasificar | Keep Cube3D mounted after first activation | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-16 | [`e49494b`](https://github.com/Doritozz05/Cubeforge/commit/e49494b) | sin clasificar | Add responsive left nav and HTTPS dev support | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/Header.tsx · … (10 en total) |
| 2026-07-16 | [`efbdcae`](https://github.com/Doritozz05/Cubeforge/commit/efbdcae) | sin clasificar | Update MainLayout.tsx | apps/web/src/components/Layout/MainLayout.tsx |

### v0.2.4 — CFOP Solver Engine & Phase Split / Motor de resolución CFOP y fases — 2026-07-17 → 2026-07-17 — 21 commits

**Resumen:** Segmentación automática del solve en fases de Cross, 4 pares de F2L, OLL y PLL.

**Destacados:**
- Real-time CFOP solver engine breaking down solves into phase splits.
- Detailed metrics for TPS (turns per second) and move counts per phase.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-17 | [`aa0b359`](https://github.com/Doritozz05/Cubeforge/commit/aa0b359) | docs | Create Dynamic_Notation_Orientation_System.md | docs/02-architecture/Dynamic_Notation_Orientation_System.md |
| 2026-07-17 | [`ad141b2`](https://github.com/Doritozz05/Cubeforge/commit/ad141b2) | sin clasificar | Add cube orientation table and move remapping | packages/math-core/src/index.ts · packages/math-core/src/orientation/MoveTransformer.ts · packages/math-core/src/orientation/OrientationTable.ts · packages/math-core/src/orientation/__tests__/MoveTransformer.test.ts · … (7 en total) |
| 2026-07-17 | [`7f002a1`](https://github.com/Doritozz05/Cubeforge/commit/7f002a1) | sin clasificar | Update OrientationTable.ts | packages/math-core/src/orientation/OrientationTable.ts |
| 2026-07-17 | [`d879172`](https://github.com/Doritozz05/Cubeforge/commit/d879172) | test | Update OrientationTable.test.ts | packages/math-core/src/orientation/__tests__/OrientationTable.test.ts |
| 2026-07-17 | [`2fe566a`](https://github.com/Doritozz05/Cubeforge/commit/2fe566a) | sin clasificar | Add OrientationTracker and worker integration | packages/cube-3d-engine/src/__tests__/OrientationTracker.test.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts · packages/cube-3d-engine/src/hardware/OrientationTracker.ts · packages/cube-3d-engine/src/index.ts · … (5 en total) |
| 2026-07-17 | [`65a402a`](https://github.com/Doritozz05/Cubeforge/commit/65a402a) | sin clasificar | Harden gyro calibration and worker cleanup | packages/cube-3d-engine/src/hardware/OrientationTracker.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts |
| 2026-07-17 | [`8a5bc7c`](https://github.com/Doritozz05/Cubeforge/commit/8a5bc7c) | sin clasificar | Canonicalize orientation table quaternions | packages/cube-3d-engine/src/__tests__/OrientationTracker.test.ts · packages/math-core/src/orientation/OrientationTable.ts · packages/math-core/src/orientation/__tests__/OrientationTable.test.ts |
| 2026-07-17 | [`131ae10`](https://github.com/Doritozz05/Cubeforge/commit/131ae10) | sin clasificar | Update OrientationTable.ts | packages/math-core/src/orientation/OrientationTable.ts |
| 2026-07-17 | [`f5b6b44`](https://github.com/Doritozz05/Cubeforge/commit/f5b6b44) | sin clasificar | Add orientation state and gyro capability support | apps/web/src/hooks/useOrientation.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts · packages/state/package.json · packages/state/src/index.ts · … (6 en total) |
| 2026-07-17 | [`0d5e589`](https://github.com/Doritozz05/Cubeforge/commit/0d5e589) | sin clasificar | Add orientation-aware move display mapping | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-17 | [`a063cdc`](https://github.com/Doritozz05/Cubeforge/commit/a063cdc) | test | Update MoveTransformer.test.ts | packages/math-core/src/orientation/__tests__/MoveTransformer.test.ts |
| 2026-07-17 | [`aef97db`](https://github.com/Doritozz05/Cubeforge/commit/aef97db) | test | Update TimerEngine.integration.test.ts | apps/web/tests/integration/TimerEngine.integration.test.ts |
| 2026-07-17 | [`4891439`](https://github.com/Doritozz05/Cubeforge/commit/4891439) | sin clasificar | Fix late gyro enable and rotation event flow | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/src/__tests__/OrientationPipeline.integration.test.ts · … (11 en total) |
| 2026-07-17 | [`11b8450`](https://github.com/Doritozz05/Cubeforge/commit/11b8450) | sin clasificar | Add settings UI and compact move notation | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/SettingsSidebar.tsx · … (13 en total) |
| 2026-07-17 | [`28fffee`](https://github.com/Doritozz05/Cubeforge/commit/28fffee) | sin clasificar | Polish settings UI with animated sections | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/SettingsSidebar.tsx · apps/web/src/components/Settings/components/SettingToggle.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · … (6 en total) |
| 2026-07-17 | [`7c4d34d`](https://github.com/Doritozz05/Cubeforge/commit/7c4d34d) | sin clasificar | Update Header.tsx | apps/web/src/components/Layout/Header.tsx |
| 2026-07-17 | [`c14fb10`](https://github.com/Doritozz05/Cubeforge/commit/c14fb10) | sin clasificar | Fix fixed header positioning in main layout | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-17 | [`28a7a87`](https://github.com/Doritozz05/Cubeforge/commit/28a7a87) | sin clasificar | Update App.tsx | apps/web/src/App.tsx |
| 2026-07-17 | [`772b4a8`](https://github.com/Doritozz05/Cubeforge/commit/772b4a8) | sin clasificar | Update index.css | apps/web/src/index.css |
| 2026-07-17 | [`f1d4519`](https://github.com/Doritozz05/Cubeforge/commit/f1d4519) | sin clasificar | Unify timer flow with ARMED state support | apps/web/src/App.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Settings/settings.constants.ts · … (17 en total) |
| 2026-07-17 | [`5662477`](https://github.com/Doritozz05/Cubeforge/commit/5662477) | sin clasificar | Bypass scramble validation when disabled | apps/web/src/App.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Timer/TimerDisplay.tsx · apps/web/src/components/Timer/hintFor.test.ts · … (11 en total) |

### v0.2.5 — Color Neutrality & Face Mapping / Neutralidad de color y mapeo de caras — 2026-07-17 → 2026-07-17 — 0 commits

**Resumen:** Detección de cruz en cualquier color permitiendo resolver CFOP en cualquiera de las 6 caras.

**Destacados:**
- Cross solver supporting all 6 starting colors (White, Yellow, Green, Blue, Red, Orange).
- Automatic face color remapping for consistent Last Layer recognition.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.2.6 — PB Milestones & Session Bests / Hitos PB y mejores de sesión — 2026-07-18 → 2026-07-18 — 16 commits

**Resumen:** Celebración instantánea de récords personales (PB) de single, Ao5 y Ao12 con insignias conmemorativas.

**Destacados:**
- Automatic PB milestone detection comparing current solves against all-time session history.
- Celebratory visual badges and sound alerts on breaking Single and Average PBs.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-18 | [`7252a98`](https://github.com/Doritozz05/Cubeforge/commit/7252a98) | docs | Create EPIC5_Audit_Report.md | docs/auditorias/EPIC5_Audit_Report.md |
| 2026-07-18 | [`a614778`](https://github.com/Doritozz05/Cubeforge/commit/a614778) | sin clasificar | Add analysis engine and solve metric pipeline | packages/analysis-engine/package.json · packages/analysis-engine/src/index.ts · packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts · packages/analysis-engine/src/metrics/EfficiencyCalculator.ts · … (22 en total) |
| 2026-07-18 | [`23d2937`](https://github.com/Doritozz05/Cubeforge/commit/23d2937) | sin clasificar | Add smart-cube solve analysis and method settings | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/AnalysisSection.tsx · … (11 en total) |
| 2026-07-18 | [`be9094e`](https://github.com/Doritozz05/Cubeforge/commit/be9094e) | sin clasificar | Add direct GAN cube reconnection path | packages/gan-protocol/src/gan-smart-cube.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-18 | [`b77164e`](https://github.com/Doritozz05/Cubeforge/commit/b77164e) | sin clasificar | Use scramble state in timer idle hints | apps/web/src/App.tsx · apps/web/src/components/Timer/hintFor.test.ts · apps/web/src/components/Timer/hintFor.ts · docs/auditorias/auditoria.md |
| 2026-07-18 | [`84a9c5c`](https://github.com/Doritozz05/Cubeforge/commit/84a9c5c) | docs | Create UI_AUDIT_2026.md | docs/02-architecture/research/UI_AUDIT_2026.md |
| 2026-07-18 | [`0060274`](https://github.com/Doritozz05/Cubeforge/commit/0060274) | sin clasificar | Persist solve analysis and add metric tests | apps/web/src/App.tsx · apps/web/src/components/Stats/SolveAnalysisPanel.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/hooks/usePersistentSession.ts · … (20 en total) |
| 2026-07-18 | [`b050470`](https://github.com/Doritozz05/Cubeforge/commit/b050470) | sin clasificar | Fix scramble-aware analysis pipeline | apps/web/src/hooks/__tests__/state-machine.test.ts · apps/web/src/hooks/useSolveSession.ts · packages/analysis-engine/src/__tests__/CFOPMetricsCalculator.integration.test.ts · packages/analysis-engine/src/__tests__/PhaseSplitter.integration.test.ts · … (8 en total) |
| 2026-07-18 | [`d5620bd`](https://github.com/Doritozz05/Cubeforge/commit/d5620bd) | sin clasificar | Add phase-detection diagnostics and gyro reset | apps/web/src/components/Cube3D/Cube3DPanel.tsx · docs/14-ai/Phase_Detection_Investigation_Report.md · packages/analysis-engine/src/__tests__/diagnostic-phase-detection.test.ts · packages/cube-3d-engine/src/core/SceneManager.ts · … (7 en total) |
| 2026-07-18 | [`74a64e2`](https://github.com/Doritozz05/Cubeforge/commit/74a64e2) | sin clasificar | Enable color-neutral CFOP and fix solve time | apps/web/src/components/Stats/SolveAnalysisPanel.tsx · apps/web/src/hooks/useSolveSession.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · packages/math-core/src/methods/cfop/cfopMasks.ts |
| 2026-07-18 | [`be0b89e`](https://github.com/Doritozz05/Cubeforge/commit/be0b89e) | sin clasificar | Add monorepo typecheck pipeline and CN tests | apps/api/package.json · apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Stats/SolveAnalysisPanel.tsx · … (27 en total) |
| 2026-07-18 | [`f175693`](https://github.com/Doritozz05/Cubeforge/commit/f175693) | sin clasificar | Keep first solve move after auto-arm | apps/web/src/hooks/useSolveSession.ts · packages/analysis-engine/src/__tests__/diagnostic-cfop-zero-phases.test.ts |
| 2026-07-18 | [`64ee3ba`](https://github.com/Doritozz05/Cubeforge/commit/64ee3ba) | sin clasificar | Use start facelets for deterministic analysis | apps/web/src/App.tsx · apps/web/src/hooks/useScrambleValidator.ts · apps/web/src/hooks/useSolveSession.ts · packages/analysis-engine/src/__tests__/initial-facelets-b6.test.ts · … (6 en total) |
| 2026-07-18 | [`0f7066f`](https://github.com/Doritozz05/Cubeforge/commit/0f7066f) | sin clasificar | Stabilize GAN sync and solve state analysis | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/vite.config.ts · … (8 en total) |
| 2026-07-18 | [`0f8110f`](https://github.com/Doritozz05/Cubeforge/commit/0f8110f) | docs | Create Auditoria_Tecnica_Integral_2026-07-18.md | auditorias/Auditoria_Tecnica_Integral_2026-07-18.md |
| 2026-07-18 | [`d5e0061`](https://github.com/Doritozz05/Cubeforge/commit/d5e0061) | sin clasificar | Extract solver engine and align packages | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/hooks/usePersistentSession.ts · … (44 en total) |

### v0.2.7 — 2D Scramble Net & Verification / Red 2D de mezcla y verificación — 2026-07-19 → 2026-07-19 — 15 commits

**Resumen:** Vista interactiva en red 2D del cubo desplegado mostrando el estado exacto de la mezcla.

**Destacados:**
- 2D flat cube net preview illustrating the scrambled state for quick inspection verification.
- Clickable 2D net modal for enlarged examination of scramble patterns.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-19 | [`2c9cb61`](https://github.com/Doritozz05/Cubeforge/commit/2c9cb61) | test | Expand CubeState test coverage for refactor | packages/math-core/src/CubeState.test.ts · packages/math-core/src/__tests__/CubeState.applySequence.test.ts · packages/math-core/src/__tests__/CubeState.binaryRoundtrip.test.ts · packages/math-core/src/__tests__/CubeState.clone.test.ts · … (8 en total) |
| 2026-07-19 | [`33d7c99`](https://github.com/Doritozz05/Cubeforge/commit/33d7c99) | test | Create CubeState.preRefactor.test.ts | packages/math-core/src/__tests__/CubeState.preRefactor.test.ts |
| 2026-07-19 | [`cc48e96`](https://github.com/Doritozz05/Cubeforge/commit/cc48e96) | test | Expand CubeState validation test coverage | packages/math-core/src/__tests__/CubeState.binaryRoundtrip.test.ts · packages/math-core/src/__tests__/CubeState.externalOracle.test.ts · packages/math-core/src/__tests__/CubeState.preRefactor.test.ts |
| 2026-07-19 | [`12d180c`](https://github.com/Doritozz05/Cubeforge/commit/12d180c) | sin clasificar | Refactor CubeState to bigint-backed adapters | packages/math-core/src/CubeState.test.ts · packages/math-core/src/CubeState.ts · packages/math-core/src/__tests__/CubeState.preRefactor.test.ts · packages/math-core/src/adapters/CubeStateAdapters.ts |
| 2026-07-19 | [`a896f59`](https://github.com/Doritozz05/Cubeforge/commit/a896f59) | sin clasificar | Optimize CubeState moves and mask matching | packages/math-core/src/CubeState.ts · packages/math-core/src/__tests__/CubeState.jsonSafety.test.ts · packages/math-core/src/__tests__/CubeState.moveBitTable.test.ts · packages/math-core/src/__tests__/StateMatcher.bitmask.test.ts · … (6 en total) |
| 2026-07-19 | [`f6b01ef`](https://github.com/Doritozz05/Cubeforge/commit/f6b01ef) | sin clasificar | Update useSolveSession.ts | apps/web/src/hooks/useSolveSession.ts |
| 2026-07-19 | [`de2ca97`](https://github.com/Doritozz05/Cubeforge/commit/de2ca97) | sin clasificar | Compact GAN Gen2 half-turns in solve analysis | apps/web/src/hooks/useSolveSession.ts · packages/gan-protocol/src/gan-cube-protocol.ts |
| 2026-07-19 | [`4290811`](https://github.com/Doritozz05/Cubeforge/commit/4290811) | sin clasificar | Extract cube move compaction to math-core | apps/web/src/hooks/useSolveSession.ts · packages/math-core/src/index.ts · packages/math-core/src/orientation/CubeMoveCompacter.ts |
| 2026-07-19 | [`c5c325e`](https://github.com/Doritozz05/Cubeforge/commit/c5c325e) | docs | Create CFOP_Analysis_Status_2026-07-19.md | docs/14-ai/CFOP_Analysis_Status_2026-07-19.md |
| 2026-07-19 | [`46fe75c`](https://github.com/Doritozz05/Cubeforge/commit/46fe75c) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-19 | [`5a0c736`](https://github.com/Doritozz05/Cubeforge/commit/5a0c736) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-19 | [`bdf68a5`](https://github.com/Doritozz05/Cubeforge/commit/bdf68a5) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-19 | [`1ef47a8`](https://github.com/Doritozz05/Cubeforge/commit/1ef47a8) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-19 | [`8ae99b6`](https://github.com/Doritozz05/Cubeforge/commit/8ae99b6) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-19 | [`1aa2a72`](https://github.com/Doritozz05/Cubeforge/commit/1aa2a72) | sin clasificar | Add state-based F2L pair and phase rotation UI | apps/web/src/components/Stats/SolveAnalysisPanel.tsx · docs/14-ai/CFOP_Analysis_Status_2026-07-19.md · packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts · packages/math-core/src/methods/cfop/cfopMasks.ts |

### v0.2.8 — 3D Gyroscope Replay / Replay giroscópico 3D — 2026-07-20 → 2026-07-20 — 29 commits

**Resumen:** Replay 3D del solve con giros de capa sincronizados, rotaciones físicas y barra temporal.

**Destacados:**
- Full 3D replay engine animating layer rotations and physical cube orientation synchronously.
- Playback controls with Play, Pause, Step-Forward, Step-Backward and speed multiplier (0.5x, 1x, 2x).

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-20 | [`43f6716`](https://github.com/Doritozz05/Cubeforge/commit/43f6716) | sin clasificar | Add floating cube/times panels and nav views | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/FloatingCubeButton.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · … (12 en total) |
| 2026-07-20 | [`4cc7526`](https://github.com/Doritozz05/Cubeforge/commit/4cc7526) | sin clasificar | fix bugs | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/FloatingCubeButton.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · … (6 en total) |
| 2026-07-20 | [`5812e1c`](https://github.com/Doritozz05/Cubeforge/commit/5812e1c) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-07-20 | [`d37babe`](https://github.com/Doritozz05/Cubeforge/commit/d37babe) | sin clasificar | fixes | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Stats/FloatingTimesPanel.tsx · apps/web/src/index.css |
| 2026-07-20 | [`d81c38f`](https://github.com/Doritozz05/Cubeforge/commit/d81c38f) | sin clasificar | fixes ui | apps/web/src/App.tsx · apps/web/src/components/Settings/sections/AnalysisSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx |
| 2026-07-20 | [`d78733d`](https://github.com/Doritozz05/Cubeforge/commit/d78733d) | sin clasificar | colrs | apps/web/src/components/Stats/SolveAnalysisPanel.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Timer/TimerDisplay.tsx |
| 2026-07-20 | [`338233e`](https://github.com/Doritozz05/Cubeforge/commit/338233e) | sin clasificar | fixes | apps/web/src/components/Cube3D/FloatingCubeButton.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/SmartCubeSection.tsx · apps/web/src/components/Stats/FloatingTimesPanel.tsx · … (10 en total) |
| 2026-07-20 | [`97571b6`](https://github.com/Doritozz05/Cubeforge/commit/97571b6) | sin clasificar | UI refactor | apps/web/src/App.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · … (33 en total) |
| 2026-07-20 | [`4965f62`](https://github.com/Doritozz05/Cubeforge/commit/4965f62) | sin clasificar | fixes | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Stats/TimesList.tsx |
| 2026-07-20 | [`bcc8049`](https://github.com/Doritozz05/Cubeforge/commit/bcc8049) | sin clasificar | fixes | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-07-20 | [`6de71a2`](https://github.com/Doritozz05/Cubeforge/commit/6de71a2) | sin clasificar | Update LeftSidebar.tsx | apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-07-20 | [`003bad2`](https://github.com/Doritozz05/Cubeforge/commit/003bad2) | sin clasificar | Update InsightsDashboard.tsx | apps/web/src/components/Insights/InsightsDashboard.tsx |
| 2026-07-20 | [`0f86a25`](https://github.com/Doritozz05/Cubeforge/commit/0f86a25) | sin clasificar | Update TimesList.tsx | apps/web/src/components/Stats/TimesList.tsx |
| 2026-07-20 | [`59534da`](https://github.com/Doritozz05/Cubeforge/commit/59534da) | sin clasificar | ui | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/utils/seedDemoData.ts · packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts · … (5 en total) |
| 2026-07-20 | [`2430e83`](https://github.com/Doritozz05/Cubeforge/commit/2430e83) | sin clasificar | fixes | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Insights/atoms/MetricRing.tsx · … (7 en total) |
| 2026-07-20 | [`5a13dcd`](https://github.com/Doritozz05/Cubeforge/commit/5a13dcd) | sin clasificar | fix graph | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/src/utils/__tests__/insights.test.ts · apps/web/src/utils/insights.ts · … (5 en total) |
| 2026-07-20 | [`0e4aa7f`](https://github.com/Doritozz05/Cubeforge/commit/0e4aa7f) | sin clasificar | fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/utils/insights.ts |
| 2026-07-20 | [`9ee7185`](https://github.com/Doritozz05/Cubeforge/commit/9ee7185) | sin clasificar | fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/utils/insights.ts |
| 2026-07-20 | [`b155b0a`](https://github.com/Doritozz05/Cubeforge/commit/b155b0a) | sin clasificar | Update insights.ts | apps/web/src/utils/insights.ts |
| 2026-07-20 | [`0a69809`](https://github.com/Doritozz05/Cubeforge/commit/0a69809) | sin clasificar | Update seedDemoData.ts | apps/web/src/utils/seedDemoData.ts |
| 2026-07-20 | [`5b22de5`](https://github.com/Doritozz05/Cubeforge/commit/5b22de5) | sin clasificar | fixes | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/index.css |
| 2026-07-20 | [`bb13604`](https://github.com/Doritozz05/Cubeforge/commit/bb13604) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-07-20 | [`2a2b3b8`](https://github.com/Doritozz05/Cubeforge/commit/2a2b3b8) | sin clasificar | fixes | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Insights/atoms/MetricRing.tsx · apps/web/src/components/ui/scroll-area.tsx · … (5 en total) |
| 2026-07-20 | [`2853e27`](https://github.com/Doritozz05/Cubeforge/commit/2853e27) | sin clasificar | fixes | apps/web/src/components/Insights/atoms/Sparkline.tsx · apps/web/src/components/Stats/TrendChart.tsx |
| 2026-07-20 | [`7ab82de`](https://github.com/Doritozz05/Cubeforge/commit/7ab82de) | sin clasificar | fix ui | apps/web/src/components/Cube3D/FloatingCubeButton.tsx · apps/web/src/components/Stats/FloatingTimesPanel.tsx · apps/web/src/components/Stats/ManualSolveSheet.tsx |
| 2026-07-20 | [`386ac3c`](https://github.com/Doritozz05/Cubeforge/commit/386ac3c) | sin clasificar | replays | apps/web/src/App.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Stats/FloatingTimesPanel.tsx · … (7 en total) |
| 2026-07-20 | [`94ff3e9`](https://github.com/Doritozz05/Cubeforge/commit/94ff3e9) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/utils/seedDemoData.ts |
| 2026-07-20 | [`0f763fd`](https://github.com/Doritozz05/Cubeforge/commit/0f763fd) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-20 | [`be27875`](https://github.com/Doritozz05/Cubeforge/commit/be27875) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/utils/insights.ts |

### v0.2.9 — Solve History & Quick Stats Panel / Historial de solves y panel de stats — 2026-07-20 → 2026-07-20 — 0 commits

**Resumen:** Panel flotante de historial con acciones de penalización, estadísticas de sesión (Ao5, Ao12) y borrado.

**Destacados:**
- Solve history list with single-click +2 and DNF penalty toggles.
- Live calculation of Rolling Average of 5 (Ao5) and Average of 12 (Ao12) according to WCA regulations.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.3.0 — Cube Skins & Texture Studio / Skins de cubo y estudio de texturas — 2026-07-21 → 2026-07-21 — 84 commits

**Resumen:** Skins visuales personalizadas en 3D, materiales mate y brillantes y presets de iluminación.

**Destacados:**
- Cube Skins system supporting classic, pastel, carbon fiber, and dark fluorescent sticker palettes.
- PBR material shaders with adjustable roughness, bevel rounding, and subtle specular reflections.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-21 | [`9757d47`](https://github.com/Doritozz05/Cubeforge/commit/9757d47) | sin clasificar | fix replay | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Stats/ManualSolveSheet.tsx · apps/web/src/index.css · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-07-21 | [`ec0e24a`](https://github.com/Doritozz05/Cubeforge/commit/ec0e24a) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/index.css · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-07-21 | [`3ffea96`](https://github.com/Doritozz05/Cubeforge/commit/3ffea96) | sin clasificar | fix | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Stats/ManualSolveSheet.tsx |
| 2026-07-21 | [`1e8329b`](https://github.com/Doritozz05/Cubeforge/commit/1e8329b) | sin clasificar | Update index.css | apps/web/src/index.css |
| 2026-07-21 | [`e5fcfd1`](https://github.com/Doritozz05/Cubeforge/commit/e5fcfd1) | sin clasificar | Update index.css | apps/web/src/index.css |
| 2026-07-21 | [`75b24fa`](https://github.com/Doritozz05/Cubeforge/commit/75b24fa) | sin clasificar | animation | packages/cube-3d-engine/src/animation/Easing.ts · packages/cube-3d-engine/src/animation/RotationEngine.ts · packages/cube-3d-engine/src/hardware/SyncBridge.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts |
| 2026-07-21 | [`b639ec1`](https://github.com/Doritozz05/Cubeforge/commit/b639ec1) | sin clasificar | Update Header.tsx | apps/web/src/components/Layout/Header.tsx |
| 2026-07-21 | [`0822f56`](https://github.com/Doritozz05/Cubeforge/commit/0822f56) | sin clasificar | replay gyro | apps/web/src/App.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/hooks/useSolveSession.ts · … (13 en total) |
| 2026-07-21 | [`32d04a4`](https://github.com/Doritozz05/Cubeforge/commit/32d04a4) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-07-21 | [`0cb2e51`](https://github.com/Doritozz05/Cubeforge/commit/0cb2e51) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-07-21 | [`767d282`](https://github.com/Doritozz05/Cubeforge/commit/767d282) | sin clasificar | fixes | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/src/utils/seedDemoData.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-07-21 | [`a6e79f2`](https://github.com/Doritozz05/Cubeforge/commit/a6e79f2) | sin clasificar | fixes | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/utils/seedDemoData.ts |
| 2026-07-21 | [`168d6ef`](https://github.com/Doritozz05/Cubeforge/commit/168d6ef) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-07-21 | [`927c1f7`](https://github.com/Doritozz05/Cubeforge/commit/927c1f7) | sin clasificar | hardware | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Settings/sections/SmartCubeSection.tsx · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-21 | [`b79f2ee`](https://github.com/Doritozz05/Cubeforge/commit/b79f2ee) | sin clasificar | Update useScrambleValidator.ts | apps/web/src/hooks/useScrambleValidator.ts |
| 2026-07-21 | [`bdd4a10`](https://github.com/Doritozz05/Cubeforge/commit/bdd4a10) | sin clasificar | fix | apps/web/src/components/Hardware/CubeConnector.tsx · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-21 | [`2e46970`](https://github.com/Doritozz05/Cubeforge/commit/2e46970) | sin clasificar | Update TimerDisplay.tsx | apps/web/src/components/Timer/TimerDisplay.tsx |
| 2026-07-21 | [`2a0c5dc`](https://github.com/Doritozz05/Cubeforge/commit/2a0c5dc) | sin clasificar | fix | apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/src/hardware/SyncBridge.ts |
| 2026-07-21 | [`ab00de3`](https://github.com/Doritozz05/Cubeforge/commit/ab00de3) | sin clasificar | fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Layout/sidebar.constants.ts |
| 2026-07-21 | [`bd5fdbf`](https://github.com/Doritozz05/Cubeforge/commit/bd5fdbf) | sin clasificar | Update sidebar.constants.ts | apps/web/src/components/Layout/sidebar.constants.ts |
| 2026-07-21 | [`20538d5`](https://github.com/Doritozz05/Cubeforge/commit/20538d5) | sin clasificar | Update useStatsFilters.ts | apps/web/src/hooks/useStatsFilters.ts |
| 2026-07-21 | [`b5b2936`](https://github.com/Doritozz05/Cubeforge/commit/b5b2936) | sin clasificar | arreglos provisionales | apps/web/src/App.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/vite.config.ts · … (9 en total) |
| 2026-07-21 | [`c34cfc2`](https://github.com/Doritozz05/Cubeforge/commit/c34cfc2) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/hooks/useSolveSession.ts · packages/analysis-engine/src/timeline/TimelineBuilder.ts |
| 2026-07-21 | [`350af08`](https://github.com/Doritozz05/Cubeforge/commit/350af08) | sin clasificar | Update MainLayout.tsx | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-21 | [`6bd5809`](https://github.com/Doritozz05/Cubeforge/commit/6bd5809) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/hooks/useSolveSession.ts |
| 2026-07-21 | [`d692d5b`](https://github.com/Doritozz05/Cubeforge/commit/d692d5b) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/atoms/MetricRing.tsx · apps/web/src/hooks/usePersistentSession.ts · … (8 en total) |
| 2026-07-21 | [`882e365`](https://github.com/Doritozz05/Cubeforge/commit/882e365) | sin clasificar | fixes | apps/web/src/utils/__tests__/insights.test.ts · packages/database/src/worker.ts |
| 2026-07-21 | [`b998623`](https://github.com/Doritozz05/Cubeforge/commit/b998623) | sin clasificar | fixes db | apps/web/public/sqlite3-opfs-async-proxy.js · apps/web/public/sqlite3.wasm · apps/web/vite.config.ts · packages/database/src/worker.ts |
| 2026-07-21 | [`30aa9cd`](https://github.com/Doritozz05/Cubeforge/commit/30aa9cd) | sin clasificar | fix | apps/web/public/sqlite3-opfs-async-proxy.js · apps/web/public/sqlite3.wasm · apps/web/src/App.tsx · apps/web/src/components/Insights/ReplaySection.tsx · … (7 en total) |
| 2026-07-21 | [`c2e85e2`](https://github.com/Doritozz05/Cubeforge/commit/c2e85e2) | sin clasificar | fix camera | apps/web/src/components/Insights/ReplaySection.tsx · packages/cube-3d-engine/src/core/SceneManager.ts · packages/cube-3d-engine/src/workers/EngineWorker.ts |
| 2026-07-21 | [`35874dc`](https://github.com/Doritozz05/Cubeforge/commit/35874dc) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-07-21 | [`70aa1a3`](https://github.com/Doritozz05/Cubeforge/commit/70aa1a3) | sin clasificar | progress | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Stats/SolveProgressionChart.tsx |
| 2026-07-21 | [`2c3c17e`](https://github.com/Doritozz05/Cubeforge/commit/2c3c17e) | sin clasificar | Update SolveProgressionChart.tsx | apps/web/src/components/Stats/SolveProgressionChart.tsx |
| 2026-07-21 | [`60e1534`](https://github.com/Doritozz05/Cubeforge/commit/60e1534) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/hooks/usePersistentSession.ts |
| 2026-07-21 | [`0fed273`](https://github.com/Doritozz05/Cubeforge/commit/0fed273) | sin clasificar | Update OverviewPanel.tsx | apps/web/src/components/Insights/OverviewPanel.tsx |
| 2026-07-21 | [`b3409b4`](https://github.com/Doritozz05/Cubeforge/commit/b3409b4) | sin clasificar | Update useSolveSession.ts | apps/web/src/hooks/useSolveSession.ts |
| 2026-07-21 | [`88fef59`](https://github.com/Doritozz05/Cubeforge/commit/88fef59) | sin clasificar | limpieza | apps/web/package.json · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · … (7 en total) |
| 2026-07-21 | [`25d3d3f`](https://github.com/Doritozz05/Cubeforge/commit/25d3d3f) | sin clasificar | fixes | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Stats/SolveProgressionChart.tsx · packages/ui/tsconfig.json · tsconfig.json |
| 2026-07-21 | [`74aa658`](https://github.com/Doritozz05/Cubeforge/commit/74aa658) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-07-21 | [`c56766a`](https://github.com/Doritozz05/Cubeforge/commit/c56766a) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-07-21 | [`fbd66f9`](https://github.com/Doritozz05/Cubeforge/commit/fbd66f9) | sin clasificar | Update SolveListPanel.tsx | apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-07-21 | [`716b22a`](https://github.com/Doritozz05/Cubeforge/commit/716b22a) | sin clasificar | Update SolveProgressionChart.tsx | apps/web/src/components/Stats/SolveProgressionChart.tsx |
| 2026-07-21 | [`b5b5e45`](https://github.com/Doritozz05/Cubeforge/commit/b5b5e45) | sin clasificar | fix | apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Stats/SolveProgressionChart.tsx · apps/web/src/components/Stats/TrendChart.tsx |
| 2026-07-21 | [`a165bae`](https://github.com/Doritozz05/Cubeforge/commit/a165bae) | sin clasificar | charts new | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-07-21 | [`100331f`](https://github.com/Doritozz05/Cubeforge/commit/100331f) | sin clasificar | limpieza | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Stats/TrendChart.tsx |
| 2026-07-21 | [`c7c833f`](https://github.com/Doritozz05/Cubeforge/commit/c7c833f) | sin clasificar | focus | apps/web/src/App.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · packages/state/src/store.ts |
| 2026-07-21 | [`551438b`](https://github.com/Doritozz05/Cubeforge/commit/551438b) | sin clasificar | settings | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/components/Settings/sections/ScrambleSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · … (6 en total) |
| 2026-07-21 | [`ffeea1e`](https://github.com/Doritozz05/Cubeforge/commit/ffeea1e) | sin clasificar | skins | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/components/Settings/settings.constants.ts · packages/cube-3d-engine/src/core/CubeMeshFactory.ts · … (6 en total) |
| 2026-07-21 | [`9437146`](https://github.com/Doritozz05/Cubeforge/commit/9437146) | sin clasificar | Update SceneManager.ts | packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-07-21 | [`9fdbb90`](https://github.com/Doritozz05/Cubeforge/commit/9fdbb90) | sin clasificar | skins | packages/cube-3d-engine/src/core/CubeMeshFactory.ts · packages/cube-3d-engine/src/styles/cubeSkins.ts |
| 2026-07-21 | [`66fcfc9`](https://github.com/Doritozz05/Cubeforge/commit/66fcfc9) | sin clasificar | skins fix | packages/cube-3d-engine/src/core/CubeMeshFactory.ts · packages/cube-3d-engine/src/styles/cubeSkins.ts |
| 2026-07-21 | [`7a6a4d0`](https://github.com/Doritozz05/Cubeforge/commit/7a6a4d0) | sin clasificar | skins | apps/web/src/components/Insights/ReplaySection.tsx · packages/cube-3d-engine/src/styles/cubeSkins.ts |
| 2026-07-21 | [`0b23546`](https://github.com/Doritozz05/Cubeforge/commit/0b23546) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-21 | [`5a88def`](https://github.com/Doritozz05/Cubeforge/commit/5a88def) | sin clasificar | Update CubeMeshFactory.ts | packages/cube-3d-engine/src/core/CubeMeshFactory.ts |
| 2026-07-21 | [`65534e0`](https://github.com/Doritozz05/Cubeforge/commit/65534e0) | sin clasificar | battery | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Layout/Header.tsx · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-21 | [`03ff73e`](https://github.com/Doritozz05/Cubeforge/commit/03ff73e) | sin clasificar | Animation | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-07-21 | [`eb7ddef`](https://github.com/Doritozz05/Cubeforge/commit/eb7ddef) | sin clasificar | settigns fix | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · apps/web/src/components/Settings/sections/ScrambleSection.tsx · … (5 en total) |
| 2026-07-21 | [`7fee88a`](https://github.com/Doritozz05/Cubeforge/commit/7fee88a) | sin clasificar | Voice | apps/web/src/App.tsx |
| 2026-07-21 | [`df820b8`](https://github.com/Doritozz05/Cubeforge/commit/df820b8) | sin clasificar | Update App.tsx | apps/web/src/App.tsx |
| 2026-07-21 | [`072662f`](https://github.com/Doritozz05/Cubeforge/commit/072662f) | sin clasificar | speech api | apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/src/utils/audioSystem.ts · packages/state/src/store.ts |
| 2026-07-21 | [`12c58be`](https://github.com/Doritozz05/Cubeforge/commit/12c58be) | sin clasificar | fix dnf | apps/web/src/App.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Timer/TimerDisplay.tsx · apps/web/src/hooks/usePersistentSession.ts · … (7 en total) |
| 2026-07-21 | [`762970a`](https://github.com/Doritozz05/Cubeforge/commit/762970a) | sin clasificar | fixes | apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Settings/sections/SmartCubeSection.tsx · apps/web/src/components/Stats/FloatingTimesPanel.tsx · apps/web/src/hooks/useStatsFilters.ts · … (5 en total) |
| 2026-07-21 | [`55c6558`](https://github.com/Doritozz05/Cubeforge/commit/55c6558) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Timer/TimerContainer.tsx · … (6 en total) |
| 2026-07-21 | [`8937c78`](https://github.com/Doritozz05/Cubeforge/commit/8937c78) | sin clasificar | Update App.tsx | apps/web/src/App.tsx |
| 2026-07-21 | [`f6424f6`](https://github.com/Doritozz05/Cubeforge/commit/f6424f6) | sin clasificar | draw scramble | apps/web/src/App.tsx · apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx |
| 2026-07-21 | [`d01df07`](https://github.com/Doritozz05/Cubeforge/commit/d01df07) | sin clasificar | fixes | apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx |
| 2026-07-21 | [`8c07d26`](https://github.com/Doritozz05/Cubeforge/commit/8c07d26) | sin clasificar | Update FloatingCube2DPanel.tsx | apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx |
| 2026-07-21 | [`870cd2c`](https://github.com/Doritozz05/Cubeforge/commit/870cd2c) | sin clasificar | Update FloatingCube2DPanel.tsx | apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx |
| 2026-07-21 | [`10057da`](https://github.com/Doritozz05/Cubeforge/commit/10057da) | sin clasificar | Update FloatingCube2DPanel.tsx | apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx |
| 2026-07-21 | [`5a281f7`](https://github.com/Doritozz05/Cubeforge/commit/5a281f7) | sin clasificar | Update Cube3DPanel.tsx | apps/web/src/components/Cube3D/Cube3DPanel.tsx |
| 2026-07-21 | [`8d29043`](https://github.com/Doritozz05/Cubeforge/commit/8d29043) | sin clasificar | widgets | apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/components/WidgetExplorer/WidgetCard.tsx · … (12 en total) |
| 2026-07-21 | [`bc9bb8f`](https://github.com/Doritozz05/Cubeforge/commit/bc9bb8f) | sin clasificar | fixes | apps/web/src/components/WidgetExplorer/WidgetCard.tsx · apps/web/src/components/WidgetExplorer/WidgetExplorer.tsx · apps/web/src/components/WidgetExplorer/WidgetPreviews.tsx · apps/web/src/widgets/registry.ts |
| 2026-07-21 | [`01dc922`](https://github.com/Doritozz05/Cubeforge/commit/01dc922) | sin clasificar | widget fix | apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx · apps/web/src/components/WidgetExplorer/WidgetPreviews.tsx · apps/web/src/widgets/registry.ts |
| 2026-07-21 | [`bbef387`](https://github.com/Doritozz05/Cubeforge/commit/bbef387) | sin clasificar | Update SolveProgressionChart.tsx | apps/web/src/components/Stats/SolveProgressionChart.tsx |
| 2026-07-21 | [`0b3064f`](https://github.com/Doritozz05/Cubeforge/commit/0b3064f) | sin clasificar | widgets | apps/web/src/App.tsx · apps/web/src/components/Stats/FloatingPbProgression.tsx · apps/web/src/components/Stats/FloatingPhaseTimeline.tsx · apps/web/src/components/Stats/FloatingTimeDistribution.tsx · … (7 en total) |
| 2026-07-21 | [`61d1c5b`](https://github.com/Doritozz05/Cubeforge/commit/61d1c5b) | sin clasificar | fixes | apps/web/src/components/Stats/FloatingPhaseTimeline.tsx · apps/web/src/components/WidgetExplorer/WidgetPreviews.tsx |
| 2026-07-21 | [`bd0dac5`](https://github.com/Doritozz05/Cubeforge/commit/bd0dac5) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/src/utils/insights.ts |
| 2026-07-21 | [`c3655e3`](https://github.com/Doritozz05/Cubeforge/commit/c3655e3) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/hooks/useSolveSession.ts |
| 2026-07-21 | [`476fa34`](https://github.com/Doritozz05/Cubeforge/commit/476fa34) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-07-21 | [`82ba700`](https://github.com/Doritozz05/Cubeforge/commit/82ba700) | sin clasificar | Update Header.tsx | apps/web/src/components/Layout/Header.tsx |
| 2026-07-21 | [`8f984cf`](https://github.com/Doritozz05/Cubeforge/commit/8f984cf) | sin clasificar | widget refactor | apps/web/src/App.tsx · apps/web/src/components/Cube3D/FloatingCube2DPanel.tsx · apps/web/src/components/Cube3D/FloatingCubeButton.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · … (38 en total) |
| 2026-07-21 | [`5c68c14`](https://github.com/Doritozz05/Cubeforge/commit/5c68c14) | sin clasificar | fix | apps/web/src/components/Cube3D/FloatingCubeButton.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/previews/TimeDistributionPreview.tsx · apps/web/src/widgets/widgetStore.ts |
| 2026-07-21 | [`824f9be`](https://github.com/Doritozz05/Cubeforge/commit/824f9be) | sin clasificar | widget community | apps/web/src/App.tsx · apps/web/src/widgets/WidgetHostProps.ts · apps/web/src/widgets/WidgetRegistry.ts · apps/web/src/widgets/explorer/WidgetExplorer.tsx · … (32 en total) |
| 2026-07-21 | [`a377df2`](https://github.com/Doritozz05/Cubeforge/commit/a377df2) | sin clasificar | fixes | apps/web/src/widgets/registerAllWidgets.ts · apps/web/src/widgets/sdk/HostAPI.ts |

### v0.3.1 — 3D Diagram Generator / Generador de diagramas 3D — 2026-07-21 → 2026-07-21 — 0 commits

**Resumen:** Generación de diagramas 3D en alta resolución para previsualización de algoritmos y tarjetas de práctica.

**Destacados:**
- 3D Case Diagram Factory rendering top-down and perspective case snapshots with custom maskings.
- Dynamic sticker masking highlighting only relevant pieces for F2L, OLL and PLL cases.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.3.2 — Algorithm Database Modeling / Modelado de base de algoritmos — 2026-07-22 → 2026-07-22 — 10 commits

**Resumen:** Catálogo completo de algoritmos CFOP con triggers alternativos, normalizador AUF y recuento de giros.

**Destacados:**
- Comprehensive algorithm database covering all 57 OLL cases and 21 PLL cases with alternative fingertrick triggers.
- AUF (Adjust Upper Face) normalizer standardizing algorithm execution notation.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-22 | [`ab77ce0`](https://github.com/Doritozz05/Cubeforge/commit/ab77ce0) | sin clasificar | fix | apps/web/src/components/Layout/Header.tsx · apps/web/src/hooks/useDraggable.ts · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · … (10 en total) |
| 2026-07-22 | [`9b41258`](https://github.com/Doritozz05/Cubeforge/commit/9b41258) | sin clasificar | fix | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/explorer/WidgetHost.tsx |
| 2026-07-22 | [`5b491ff`](https://github.com/Doritozz05/Cubeforge/commit/5b491ff) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-22 | [`f41f042`](https://github.com/Doritozz05/Cubeforge/commit/f41f042) | sin clasificar | Delete PhaseRow.tsx | apps/web/src/components/Stats/atoms/PhaseRow.tsx |
| 2026-07-22 | [`ac5848d`](https://github.com/Doritozz05/Cubeforge/commit/ac5848d) | sin clasificar | Update SolveListPanel.tsx | apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-07-22 | [`c95d276`](https://github.com/Doritozz05/Cubeforge/commit/c95d276) | sin clasificar | Update TimesList.tsx | apps/web/src/components/Stats/TimesList.tsx |
| 2026-07-22 | [`c1d374d`](https://github.com/Doritozz05/Cubeforge/commit/c1d374d) | sin clasificar | tooltips | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · … (16 en total) |
| 2026-07-22 | [`9a7a939`](https://github.com/Doritozz05/Cubeforge/commit/9a7a939) | sin clasificar | fix | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/views/Practice/PracticeDashboard.tsx · … (16 en total) |
| 2026-07-22 | [`77a20cb`](https://github.com/Doritozz05/Cubeforge/commit/77a20cb) | sin clasificar | fix | apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/views/Practice/PracticeDashboard.tsx |
| 2026-07-22 | [`4efe174`](https://github.com/Doritozz05/Cubeforge/commit/4efe174) | sin clasificar | Create test-moves.mjs | test-moves.mjs |

### v0.3.3 — Cross Trainer & Optimal Solver / Entrenador de cruz y solver óptimo — 2026-07-23 → 2026-07-23 — 32 commits

**Resumen:** Entrenador de Cruz dedicado que genera mezclas específicas con soluciones óptimas paso a paso.

**Destacados:**
- Cross Trainer with move-distance difficulty filters (2 to 8 optimal moves).
- Optimal cross solver showing all shortest paths across any chosen starting color.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-23 | [`3606816`](https://github.com/Doritozz05/Cubeforge/commit/3606816) | sin clasificar | pll broken | apps/web/src/components/Stats/TimesList.tsx · apps/web/src/views/Practice/PracticeDashboard.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/views/Practice/components/CaseDiagram.tsx · … (33 en total) |
| 2026-07-23 | [`66c3ae9`](https://github.com/Doritozz05/Cubeforge/commit/66c3ae9) | sin clasificar | fixes | apps/web/src/views/Practice/components/CaseDiagram.tsx · packages/algorithm-db/src/__tests__/caseGenerator.test.ts · packages/algorithm-db/src/caseGenerator.ts · packages/algorithm-db/src/seed/cfop-pll.ts |
| 2026-07-23 | [`94399d0`](https://github.com/Doritozz05/Cubeforge/commit/94399d0) | sin clasificar | fixes | packages/algorithm-db/src/__tests__/caseGenerator.test.ts · packages/algorithm-db/src/caseGenerator.ts · packages/algorithm-db/src/seed/cfop-oll.ts · packages/config-typescript/tsconfig.base.json · … (7 en total) |
| 2026-07-23 | [`29d2b3a`](https://github.com/Doritozz05/Cubeforge/commit/29d2b3a) | sin clasificar | fixes | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/views/Practice/components/CaseDiagram.tsx · apps/web/src/widgets/explorer/WidgetHost.tsx · apps/web/src/widgets/widgetStore.ts · … (16 en total) |
| 2026-07-23 | [`00fea17`](https://github.com/Doritozz05/Cubeforge/commit/00fea17) | sin clasificar | fixes | apps/web/src/widgets/widgetStore.ts · cross-test.ts · diagnose-all-cases.ts · diagnose-final.ts · … (16 en total) |
| 2026-07-23 | [`c2fb050`](https://github.com/Doritozz05/Cubeforge/commit/c2fb050) | sin clasificar | Update CaseDiagram.tsx | apps/web/src/views/Practice/components/CaseDiagram.tsx |
| 2026-07-23 | [`1599045`](https://github.com/Doritozz05/Cubeforge/commit/1599045) | sin clasificar | Update cfop-pll.ts | packages/algorithm-db/src/seed/cfop-pll.ts |
| 2026-07-23 | [`fd34d59`](https://github.com/Doritozz05/Cubeforge/commit/fd34d59) | sin clasificar | fix | packages/algorithm-db/src/__tests__/caseGenerator.test.ts · packages/algorithm-db/src/caseGenerator.ts |
| 2026-07-23 | [`f92668e`](https://github.com/Doritozz05/Cubeforge/commit/f92668e) | sin clasificar | Update .gitignore | .gitignore |
| 2026-07-23 | [`aed2675`](https://github.com/Doritozz05/Cubeforge/commit/aed2675) | sin clasificar | fixes PLL | packages/algorithm-db/src/__tests__/pll-speedcubedb-comparison.test.ts · packages/algorithm-db/src/seed/cfop-pll.ts |
| 2026-07-23 | [`bb07bb9`](https://github.com/Doritozz05/Cubeforge/commit/bb07bb9) | sin clasificar | Update cfop-pll.ts | packages/algorithm-db/src/seed/cfop-pll.ts |
| 2026-07-23 | [`2031303`](https://github.com/Doritozz05/Cubeforge/commit/2031303) | sin clasificar | fixes | apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/views/Practice/components/CaseDiagram.tsx · apps/web/src/views/Practice/components/CaseGrid.tsx · packages/algorithm-db/src/__tests__/pll-speedcubedb-comparison.test.ts · … (5 en total) |
| 2026-07-23 | [`6e376f7`](https://github.com/Doritozz05/Cubeforge/commit/6e376f7) | sin clasificar | fix | packages/algorithm-db/src/__tests__/oll-speedcubedb-comparison.test.ts · packages/math-core/src/CubeState.ts · packages/math-core/src/__tests__/CubeState.extendedMoves.test.ts · scripts/debug-oll5.ts |
| 2026-07-23 | [`28f123e`](https://github.com/Doritozz05/Cubeforge/commit/28f123e) | sin clasificar | Update cfop-oll.ts | packages/algorithm-db/src/seed/cfop-oll.ts |
| 2026-07-23 | [`8bb92f6`](https://github.com/Doritozz05/Cubeforge/commit/8bb92f6) | fix | fix: auto-calibrate green face on connect without extra rotation events | .gitignore · apps/web/src/components/Cube3D/Cube3DPanel.tsx · packages/cube-3d-engine/src/__tests__/GyroFusion.test.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts · … (7 en total) |
| 2026-07-23 | [`2dd2951`](https://github.com/Doritozz05/Cubeforge/commit/2dd2951) | docs | Create README.md | docs/plan_training/README.md |
| 2026-07-23 | [`2b838f3`](https://github.com/Doritozz05/Cubeforge/commit/2b838f3) | sin clasificar | tauri | .gitignore · apps/desktop/.gitignore · apps/desktop/index.html · apps/desktop/package.json · … (32 en total) |
| 2026-07-23 | [`25d9317`](https://github.com/Doritozz05/Cubeforge/commit/25d9317) | sin clasificar | tauri | apps/desktop/package.json · apps/desktop/postcss.config.js · apps/desktop/src-tauri/Cargo.lock · apps/desktop/src-tauri/Cargo.toml · … (26 en total) |
| 2026-07-23 | [`b96778a`](https://github.com/Doritozz05/Cubeforge/commit/b96778a) | sin clasificar | fix tauri | apps/desktop/src-tauri/src/ble/cube.rs · apps/desktop/src-tauri/src/lib.rs · apps/desktop/src-tauri/src/main.rs · apps/desktop/src/adapters/GanCubeAdapterTauri.ts |
| 2026-07-23 | [`a83f592`](https://github.com/Doritozz05/Cubeforge/commit/a83f592) | sin clasificar | fixes | apps/desktop/src/adapters/GanCubeAdapterTauri.ts · packages/hardware-hal/src/index.ts |
| 2026-07-23 | [`bf6dc45`](https://github.com/Doritozz05/Cubeforge/commit/bf6dc45) | sin clasificar | fixes | apps/desktop/index.html · apps/desktop/src-tauri/tauri.conf.json · apps/desktop/src/main.tsx |
| 2026-07-23 | [`dfc4dd1`](https://github.com/Doritozz05/Cubeforge/commit/dfc4dd1) | sin clasificar | devtools | apps/desktop/src-tauri/Cargo.toml · apps/desktop/src-tauri/src/lib.rs |
| 2026-07-23 | [`5fbcbfe`](https://github.com/Doritozz05/Cubeforge/commit/5fbcbfe) | sin clasificar | database | apps/desktop/package.json · apps/desktop/src-tauri/Cargo.lock · apps/desktop/src-tauri/Cargo.toml · apps/desktop/src-tauri/capabilities/default.json · … (12 en total) |
| 2026-07-23 | [`1541904`](https://github.com/Doritozz05/Cubeforge/commit/1541904) | sin clasificar | gancube tauri | apps/desktop/src-tauri/src/ble/mod.rs · apps/desktop/src-tauri/src/ble/timer.rs · apps/desktop/src-tauri/src/lib.rs · apps/desktop/src-tauri/src/state.rs · … (6 en total) |
| 2026-07-23 | [`4d2f4f1`](https://github.com/Doritozz05/Cubeforge/commit/4d2f4f1) | sin clasificar | Update CubeConnector.tsx | apps/web/src/components/Hardware/CubeConnector.tsx |
| 2026-07-23 | [`15b328b`](https://github.com/Doritozz05/Cubeforge/commit/15b328b) | docs | Create TRAINING_SYSTEM_v2.md | docs/plan_training/TRAINING_SYSTEM_v2.md |
| 2026-07-23 | [`34141e7`](https://github.com/Doritozz05/Cubeforge/commit/34141e7) | sin clasificar | fase 1 ui | apps/web/src/App.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-23 | [`9be1ed4`](https://github.com/Doritozz05/Cubeforge/commit/9be1ed4) | sin clasificar | fase 2 | apps/web/src/views/Training/TrainingDashboard.tsx · docs/plan_training/README.md |
| 2026-07-23 | [`1c01080`](https://github.com/Doritozz05/Cubeforge/commit/1c01080) | sin clasificar | l3 drill | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-23 | [`d65a386`](https://github.com/Doritozz05/Cubeforge/commit/d65a386) | sin clasificar | cross | apps/web/src/views/Training/PhaseTrainerView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-23 | [`6780d14`](https://github.com/Doritozz05/Cubeforge/commit/6780d14) | sin clasificar | recall ui | apps/web/src/views/Training/AlgorithmRecallView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-23 | [`f5c8058`](https://github.com/Doritozz05/Cubeforge/commit/f5c8058) | sin clasificar | stats and fullsolve | apps/web/src/views/Training/FullSolveView.tsx · apps/web/src/views/Training/PhaseStatsView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |

### v0.3.4 — Training Engine Architecture / Arquitectura del motor de entrenamiento — 2026-07-23 → 2026-07-23 — 0 commits

**Resumen:** Paquete de motor de entrenamiento que gestiona sesiones de drill, tiempos de reacción y precisión.

**Destacados:**
- Headless training state machine coordinating drills, recognition challenges and timing.
- Reaction time measurement isolating recognition pause from algorithm execution.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.3.5 — Algorithm Drills & Flash Recall / Drills de algoritmos y recuerdo rápido — 2026-07-24 → 2026-07-24 — 27 commits

**Resumen:** Modo de práctica con tarjetas interactivas para poner a prueba el recuerdo rápido bajo presión.

**Destacados:**
- Flash Recall mode presenting scrambled cases with instant pass/fail validation.
- Execution speed tracking comparing personal best drill times against community benchmarks.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-24 | [`c8ef30d`](https://github.com/Doritozz05/Cubeforge/commit/c8ef30d) | sin clasificar | algorithms training | apps/web/src/App.tsx · apps/web/src/views/Practice/PracticeDashboard.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-24 | [`ff2f51c`](https://github.com/Doritozz05/Cubeforge/commit/ff2f51c) | sin clasificar | Update TrainingDashboard.tsx | apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-24 | [`e38542c`](https://github.com/Doritozz05/Cubeforge/commit/e38542c) | sin clasificar | icon | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecallView.tsx |
| 2026-07-24 | [`3fa2d64`](https://github.com/Doritozz05/Cubeforge/commit/3fa2d64) | sin clasificar | oll drill | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecallView.tsx |
| 2026-07-24 | [`cd710f7`](https://github.com/Doritozz05/Cubeforge/commit/cd710f7) | sin clasificar | Update TrainingDashboard.tsx | apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-24 | [`4f1a5da`](https://github.com/Doritozz05/Cubeforge/commit/4f1a5da) | sin clasificar | calendar | apps/web/src/views/Training/TrainingCalendar.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-24 | [`e8c529f`](https://github.com/Doritozz05/Cubeforge/commit/e8c529f) | sin clasificar | drill implementation fixes | apps/web/src/App.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Timer/TimerDisplay.tsx · apps/web/src/hooks/useDrillTimer.ts · … (7 en total) |
| 2026-07-24 | [`c38884d`](https://github.com/Doritozz05/Cubeforge/commit/c38884d) | docs | Create SmartCube_Drill_Integration_Plan.md | docs/14-ai/SmartCube_Drill_Integration_Plan.md |
| 2026-07-24 | [`12319fb`](https://github.com/Doritozz05/Cubeforge/commit/12319fb) | sin clasificar | fix | apps/web/src/hooks/useDrillSmartCube.ts · apps/web/src/hooks/useDrillTimer.ts · apps/web/src/views/Training/AlgorithmDrillView.tsx |
| 2026-07-24 | [`e28d4fe`](https://github.com/Doritozz05/Cubeforge/commit/e28d4fe) | sin clasificar | Update AlgorithmDrillView.tsx | apps/web/src/views/Training/AlgorithmDrillView.tsx |
| 2026-07-24 | [`2d67699`](https://github.com/Doritozz05/Cubeforge/commit/2d67699) | sin clasificar | fixes | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/hooks/useCube3DWorker.ts · apps/web/src/hooks/useScrambleValidator.ts · … (6 en total) |
| 2026-07-24 | [`58b4b07`](https://github.com/Doritozz05/Cubeforge/commit/58b4b07) | sin clasificar | drill | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/hooks/useCube3DWorker.ts · apps/web/src/lib/cube3DWorkerSingleton.ts · apps/web/src/lib/training/__tests__/setupGenerator.test.ts · … (7 en total) |
| 2026-07-24 | [`fb620e2`](https://github.com/Doritozz05/Cubeforge/commit/fb620e2) | sin clasificar | fixes | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecallView.tsx · apps/web/src/views/Training/FullSolveView.tsx · apps/web/src/views/Training/PhaseStatsView.tsx · … (6 en total) |
| 2026-07-24 | [`7cb4225`](https://github.com/Doritozz05/Cubeforge/commit/7cb4225) | sin clasificar | fixes | apps/web/src/lib/training/__tests__/setupGenerator.test.ts · apps/web/src/lib/training/setupGenerator.ts · apps/web/src/views/Training/AlgorithmDrillView.tsx · packages/math-core/src/MoveExpander.ts |
| 2026-07-24 | [`1d31756`](https://github.com/Doritozz05/Cubeforge/commit/1d31756) | sin clasificar | fixes | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/hooks/useCube3D.ts · apps/web/src/hooks/useCube3DWorker.ts · … (10 en total) |
| 2026-07-24 | [`3bf482b`](https://github.com/Doritozz05/Cubeforge/commit/3bf482b) | sin clasificar | recall | apps/web/src/views/Training/AlgorithmRecallView.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-24 | [`ce504e9`](https://github.com/Doritozz05/Cubeforge/commit/ce504e9) | sin clasificar | Update PracticeDashboard.tsx | apps/web/src/views/Practice/PracticeDashboard.tsx |
| 2026-07-24 | [`d7fdce5`](https://github.com/Doritozz05/Cubeforge/commit/d7fdce5) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Layout/CubeforgeCommandPalette.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/views/Practice/PracticeDashboard.tsx · … (11 en total) |
| 2026-07-24 | [`c633810`](https://github.com/Doritozz05/Cubeforge/commit/c633810) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Layout/CubeforgeCommandPalette.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Layout/sidebar.constants.ts · … (7 en total) |
| 2026-07-24 | [`a7c3d94`](https://github.com/Doritozz05/Cubeforge/commit/a7c3d94) | sin clasificar | fixes | apps/web/src/components/Layout/CubeforgeCommandPalette.tsx · apps/web/src/views/Practice/PracticeDashboard.tsx · apps/web/src/views/SkillTree/SkillGraphCanvas.tsx |
| 2026-07-24 | [`d397180`](https://github.com/Doritozz05/Cubeforge/commit/d397180) | sin clasificar | fixes | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/SkillNodeModal.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx |
| 2026-07-24 | [`cbd822d`](https://github.com/Doritozz05/Cubeforge/commit/cbd822d) | sin clasificar | skilltree | apps/web/src/components/Layout/CubeforgeCommandPalette.tsx · apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/SkillNodeModal.tsx · apps/web/src/views/SkillTree/UltraSkillTreeView.tsx · … (5 en total) |
| 2026-07-24 | [`a1d9b19`](https://github.com/Doritozz05/Cubeforge/commit/a1d9b19) | sin clasificar | fixes | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/SkillNodeModal.tsx · apps/web/src/views/SkillTree/UltraSkillTreeView.tsx |
| 2026-07-24 | [`7b45b87`](https://github.com/Doritozz05/Cubeforge/commit/7b45b87) | sin clasificar | skilltree | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/UltraSkillTreeView.tsx · apps/web/src/views/SkillTree/skillTreeData.ts |
| 2026-07-24 | [`b32e25e`](https://github.com/Doritozz05/Cubeforge/commit/b32e25e) | sin clasificar | fixes | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/SkillNodeModal.tsx |
| 2026-07-24 | [`2d0beeb`](https://github.com/Doritozz05/Cubeforge/commit/2d0beeb) | sin clasificar | Update skillTreeData.ts | apps/web/src/views/SkillTree/skillTreeData.ts |
| 2026-07-24 | [`cb13d02`](https://github.com/Doritozz05/Cubeforge/commit/cb13d02) | sin clasificar | layout | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/skillTreeData.ts · apps/web/src/views/SkillTree/skillTreeLayout.ts |

### v0.3.6 — Practice Calendar & Habit Tracker / Calendario de práctica y hábitos — 2026-07-24 → 2026-07-24 — 0 commits

**Resumen:** Calendario de hábitos que visualiza la constancia de práctica diaria y el volumen de entrenamiento.

**Destacados:**
- Interactive practice habit calendar highlighting active streak days and solve counts.
- Streak counter encouraging daily consistency with motivational milestone badges.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.3.7 — Skill Tree Graph Canvas / Lienzo del árbol de habilidades — 2026-07-25 → 2026-07-25 — 6 commits

**Resumen:** Grafo interactivo de habilidades con zoom/paneo, 16 ramas de progresión y desbloqueo por prerrequisitos.

**Destacados:**
- UltraSkillTreeView with GPU-accelerated interactive canvas, SVG Bezier connectors, and smooth pan/zoom.
- 16 specialized skill branches covering Fundamentals, Cross, F2L, Last Layer, Lookahead, Finger Tricks and more.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-25 | [`c840992`](https://github.com/Doritozz05/Cubeforge/commit/c840992) | sin clasificar | Update AlgorithmRecognizeView.tsx | apps/web/src/views/Training/AlgorithmRecognizeView.tsx |
| 2026-07-25 | [`fbda71a`](https://github.com/Doritozz05/Cubeforge/commit/fbda71a) | sin clasificar | quickwins | apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/components/ColorPicker.tsx · … (18 en total) |
| 2026-07-25 | [`88bb632`](https://github.com/Doritozz05/Cubeforge/commit/88bb632) | sin clasificar | sentence casing | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Layout/CubeforgeCommandPalette.tsx · apps/web/src/components/ui/command.tsx · … (19 en total) |
| 2026-07-25 | [`8da5c08`](https://github.com/Doritozz05/Cubeforge/commit/8da5c08) | sin clasificar | sentence fixes | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Settings/sections/ScrambleSection.tsx · … (10 en total) |
| 2026-07-25 | [`057db67`](https://github.com/Doritozz05/Cubeforge/commit/057db67) | sin clasificar | fixes | apps/web/src/hooks/usePersistentSession.ts · apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/FullSolveView.tsx · apps/web/src/views/Training/PhaseTrainerView.tsx · … (5 en total) |
| 2026-07-25 | [`292095e`](https://github.com/Doritozz05/Cubeforge/commit/292095e) | sin clasificar | Merge pull request #1 from Doritozz05/refactor | — |

### v0.3.8 — Spaced Repetition (SRS) Engine / Motor de repetición espaciada (SRS) — 2026-07-26 → 2026-07-26 — 26 commits

**Resumen:** Algoritmo de repetición espaciada SM-2 que prioriza algoritmos débiles y olvidados para una retención óptima.

**Destacados:**
- Integrated SM-2 spaced repetition algorithm scheduling reviews based on recall speed and difficulty.
- SRS review queue organizing cases into Overdue, Weak, Due and New categories.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-26 | [`7a08971`](https://github.com/Doritozz05/Cubeforge/commit/7a08971) | sin clasificar | fase 0 | packages/training/eslint.config.js · packages/training/package.json · packages/training/src/index.ts · packages/training/src/types/exercise.ts · … (11 en total) |
| 2026-07-26 | [`3a93702`](https://github.com/Doritozz05/Cubeforge/commit/3a93702) | sin clasificar | fase 1 | apps/web/src/lib/training/setupGenerator.ts · packages/training/package.json · packages/training/src/engine/index.ts · packages/training/src/engine/training-timer.ts · … (12 en total) |
| 2026-07-26 | [`d765a1d`](https://github.com/Doritozz05/Cubeforge/commit/d765a1d) | sin clasificar | fase 3 | apps/web/package.json · apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx · apps/web/src/views/Training/components/StatChip.tsx · … (9 en total) |
| 2026-07-26 | [`66592e1`](https://github.com/Doritozz05/Cubeforge/commit/66592e1) | sin clasificar | fase 3 | apps/web/src/views/Training/PhaseTargetView.tsx · apps/web/src/views/Training/PhaseTrainerView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-26 | [`3f167ba`](https://github.com/Doritozz05/Cubeforge/commit/3f167ba) | sin clasificar | Update FullSolveView.tsx | apps/web/src/views/Training/FullSolveView.tsx |
| 2026-07-26 | [`a28336d`](https://github.com/Doritozz05/Cubeforge/commit/a28336d) | sin clasificar | deuda | apps/web/src/hooks/useDrillTimer.ts · apps/web/src/views/Training/FullSolveView.tsx · apps/web/src/views/Training/PhaseStatsView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx · … (6 en total) |
| 2026-07-26 | [`b5f8341`](https://github.com/Doritozz05/Cubeforge/commit/b5f8341) | sin clasificar | db fix | apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx · apps/web/src/views/Training/PhaseStatsView.tsx · … (11 en total) |
| 2026-07-26 | [`00fcfe9`](https://github.com/Doritozz05/Cubeforge/commit/00fcfe9) | sin clasificar | icons | apps/web/src/views/SkillTree/UltraSkillTreeView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-26 | [`6efaf7d`](https://github.com/Doritozz05/Cubeforge/commit/6efaf7d) | sin clasificar | Update TrainingDashboard.tsx | apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-26 | [`e626052`](https://github.com/Doritozz05/Cubeforge/commit/e626052) | sin clasificar | fix | apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/views/Training/BlockPracticeView.tsx · apps/web/src/views/Training/CrossPracticeView.tsx · apps/web/src/views/Training/EOPhasePracticeView.tsx · … (10 en total) |
| 2026-07-26 | [`d1e83e8`](https://github.com/Doritozz05/Cubeforge/commit/d1e83e8) | sin clasificar | fixes | apps/web/src/hooks/usePracticeSession.ts · apps/web/src/views/Training/BlindPracticeView.tsx · apps/web/src/views/Training/BlockPracticeView.tsx · apps/web/src/views/Training/CrossCNView.tsx · … (13 en total) |
| 2026-07-26 | [`3f2dd6f`](https://github.com/Doritozz05/Cubeforge/commit/3f2dd6f) | docs | old | auditorias/Auditoria_Tecnica_Integral_2026-07-18.md · docs/02-architecture/research/Initial_Architecture_Research_Report.md · docs/02-architecture/research/UI_AUDIT_2026.md · docs/14-ai/CFOP_Analysis_Status_2026-07-19.md · … (8 en total) |
| 2026-07-26 | [`d83e9fa`](https://github.com/Doritozz05/Cubeforge/commit/d83e9fa) | sin clasificar | fixes | apps/web/package.json · apps/web/src/lib/training/__tests__/setupGenerator.test.ts · apps/web/src/lib/training/setupGenerator.ts · apps/web/src/utils/formatTime.ts · … (73 en total) |
| 2026-07-26 | [`f6ab487`](https://github.com/Doritozz05/Cubeforge/commit/f6ab487) | sin clasificar | fixes | apps/desktop/package.json · apps/web/package.json · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · … (58 en total) |
| 2026-07-26 | [`e8b980f`](https://github.com/Doritozz05/Cubeforge/commit/e8b980f) | sin clasificar | fixes | apps/desktop/src/database-override.ts · apps/desktop/tsconfig.json · apps/desktop/vite.config.ts |
| 2026-07-26 | [`a0b4965`](https://github.com/Doritozz05/Cubeforge/commit/a0b4965) | sin clasificar | stcakmat | apps/web/public/stackmat-processor.js · apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · … (12 en total) |
| 2026-07-26 | [`52bd00f`](https://github.com/Doritozz05/Cubeforge/commit/52bd00f) | sin clasificar | pb win | apps/web/src/App.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Timer/PbCelebrationBanner.tsx · apps/web/src/components/Timer/TimerContainer.tsx · … (8 en total) |
| 2026-07-26 | [`fb1f21b`](https://github.com/Doritozz05/Cubeforge/commit/fb1f21b) | sin clasificar | fixes | apps/web/src/widgets/explorer/WidgetExplorer.tsx |
| 2026-07-26 | [`11a6ba9`](https://github.com/Doritozz05/Cubeforge/commit/11a6ba9) | sin clasificar | fixes | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/widgets/explorer/WidgetExplorer.tsx |
| 2026-07-26 | [`2cb2ffa`](https://github.com/Doritozz05/Cubeforge/commit/2cb2ffa) | sin clasificar | f2l | apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/views/Practice/components/MethodTree.tsx · packages/algorithm-db/src/__tests__/f2l.test.ts · … (11 en total) |
| 2026-07-26 | [`eafccdc`](https://github.com/Doritozz05/Cubeforge/commit/eafccdc) | sin clasificar | f2l. | apps/web/src/views/Practice/components/Case3DPanel.tsx · packages/algorithm-db/src/seed/cfop-f2l.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-07-26 | [`0a268d3`](https://github.com/Doritozz05/Cubeforge/commit/0a268d3) | sin clasificar | Update Cube3DEngine.ts | packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-07-26 | [`0004f44`](https://github.com/Doritozz05/Cubeforge/commit/0004f44) | sin clasificar | Update Case3DPanel.tsx | apps/web/src/views/Practice/components/Case3DPanel.tsx |
| 2026-07-26 | [`83319f8`](https://github.com/Doritozz05/Cubeforge/commit/83319f8) | sin clasificar | 3d | apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseGrid.tsx |
| 2026-07-26 | [`5c81b09`](https://github.com/Doritozz05/Cubeforge/commit/5c81b09) | sin clasificar | fixes | apps/web/src/views/Practice/components/CaseGrid.tsx · packages/algorithm-db/src/schema.ts |
| 2026-07-26 | [`3e6abb4`](https://github.com/Doritozz05/Cubeforge/commit/3e6abb4) | sin clasificar | performance | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx |

### v0.3.9 — F2L 41 Case Modeling & Full Solve / Modelado de los 41 F2L y full solve — 2026-07-27 → 2026-07-27 — 7 commits

**Resumen:** Modelado completo de los 41 casos básicos de F2L con vistas 3D de ángulo de slot y desglose de full solve.

**Destacados:**
- Basic F2L case recognition modeling (41 cases) with 3D slot perspective angles.
- Full Solve practice mode combining Cross, F2L, OLL and PLL with automated phase transitions.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-27 | [`1f96cd7`](https://github.com/Doritozz05/Cubeforge/commit/1f96cd7) | sin clasificar | fix | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-07-27 | [`21724c6`](https://github.com/Doritozz05/Cubeforge/commit/21724c6) | sin clasificar | Update Global3DSnapshotService.ts | apps/web/src/services/Global3DSnapshotService.ts |
| 2026-07-27 | [`0ce0112`](https://github.com/Doritozz05/Cubeforge/commit/0ce0112) | sin clasificar | Update Case3DDiagram.tsx | apps/web/src/views/Practice/components/Case3DDiagram.tsx |
| 2026-07-27 | [`6c1a099`](https://github.com/Doritozz05/Cubeforge/commit/6c1a099) | sin clasificar | fix af2l | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx · packages/cube-3d-engine/src/__tests__/Cube3DEngine.test.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-07-27 | [`d9274a0`](https://github.com/Doritozz05/Cubeforge/commit/d9274a0) | sin clasificar | fixes | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx |
| 2026-07-27 | [`424735f`](https://github.com/Doritozz05/Cubeforge/commit/424735f) | sin clasificar | fix | apps/web/src/views/Training/PhaseStatsView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-27 | [`e0821c0`](https://github.com/Doritozz05/Cubeforge/commit/e0821c0) | sin clasificar | fixes | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/hooks/useCrossScramble.ts · … (18 en total) |

### v0.4.0 — Draggable Dock & Floating Architecture / Dock arrastrable y arquitectura flotante — 2026-07-28 → 2026-07-28 — 11 commits

**Resumen:** Sistema de widgets flotantes con dock arrastrable, anclaje de ventanas y generador CubeMark.

**Destacados:**
- Floating widget architecture with draggable windows and customizable dock mounting.
- Local user profiles with CubeMark SVG identicon generation and country flags.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-28 | [`6d31637`](https://github.com/Doritozz05/Cubeforge/commit/6d31637) | sin clasificar | fixes | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/explorer/WidgetCard.tsx · … (5 en total) |
| 2026-07-28 | [`6dc9f32`](https://github.com/Doritozz05/Cubeforge/commit/6dc9f32) | sin clasificar | metornme | apps/web/src/widgets/implementations/metronome/FloatingMetronomePanel.tsx · apps/web/src/widgets/implementations/metronome/MetronomePreview.tsx · apps/web/src/widgets/implementations/metronome/definition.ts · apps/web/src/widgets/implementations/metronome/index.ts · … (6 en total) |
| 2026-07-28 | [`a619e45`](https://github.com/Doritozz05/Cubeforge/commit/a619e45) | sin clasificar | fixes | apps/web/src/widgets/implementations/metronome/BeatIndicator.tsx · apps/web/src/widgets/implementations/metronome/FloatingMetronomePanel.tsx |
| 2026-07-28 | [`b1d8076`](https://github.com/Doritozz05/Cubeforge/commit/b1d8076) | sin clasificar | widgets | apps/web/src/widgets/implementations/cube-button/definition.ts · apps/web/src/widgets/implementations/metronome/MetronomePreview.tsx · apps/web/src/widgets/implementations/metronome/definition.ts · apps/web/src/widgets/implementations/notes/FloatingNotesPanel.tsx · … (10 en total) |
| 2026-07-28 | [`fd4c34d`](https://github.com/Doritozz05/Cubeforge/commit/fd4c34d) | sin clasificar | fix | apps/web/src/widgets/implementations/metronome/MetronomePreview.tsx · apps/web/src/widgets/implementations/notes/FloatingNotesPanel.tsx |
| 2026-07-28 | [`a4b9d77`](https://github.com/Doritozz05/Cubeforge/commit/a4b9d77) | sin clasificar | english | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/hooks/useSolveSession.ts · apps/web/src/utils/audioSystem.ts · apps/web/src/widgets/explorer/WidgetExplorer.tsx · … (14 en total) |
| 2026-07-28 | [`b9241ca`](https://github.com/Doritozz05/Cubeforge/commit/b9241ca) | sin clasificar | fixes | apps/web/src/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx · packages/algorithm-db/src/methodRegistry.ts |
| 2026-07-28 | [`c439852`](https://github.com/Doritozz05/Cubeforge/commit/c439852) | sin clasificar | fixes | apps/web/src/widgets/implementations/algorithm-db/AlgorithmDbPreview.tsx · apps/web/src/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx · apps/web/src/widgets/implementations/algorithm-db/definition.ts · … (6 en total) |
| 2026-07-28 | [`b6214f1`](https://github.com/Doritozz05/Cubeforge/commit/b6214f1) | sin clasificar | fixes | apps/web/src/widgets/implementations/algorithm-db/definition.ts · apps/web/src/widgets/implementations/notes/NotesPreview.tsx |
| 2026-07-28 | [`3fdebbf`](https://github.com/Doritozz05/Cubeforge/commit/3fdebbf) | sin clasificar | Update AlgorithmViewerCard.tsx | apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx |
| 2026-07-28 | [`ad59155`](https://github.com/Doritozz05/Cubeforge/commit/ad59155) | sin clasificar | fixes | apps/web/src/components/Stats/atoms/MetricTile.tsx · apps/web/src/widgets/implementations/solve-timeline/SolveTimelinePreview.tsx · apps/web/src/widgets/implementations/time-distribution/FloatingTimeDistribution.tsx · apps/web/src/widgets/implementations/time-distribution/TimeDistributionPreview.tsx |

### v0.4.1 — Metronome & Scratchpad Notes / Metrónomo y bloc de notas — 2026-07-28 → 2026-07-28 — 0 commits

**Resumen:** Widget de Metrónomo de audio con control de BPM para drills de ritmo de giro, y widget de notas.

**Destacados:**
- Audio Metronome widget with configurable BPM for smooth turning pacing drills.
- Notes scratchpad widget for session observations, algorithms, and reminders.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.4.2 — csTimer Manual Entry Parser / Parser de entrada manual csTimer — 2026-07-29 → 2026-07-29 — 11 commits

**Resumen:** Entrada manual de tiempos con sintaxis csTimer (ej. 1450 → 14.50s, 90s, DNF) y pegado por lotes.

**Destacados:**
- Manual time entry parser supporting csTimer shorthand syntax and bulk solve paste.
- Post-solve quick action bar with +2, DNF, and solve note editor pills.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-29 | [`16b4e0e`](https://github.com/Doritozz05/Cubeforge/commit/16b4e0e) | sin clasificar | settings | apps/web/src/components/Settings/sections/AnalysisSection.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Stats/SessionStats.tsx · … (13 en total) |
| 2026-07-29 | [`fddbda2`](https://github.com/Doritozz05/Cubeforge/commit/fddbda2) | sin clasificar | Update App.tsx | apps/web/src/App.tsx |
| 2026-07-29 | [`6476d0f`](https://github.com/Doritozz05/Cubeforge/commit/6476d0f) | sin clasificar | 2x2 | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · … (27 en total) |
| 2026-07-29 | [`c4370f3`](https://github.com/Doritozz05/Cubeforge/commit/c4370f3) | sin clasificar | Update InsightsDashboard.tsx | apps/web/src/components/Insights/InsightsDashboard.tsx |
| 2026-07-29 | [`a49ba05`](https://github.com/Doritozz05/Cubeforge/commit/a49ba05) | sin clasificar | fixes 2x2 | apps/web/src/widgets/implementations/cube-button/FloatingCubeButton.tsx · apps/web/src/widgets/implementations/scramble-2d/FloatingCube2DPanel.tsx · packages/cube-3d-engine/src/__tests__/FaceletParser2x2.test.ts · packages/cube-3d-engine/src/core/FaceletParser2x2.ts · … (7 en total) |
| 2026-07-29 | [`a3a1a21`](https://github.com/Doritozz05/Cubeforge/commit/a3a1a21) | sin clasificar | Update CubeModel.ts | packages/cube-3d-engine/src/core/CubeModel.ts |
| 2026-07-29 | [`e13c489`](https://github.com/Doritozz05/Cubeforge/commit/e13c489) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/hooks/useCube3D.ts |
| 2026-07-29 | [`cfefdf8`](https://github.com/Doritozz05/Cubeforge/commit/cfefdf8) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Stats/SessionStats.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/utils/__tests__/pbDetection.test.ts · … (10 en total) |
| 2026-07-29 | [`cc18901`](https://github.com/Doritozz05/Cubeforge/commit/cc18901) | sin clasificar | fixes | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/components/Stats/SessionStats.tsx · apps/web/src/components/Stats/TimesList.tsx · … (6 en total) |
| 2026-07-29 | [`57c83c1`](https://github.com/Doritozz05/Cubeforge/commit/57c83c1) | sin clasificar | fixes | apps/web/public/stackmat-processor.js · apps/web/src/App.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Stats/SessionStats.tsx · … (13 en total) |
| 2026-07-29 | [`56c1937`](https://github.com/Doritozz05/Cubeforge/commit/56c1937) | sin clasificar | fixes | apps/web/src/components/Timer/hintFor.test.ts · apps/web/src/components/Timer/hintFor.ts · apps/web/src/hooks/__tests__/useScrambleValidator.test.ts · apps/web/src/hooks/useScrambleValidator.ts · … (6 en total) |

### v0.4.3 — 2×2 Cube Mathematical Engine / Motor matemático de cubo 2×2 — 2026-07-29 → 2026-07-29 — 0 commits

**Resumen:** Modelo de estado matemático para cubo 2×2, arquitectura de renderizado 3D y aplicación de giros.

**Destacados:**
- 2×2 cube state representation with permutation and orientation tracking.
- 3D visual engine for 2×2 cube with realistic bevels and sticker geometry.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.4.4 — Layout Organizer & Snap-to-Grid / Organizador de layouts y ajuste magnético — 2026-07-30 → 2026-07-30 — 64 commits

**Resumen:** Widget de Organizador de Layouts con guardado/carga de presets y ajuste a cuadrícula.

**Destacados:**
- Floating Layout Organizer widget allowing solvers to save, name and switch custom widget arrangements.
- Snap-to-grid alignment when dragging floating widgets near edges or other panels.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-30 | [`1fec3ae`](https://github.com/Doritozz05/Cubeforge/commit/1fec3ae) | sin clasificar | Merge pull request #2 from Doritozz05/training | — |
| 2026-07-30 | [`7e9385d`](https://github.com/Doritozz05/Cubeforge/commit/7e9385d) | sin clasificar | fixes | packages/analysis-engine/src/__tests__/diagnostic-phase-detection.test.ts · packages/analysis-engine/src/metrics/MetricsAggregator.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts |
| 2026-07-30 | [`d241f7d`](https://github.com/Doritozz05/Cubeforge/commit/d241f7d) | sin clasificar | tests | packages/algorithm-db/src/__tests__/invertMove.edgeCases.test.ts · packages/analysis-engine/src/__tests__/PhaseSplitter.validate.test.ts · packages/math-core/src/Cube2x2State.ts · packages/math-core/src/__tests__/CubeState.edgeCases.test.ts · … (8 en total) |
| 2026-07-30 | [`2fa7403`](https://github.com/Doritozz05/Cubeforge/commit/2fa7403) | sin clasificar | fix | packages/solver-engine/src/TwoByTwoScrambler.test.ts · packages/solver-engine/src/TwoByTwoSolver.test.ts · packages/solver-engine/src/TwoByTwoSolver.ts |
| 2026-07-30 | [`8e90112`](https://github.com/Doritozz05/Cubeforge/commit/8e90112) | sin clasificar | 2x2 | packages/solver-engine/src/TwoByTwoScrambler.test.ts · packages/solver-engine/src/TwoByTwoScrambler.ts · packages/solver-engine/src/TwoByTwoSolver.test.ts · packages/solver-engine/src/TwoByTwoSolver.ts |
| 2026-07-30 | [`e7928ac`](https://github.com/Doritozz05/Cubeforge/commit/e7928ac) | sin clasificar | cache | apps/web/src/App.tsx · apps/web/src/components/Stats/ManualSolveSheet.tsx · apps/web/src/hooks/usePracticeSession.ts · apps/web/src/utils/puzzleUtils.ts · … (5 en total) |
| 2026-07-30 | [`66e16f2`](https://github.com/Doritozz05/Cubeforge/commit/66e16f2) | test | tests | packages/hardware-hal/tests/ClockDrift.edgeCases.test.ts · packages/math-core/src/__tests__/Cube2x2State.edgeCases.test.ts · packages/timer-engine/tests/WcaRules.edgeCases.test.ts |
| 2026-07-30 | [`fa69383`](https://github.com/Doritozz05/Cubeforge/commit/fa69383) | test | tests | packages/analysis-engine/src/__tests__/EfficiencyCalculator.edgeCases.test.ts · packages/cube-3d-engine/src/__tests__/CubeModel.edgeCases.test.ts |
| 2026-07-30 | [`a251b93`](https://github.com/Doritozz05/Cubeforge/commit/a251b93) | sin clasificar | fixes | packages/cube-3d-engine/src/__tests__/SceneManager.edgeCases.test.ts · packages/cube-3d-engine/src/core/SceneManager.ts · packages/database/src/__tests__/db.edgeCases.test.ts · packages/database/src/repositories/solves.repository.ts · … (6 en total) |
| 2026-07-30 | [`0861a8f`](https://github.com/Doritozz05/Cubeforge/commit/0861a8f) | sin clasificar | qa | package.json · packages/math-core/src/__tests__/data-integrity.test.ts · packages/solver-engine/src/__tests__/property-based.test.ts · pnpm-lock.yaml |
| 2026-07-30 | [`a4f7777`](https://github.com/Doritozz05/Cubeforge/commit/a4f7777) | test | tests | packages/analysis-engine/src/__tests__/integration-cross-package.test.ts · packages/solver-engine/src/__tests__/stress-load.test.ts |
| 2026-07-30 | [`515427e`](https://github.com/Doritozz05/Cubeforge/commit/515427e) | sin clasificar | qa | .github/workflows/quality-gates.yml · packages/analysis-engine/src/__tests__/benchmarks.test.ts · packages/analysis-engine/src/__tests__/determinism.test.ts · packages/database/src/__tests__/db.fuzzing.test.ts · … (11 en total) |
| 2026-07-30 | [`375a330`](https://github.com/Doritozz05/Cubeforge/commit/375a330) | sin clasificar | 2x2 algorithms | apps/web/src/views/Practice/components/MethodTree.tsx · apps/web/src/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel.tsx · packages/algorithm-db/src/methodRegistry.ts |
| 2026-07-30 | [`cf127cf`](https://github.com/Doritozz05/Cubeforge/commit/cf127cf) | sin clasificar | Update MethodTree.tsx | apps/web/src/views/Practice/components/MethodTree.tsx |
| 2026-07-30 | [`a83a33a`](https://github.com/Doritozz05/Cubeforge/commit/a83a33a) | sin clasificar | fixes | apps/web/src/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel.tsx · apps/web/src/widgets/registerAllWidgets.ts |
| 2026-07-30 | [`62b3f9e`](https://github.com/Doritozz05/Cubeforge/commit/62b3f9e) | sin clasificar | fixes | .github/workflows/ci.yml · .github/workflows/quality-gates.yml · .github/workflows/release.yml |
| 2026-07-30 | [`3e44201`](https://github.com/Doritozz05/Cubeforge/commit/3e44201) | sin clasificar | fixes | .github/workflows/quality-gates.yml · packages/algorithm-db/eslint.config.js · packages/algorithm-db/src/__tests__/caseGenerator.test.ts · packages/analysis-engine/src/__tests__/EfficiencyCalculator.edgeCases.test.ts · … (13 en total) |
| 2026-07-30 | [`93d9de0`](https://github.com/Doritozz05/Cubeforge/commit/93d9de0) | sin clasificar | fixes | .github/workflows/quality-gates.yml · packages/analysis-engine/src/__tests__/benchmarks.test.ts · packages/math-core/package.json · packages/solver-engine/src/TwoByTwoSolver.test.ts · … (5 en total) |
| 2026-07-30 | [`c43e697`](https://github.com/Doritozz05/Cubeforge/commit/c43e697) | sin clasificar | fixes | .github/workflows/quality-gates.yml · packages/solver-engine/src/__tests__/benchmarks.test.ts |
| 2026-07-30 | [`4e57add`](https://github.com/Doritozz05/Cubeforge/commit/4e57add) | sin clasificar | fixes | packages/analysis-engine/package.json · packages/gan-protocol/package.json · packages/hardware-hal/package.json · packages/math-core/package.json · … (7 en total) |
| 2026-07-30 | [`eaabee7`](https://github.com/Doritozz05/Cubeforge/commit/eaabee7) | test | Update benchmarks.test.ts | packages/solver-engine/src/__tests__/benchmarks.test.ts |
| 2026-07-30 | [`755d555`](https://github.com/Doritozz05/Cubeforge/commit/755d555) | test | fixes | packages/algorithm-db/src/__tests__/oll-speedcubedb-comparison.test.ts · packages/algorithm-db/src/__tests__/pll-speedcubedb-comparison.test.ts · packages/solver-engine/src/__tests__/benchmarks.test.ts |
| 2026-07-30 | [`94c351a`](https://github.com/Doritozz05/Cubeforge/commit/94c351a) | sin clasificar | fix discrepancy | packages/solver-engine/src/__tests__/stress-load.test.ts · packages/ui/src/components/skeleton.tsx |
| 2026-07-30 | [`9e3062c`](https://github.com/Doritozz05/Cubeforge/commit/9e3062c) | sin clasificar | fix | .github/workflows/release.yml · packages/math-core/package.json · packages/math-core/src/__tests__/CubeState.regression.test.ts |
| 2026-07-30 | [`b457cb3`](https://github.com/Doritozz05/Cubeforge/commit/b457cb3) | test | tests | packages/solver-engine/src/TwoByTwoSolver.test.ts · packages/solver-engine/src/__tests__/benchmarks.test.ts |
| 2026-07-30 | [`2979596`](https://github.com/Doritozz05/Cubeforge/commit/2979596) | sin clasificar | fixes | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Layout/CubeforgeCommandPalette.tsx · apps/web/src/hooks/useDraggable.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx · … (10 en total) |
| 2026-07-30 | [`b536982`](https://github.com/Doritozz05/Cubeforge/commit/b536982) | sin clasificar | Update CubeforgeCommandPalette.tsx | apps/web/src/components/Layout/CubeforgeCommandPalette.tsx |
| 2026-07-30 | [`b0942c6`](https://github.com/Doritozz05/Cubeforge/commit/b0942c6) | sin clasificar | algs | packages/algorithm-db/src/seed/index.ts · packages/algorithm-db/src/seed/ortega.ts |
| 2026-07-30 | [`c402186`](https://github.com/Doritozz05/Cubeforge/commit/c402186) | sin clasificar | 2x2 | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case2x2Diagram.tsx · apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · … (10 en total) |
| 2026-07-30 | [`089d99d`](https://github.com/Doritozz05/Cubeforge/commit/089d99d) | sin clasificar | fix | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx · packages/algorithm-db/src/methodRegistry.ts |
| 2026-07-30 | [`e821989`](https://github.com/Doritozz05/Cubeforge/commit/e821989) | sin clasificar | fix | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · … (8 en total) |
| 2026-07-30 | [`f19be0c`](https://github.com/Doritozz05/Cubeforge/commit/f19be0c) | sin clasificar | fixes | apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx |
| 2026-07-30 | [`2c6396a`](https://github.com/Doritozz05/Cubeforge/commit/2c6396a) | sin clasificar | fixes alg | apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx |
| 2026-07-30 | [`d3fa363`](https://github.com/Doritozz05/Cubeforge/commit/d3fa363) | sin clasificar | fixes | apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx |
| 2026-07-30 | [`6260562`](https://github.com/Doritozz05/Cubeforge/commit/6260562) | sin clasificar | fixes | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx |
| 2026-07-30 | [`6ba4cf9`](https://github.com/Doritozz05/Cubeforge/commit/6ba4cf9) | sin clasificar | camera reset | apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/Case3DPanel.tsx |
| 2026-07-30 | [`ca75e25`](https://github.com/Doritozz05/Cubeforge/commit/ca75e25) | sin clasificar | fix | apps/web/src/hooks/useSolveSession.ts · apps/web/src/utils/env.ts · apps/web/src/utils/seedDemoData.ts |
| 2026-07-30 | [`35f0c26`](https://github.com/Doritozz05/Cubeforge/commit/35f0c26) | chore | chore: prepare web for vercel deployment with pwa icons, seo and coop/coep headers | .gitignore · apps/web/index.html · apps/web/public/icon-192.png · apps/web/public/icon-512.png · … (5 en total) |
| 2026-07-30 | [`9422e6d`](https://github.com/Doritozz05/Cubeforge/commit/9422e6d) | fix | fix: resolve ts implicit any in FloatingTimeDistribution and use turbo build filter in vercel.json | apps/web/src/widgets/implementations/time-distribution/FloatingTimeDistribution.tsx · vercel.json |
| 2026-07-30 | [`e8d2760`](https://github.com/Doritozz05/Cubeforge/commit/e8d2760) | sin clasificar | widgets | apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/definition.ts · apps/web/src/widgets/implementations/cube-button/definition.ts · … (19 en total) |
| 2026-07-30 | [`fbd994d`](https://github.com/Doritozz05/Cubeforge/commit/fbd994d) | sin clasificar | widget improved tips | apps/web/src/components/Layout/Header.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/explorer/WidgetCard.tsx · apps/web/src/widgets/widgetStore.ts |
| 2026-07-30 | [`c3728d2`](https://github.com/Doritozz05/Cubeforge/commit/c3728d2) | sin clasificar | Update index.html | apps/web/index.html |
| 2026-07-30 | [`58ff616`](https://github.com/Doritozz05/Cubeforge/commit/58ff616) | sin clasificar | Update index.html | apps/web/index.html |
| 2026-07-30 | [`15935f4`](https://github.com/Doritozz05/Cubeforge/commit/15935f4) | sin clasificar | layout | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/implementations/layout-organizer/FloatingLayoutOrganizer.tsx · apps/web/src/widgets/implementations/layout-organizer/LayoutOrganizerPreview.tsx · apps/web/src/widgets/implementations/layout-organizer/definition.ts · … (8 en total) |
| 2026-07-30 | [`0841813`](https://github.com/Doritozz05/Cubeforge/commit/0841813) | sin clasificar | Update useDraggable.ts | apps/web/src/hooks/useDraggable.ts |
| 2026-07-30 | [`9ce34ad`](https://github.com/Doritozz05/Cubeforge/commit/9ce34ad) | sin clasificar | Update WidgetCard.tsx | apps/web/src/widgets/explorer/WidgetCard.tsx |
| 2026-07-30 | [`67e8b49`](https://github.com/Doritozz05/Cubeforge/commit/67e8b49) | sin clasificar | z index fix | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/widgetStore.ts |
| 2026-07-30 | [`c86b3d7`](https://github.com/Doritozz05/Cubeforge/commit/c86b3d7) | sin clasificar | Update FloatingWidgetWrapper.tsx | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-07-30 | [`283754c`](https://github.com/Doritozz05/Cubeforge/commit/283754c) | sin clasificar | widgets | apps/web/src/App.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/explorer/WidgetCard.tsx · … (11 en total) |
| 2026-07-30 | [`3a0ff44`](https://github.com/Doritozz05/Cubeforge/commit/3a0ff44) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/explorer/WidgetHost.tsx · apps/web/src/widgets/implementations/cube-button/FloatingCubeButton.tsx · … (6 en total) |
| 2026-07-30 | [`41b2390`](https://github.com/Doritozz05/Cubeforge/commit/41b2390) | sin clasificar | fixes | apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/explorer/WidgetCard.tsx · apps/web/src/widgets/implementations/layout-organizer/FloatingLayoutOrganizer.tsx |
| 2026-07-30 | [`84e8664`](https://github.com/Doritozz05/Cubeforge/commit/84e8664) | sin clasificar | Update WidgetCard.tsx | apps/web/src/widgets/explorer/WidgetCard.tsx |
| 2026-07-30 | [`88758a5`](https://github.com/Doritozz05/Cubeforge/commit/88758a5) | sin clasificar | snap | apps/web/src/hooks/useDraggable.ts · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/dockZoneState.ts · apps/web/src/widgets/implementations/cube-button/FloatingCubeButton.tsx · … (6 en total) |
| 2026-07-30 | [`84c3301`](https://github.com/Doritozz05/Cubeforge/commit/84c3301) | sin clasificar | fix | apps/web/src/hooks/useDraggable.ts · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/types.ts · apps/web/src/widgets/widgetStore.ts |
| 2026-07-30 | [`e840aa9`](https://github.com/Doritozz05/Cubeforge/commit/e840aa9) | sin clasificar | Update FloatingLayoutOrganizer.tsx | apps/web/src/widgets/implementations/layout-organizer/FloatingLayoutOrganizer.tsx |
| 2026-07-30 | [`e689dac`](https://github.com/Doritozz05/Cubeforge/commit/e689dac) | sin clasificar | Update FloatingLayoutOrganizer.tsx | apps/web/src/widgets/implementations/layout-organizer/FloatingLayoutOrganizer.tsx |
| 2026-07-30 | [`1dbcb94`](https://github.com/Doritozz05/Cubeforge/commit/1dbcb94) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-30 | [`bcf2e05`](https://github.com/Doritozz05/Cubeforge/commit/bcf2e05) | sin clasificar | fix | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/dockZoneState.ts · apps/web/src/widgets/widgetStore.ts |
| 2026-07-30 | [`f9b9924`](https://github.com/Doritozz05/Cubeforge/commit/f9b9924) | sin clasificar | fix | apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/dockZoneState.ts |
| 2026-07-30 | [`d2413ca`](https://github.com/Doritozz05/Cubeforge/commit/d2413ca) | sin clasificar | fix | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-30 | [`c7d5982`](https://github.com/Doritozz05/Cubeforge/commit/c7d5982) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-30 | [`7aae161`](https://github.com/Doritozz05/Cubeforge/commit/7aae161) | sin clasificar | fix bug | apps/web/src/hooks/useDraggable.ts · apps/web/src/index.css · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · … (6 en total) |
| 2026-07-30 | [`3a84db3`](https://github.com/Doritozz05/Cubeforge/commit/3a84db3) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-30 | [`4c1f0ce`](https://github.com/Doritozz05/Cubeforge/commit/4c1f0ce) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |

### v0.4.5 — 2×2 Algorithm Database & Time Histogram / Base de algoritmos 2×2 e histograma — 2026-07-30 → 2026-07-30 — 0 commits

**Resumen:** Base de algoritmos 2×2 (métodos Ortega, CLL, EG) e histograma flotante de distribución de tiempos.

**Destacados:**
- 2×2 algorithm database with Ortega, CLL and EG method sets.
- Floating Time Distribution histogram widget with customizable duration binning.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.4.6 — PB Progression & BPA/WPA Projections / Evolución de PB y proyecciones BPA/WPA — 2026-07-31 → 2026-07-31 — 52 commits

**Resumen:** Gráfica escalonada de evolución de PB y proyecciones de Mejor/Peor Media Posible (BPA/WPA).

**Destacados:**
- PB Progression step-chart charting historical personal best milestones over time.
- Best Possible Average (BPA) and Worst Possible Average (WPA) live countdown calculations during an active Ao5.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-31 | [`6ba1c9c`](https://github.com/Doritozz05/Cubeforge/commit/6ba1c9c) | sin clasificar | fixes | apps/web/src/hooks/useDraggable.ts · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/dockZoneState.ts · apps/web/src/widgets/explorer/WidgetHost.tsx · … (11 en total) |
| 2026-07-31 | [`f11a91f`](https://github.com/Doritozz05/Cubeforge/commit/f11a91f) | sin clasificar | FIX | apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/debug.ts · … (7 en total) |
| 2026-07-31 | [`44c9880`](https://github.com/Doritozz05/Cubeforge/commit/44c9880) | sin clasificar | Update index.css | apps/web/src/index.css |
| 2026-07-31 | [`85c9ef6`](https://github.com/Doritozz05/Cubeforge/commit/85c9ef6) | sin clasificar | fix | apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/implementations/cube-button/FloatingCubeButton.tsx |
| 2026-07-31 | [`66b91a3`](https://github.com/Doritozz05/Cubeforge/commit/66b91a3) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`7e29d19`](https://github.com/Doritozz05/Cubeforge/commit/7e29d19) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`7aca431`](https://github.com/Doritozz05/Cubeforge/commit/7aca431) | sin clasificar | Update FloatingTimeDistribution.tsx | apps/web/src/widgets/implementations/time-distribution/FloatingTimeDistribution.tsx |
| 2026-07-31 | [`1d4cad7`](https://github.com/Doritozz05/Cubeforge/commit/1d4cad7) | sin clasificar | fix | apps/web/src/widgets/types.ts · apps/web/src/widgets/widgetStore.ts |
| 2026-07-31 | [`f3b6d70`](https://github.com/Doritozz05/Cubeforge/commit/f3b6d70) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`31c49d2`](https://github.com/Doritozz05/Cubeforge/commit/31c49d2) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`54bfd60`](https://github.com/Doritozz05/Cubeforge/commit/54bfd60) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`0887465`](https://github.com/Doritozz05/Cubeforge/commit/0887465) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`8755513`](https://github.com/Doritozz05/Cubeforge/commit/8755513) | sin clasificar | fix ci | .github/workflows/quality-gates.yml · packages/analysis-engine/src/__tests__/benchmarks.test.ts · packages/solver-engine/src/__tests__/benchmarks.test.ts |
| 2026-07-31 | [`00aa619`](https://github.com/Doritozz05/Cubeforge/commit/00aa619) | sin clasificar | fixes | apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/hooks/useDraggable.ts · apps/web/src/hooks/useGlobalDragCursor.ts · apps/web/src/index.css · … (5 en total) |
| 2026-07-31 | [`ed768c8`](https://github.com/Doritozz05/Cubeforge/commit/ed768c8) | sin clasificar | Update index.css | apps/web/src/index.css |
| 2026-07-31 | [`cd642d1`](https://github.com/Doritozz05/Cubeforge/commit/cd642d1) | sin clasificar | manual | apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · … (7 en total) |
| 2026-07-31 | [`1846e64`](https://github.com/Doritozz05/Cubeforge/commit/1846e64) | sin clasificar | manual entry | apps/web/src/components/Timer/ManualTimeInput.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-07-31 | [`cd73507`](https://github.com/Doritozz05/Cubeforge/commit/cd73507) | sin clasificar | Update ManualTimeInput.tsx | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`f4fa057`](https://github.com/Doritozz05/Cubeforge/commit/f4fa057) | sin clasificar | Update ManualTimeInput.tsx | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`55ce474`](https://github.com/Doritozz05/Cubeforge/commit/55ce474) | sin clasificar | Update ManualTimeInput.tsx | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`c5d23a2`](https://github.com/Doritozz05/Cubeforge/commit/c5d23a2) | sin clasificar | Update ManualTimeInput.tsx | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`f3e8fad`](https://github.com/Doritozz05/Cubeforge/commit/f3e8fad) | sin clasificar | Update ManualTimeInput.tsx | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`98800ff`](https://github.com/Doritozz05/Cubeforge/commit/98800ff) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`db1c415`](https://github.com/Doritozz05/Cubeforge/commit/db1c415) | sin clasificar | Update ManualTimeInput.tsx | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-07-31 | [`727b1b0`](https://github.com/Doritozz05/Cubeforge/commit/727b1b0) | sin clasificar | fixes | apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Timer/ManualTimeInput.tsx · apps/web/src/utils/importSolves.ts |
| 2026-07-31 | [`62b286a`](https://github.com/Doritozz05/Cubeforge/commit/62b286a) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/utils/__tests__/importSolves.test.ts · … (6 en total) |
| 2026-07-31 | [`60b7df4`](https://github.com/Doritozz05/Cubeforge/commit/60b7df4) | sin clasificar | import | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/utils/__tests__/importSolves.test.ts · … (6 en total) |
| 2026-07-31 | [`97e5f01`](https://github.com/Doritozz05/Cubeforge/commit/97e5f01) | sin clasificar | fixes | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/utils/__tests__/importSolves.test.ts · apps/web/src/utils/importSolves.ts |
| 2026-07-31 | [`72d8887`](https://github.com/Doritozz05/Cubeforge/commit/72d8887) | sin clasificar | fixes | apps/web/src/utils/__tests__/importSolves.test.ts · apps/web/src/utils/importSolves.ts |
| 2026-07-31 | [`78857f9`](https://github.com/Doritozz05/Cubeforge/commit/78857f9) | sin clasificar | Update DataSection.tsx | apps/web/src/components/Settings/sections/DataSection.tsx |
| 2026-07-31 | [`96f6b89`](https://github.com/Doritozz05/Cubeforge/commit/96f6b89) | sin clasificar | fix | apps/web/src/utils/__tests__/exportSolves.test.ts · apps/web/src/utils/exportSolves.ts · apps/web/src/utils/importSolves.ts · apps/web/src/utils/seedDemoData.ts |
| 2026-07-31 | [`5981486`](https://github.com/Doritozz05/Cubeforge/commit/5981486) | sin clasificar | Update importSolves.ts | apps/web/src/utils/importSolves.ts |
| 2026-07-31 | [`ca0dd42`](https://github.com/Doritozz05/Cubeforge/commit/ca0dd42) | sin clasificar | theme fix | apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/theme-provider.tsx · apps/web/src/components/theme-toggle.tsx |
| 2026-07-31 | [`01ee6c6`](https://github.com/Doritozz05/Cubeforge/commit/01ee6c6) | sin clasificar | fixes | apps/web/src/index.css · apps/web/src/utils/audioSystem.ts · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-07-31 | [`984f283`](https://github.com/Doritozz05/Cubeforge/commit/984f283) | sin clasificar | fix aniamtion | apps/web/src/index.css · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-07-31 | [`891ac68`](https://github.com/Doritozz05/Cubeforge/commit/891ac68) | sin clasificar | Update FloatingWidgetWrapper.tsx | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-07-31 | [`558bc1d`](https://github.com/Doritozz05/Cubeforge/commit/558bc1d) | sin clasificar | focus manual | apps/web/src/App.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx |
| 2026-07-31 | [`404229f`](https://github.com/Doritozz05/Cubeforge/commit/404229f) | sin clasificar | fixes scrmable | apps/web/src/App.tsx · apps/web/src/components/Settings/sections/ScrambleSection.tsx · apps/web/src/hooks/useDrillSmartCube.ts · apps/web/src/hooks/usePracticeSession.ts · … (8 en total) |
| 2026-07-31 | [`eac88f2`](https://github.com/Doritozz05/Cubeforge/commit/eac88f2) | sin clasificar | Update ScrambleSection.tsx | apps/web/src/components/Settings/sections/ScrambleSection.tsx |
| 2026-07-31 | [`3082299`](https://github.com/Doritozz05/Cubeforge/commit/3082299) | sin clasificar | Update App.tsx | apps/web/src/App.tsx |
| 2026-07-31 | [`2757b28`](https://github.com/Doritozz05/Cubeforge/commit/2757b28) | sin clasificar | aniamtion | apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-07-31 | [`e00645b`](https://github.com/Doritozz05/Cubeforge/commit/e00645b) | sin clasificar | focus fix | apps/web/src/App.tsx · apps/web/src/widgets/implementations/metronome/FloatingMetronomePanel.tsx |
| 2026-07-31 | [`f8faf72`](https://github.com/Doritozz05/Cubeforge/commit/f8faf72) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`306f236`](https://github.com/Doritozz05/Cubeforge/commit/306f236) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-07-31 | [`fb309bd`](https://github.com/Doritozz05/Cubeforge/commit/fb309bd) | chore | Update package.json | apps/desktop/package.json |
| 2026-07-31 | [`dee49c9`](https://github.com/Doritozz05/Cubeforge/commit/dee49c9) | chore | Update pnpm-lock.yaml | pnpm-lock.yaml |
| 2026-07-31 | [`dc1074a`](https://github.com/Doritozz05/Cubeforge/commit/dc1074a) | sin clasificar | training | apps/web/src/App.tsx · apps/web/src/views/Training/TrainingDashboard.tsx |
| 2026-07-31 | [`21e8c25`](https://github.com/Doritozz05/Cubeforge/commit/21e8c25) | sin clasificar | Update AlgorithmRecognizeView.tsx | apps/web/src/views/Training/AlgorithmRecognizeView.tsx |
| 2026-07-31 | [`62e9a78`](https://github.com/Doritozz05/Cubeforge/commit/62e9a78) | sin clasificar | Update AlgorithmDrillView.tsx | apps/web/src/views/Training/AlgorithmDrillView.tsx |
| 2026-07-31 | [`02f1042`](https://github.com/Doritozz05/Cubeforge/commit/02f1042) | sin clasificar | practice | apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx |
| 2026-07-31 | [`8d744fc`](https://github.com/Doritozz05/Cubeforge/commit/8d744fc) | sin clasificar | fixes | apps/web/src/views/Practice/components/Case2x2Diagram.tsx · apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · … (8 en total) |
| 2026-07-31 | [`c7259d2`](https://github.com/Doritozz05/Cubeforge/commit/c7259d2) | sin clasificar | fix | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/components/Case3DDiagram.tsx · packages/algorithm-db/src/seed/ortega.ts |

### v0.4.7 — Skill Node Detail & Custom Algorithm Editor / Detalle de skill y editor de algoritmos — 2026-08-01 → 2026-08-01 — 58 commits

**Resumen:** Modal interactivo de nodo de habilidad, botón directo de práctica y editor de algoritmos de usuario.

**Destacados:**
- SkillNodeModal displaying mastery criteria, practice tips, linked prerequisites, and direct drill launcher.
- AlgorithmEditorDialog allowing solvers to input and save their own preferred custom algorithms.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-01 | [`a26cd91`](https://github.com/Doritozz05/Cubeforge/commit/a26cd91) | sin clasificar | initial | apps/web/package.json · apps/web/src/hooks/useCaseAlgorithms.ts · apps/web/src/views/Practice/PracticeDashboard.tsx · apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx · … (26 en total) |
| 2026-08-01 | [`196dd3a`](https://github.com/Doritozz05/Cubeforge/commit/196dd3a) | sin clasificar | custom | apps/web/src/services/Case3DRenderAdapter.ts · apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Practice/PracticeDashboard.tsx · apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx · … (21 en total) |
| 2026-08-01 | [`a44722e`](https://github.com/Doritozz05/Cubeforge/commit/a44722e) | sin clasificar | fixes | apps/web/src/index.css · apps/web/src/views/Practice/PracticeDashboard.tsx · apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx · apps/web/src/views/Practice/components/Case3DDiagram.tsx · … (6 en total) |
| 2026-08-01 | [`8266c73`](https://github.com/Doritozz05/Cubeforge/commit/8266c73) | sin clasificar | fixes color | apps/web/src/index.css · apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx · apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · … (12 en total) |
| 2026-08-01 | [`c9ef380`](https://github.com/Doritozz05/Cubeforge/commit/c9ef380) | sin clasificar | Update MetronomePreview.tsx | apps/web/src/widgets/implementations/metronome/MetronomePreview.tsx |
| 2026-08-01 | [`5c3ebec`](https://github.com/Doritozz05/Cubeforge/commit/5c3ebec) | sin clasificar | fixes | apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-08-01 | [`dfa43f0`](https://github.com/Doritozz05/Cubeforge/commit/dfa43f0) | sin clasificar | fixes | apps/web/src/views/Practice/components/Case3DDiagram.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx |
| 2026-08-01 | [`39d045d`](https://github.com/Doritozz05/Cubeforge/commit/39d045d) | sin clasificar | fixes | apps/web/src/components/Timer/PbCelebrationBanner.tsx · apps/web/src/views/Training/CrossTrainerView.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/implementations/layout-organizer/FloatingLayoutOrganizer.tsx |
| 2026-08-01 | [`f4f3bd0`](https://github.com/Doritozz05/Cubeforge/commit/f4f3bd0) | sin clasificar | dynamic size pannel | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/hooks/useCube3D.ts |
| 2026-08-01 | [`cbd2540`](https://github.com/Doritozz05/Cubeforge/commit/cbd2540) | sin clasificar | Update SceneManager.ts | packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-08-01 | [`e6c89c5`](https://github.com/Doritozz05/Cubeforge/commit/e6c89c5) | sin clasificar | improved | apps/web/src/widgets/implementations/pb-progression/FloatingPbProgression.tsx · apps/web/src/widgets/implementations/pb-progression/PbProgressionPreview.tsx · apps/web/src/widgets/implementations/pb-progression/definition.ts |
| 2026-08-01 | [`9e0e532`](https://github.com/Doritozz05/Cubeforge/commit/9e0e532) | sin clasificar | fixes | apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx · apps/web/src/views/Training/CrossTrainerView.tsx · apps/web/src/widgets/implementations/layout-organizer/FloatingLayoutOrganizer.tsx |
| 2026-08-01 | [`0b34fed`](https://github.com/Doritozz05/Cubeforge/commit/0b34fed) | sin clasificar | Update AlgorithmEditorDialog.tsx | apps/web/src/views/Practice/components/AlgorithmEditorDialog.tsx |
| 2026-08-01 | [`a22d1b3`](https://github.com/Doritozz05/Cubeforge/commit/a22d1b3) | sin clasificar | fixes | apps/web/src/views/Practice/components/Case3DPanel.tsx · apps/web/src/views/Practice/components/CaseDetailPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx · packages/algorithm-db/src/seed/ortega.ts |
| 2026-08-01 | [`c4dc706`](https://github.com/Doritozz05/Cubeforge/commit/c4dc706) | sin clasificar | widget | apps/web/src/App.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/hooks/useSolveSession.ts · … (31 en total) |
| 2026-08-01 | [`bf8a7c5`](https://github.com/Doritozz05/Cubeforge/commit/bf8a7c5) | sin clasificar | fix | apps/web/src/utils/__tests__/insights.test.ts · apps/web/src/widgets/implementations/phase-balance/FloatingPhaseBalance.tsx · apps/web/src/widgets/implementations/phase-balance/phaseBalance.test.ts · apps/web/src/widgets/implementations/solve-timeline/FloatingPhaseTimeline.tsx · … (10 en total) |
| 2026-08-01 | [`ab67c8d`](https://github.com/Doritozz05/Cubeforge/commit/ab67c8d) | sin clasificar | fix | apps/web/src/widgets/implementations/phase-balance/FloatingPhaseBalance.tsx · apps/web/src/widgets/implementations/phase-balance/phaseBalance.test.ts · apps/web/src/widgets/implementations/phase-balance/phaseBalance.ts · apps/web/src/widgets/implementations/solve-timeline/FloatingPhaseTimeline.tsx |
| 2026-08-01 | [`56ee8b1`](https://github.com/Doritozz05/Cubeforge/commit/56ee8b1) | sin clasificar | fixes | apps/web/src/widgets/components/PhaseSkipBadge.tsx · apps/web/src/widgets/implementations/phase-balance/FloatingPhaseBalance.tsx · apps/web/src/widgets/implementations/phase-balance/benchmarks.ts · apps/web/src/widgets/implementations/phase-balance/index.ts · … (7 en total) |
| 2026-08-01 | [`d6c08c0`](https://github.com/Doritozz05/Cubeforge/commit/d6c08c0) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/utils/solveAnalysisCoordinator.test.ts · apps/web/src/utils/solveAnalysisCoordinator.ts · apps/web/src/widgets/implementations/phase-balance/FloatingPhaseBalance.tsx |
| 2026-08-01 | [`e35f25d`](https://github.com/Doritozz05/Cubeforge/commit/e35f25d) | sin clasificar | Merge pull request #3 from Doritozz05/custom | — |
| 2026-08-01 | [`29e7fc0`](https://github.com/Doritozz05/Cubeforge/commit/29e7fc0) | sin clasificar | fix | apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/widgets/implementations/phase-balance/phaseBalance.ts · apps/web/src/widgets/implementations/solve-timeline/FloatingPhaseTimeline.tsx |
| 2026-08-01 | [`db56699`](https://github.com/Doritozz05/Cubeforge/commit/db56699) | sin clasificar | Update SessionStats.tsx | apps/web/src/components/Stats/SessionStats.tsx |
| 2026-08-01 | [`49f7297`](https://github.com/Doritozz05/Cubeforge/commit/49f7297) | sin clasificar | Update SessionStats.tsx | apps/web/src/components/Stats/SessionStats.tsx |
| 2026-08-01 | [`bb35d69`](https://github.com/Doritozz05/Cubeforge/commit/bb35d69) | sin clasificar | fix | apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Layout/sidebar.constants.ts |
| 2026-08-01 | [`853cbf6`](https://github.com/Doritozz05/Cubeforge/commit/853cbf6) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · … (33 en total) |
| 2026-08-01 | [`0c185f4`](https://github.com/Doritozz05/Cubeforge/commit/0c185f4) | sin clasificar | Update LeftSidebar.tsx | apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-08-01 | [`c207ae9`](https://github.com/Doritozz05/Cubeforge/commit/c207ae9) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Timer/TimerDisplay.tsx · … (5 en total) |
| 2026-08-01 | [`6b55c26`](https://github.com/Doritozz05/Cubeforge/commit/6b55c26) | sin clasificar | fase 3 | apps/web/index.html · apps/web/src/App.tsx · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/Header.tsx · … (40 en total) |
| 2026-08-01 | [`52ec2fc`](https://github.com/Doritozz05/Cubeforge/commit/52ec2fc) | sin clasificar | fase 4 | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/SkillNodeModal.tsx |
| 2026-08-01 | [`1d6545a`](https://github.com/Doritozz05/Cubeforge/commit/1d6545a) | sin clasificar | fase 5 | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx |
| 2026-08-01 | [`d197839`](https://github.com/Doritozz05/Cubeforge/commit/d197839) | sin clasificar | fase 6 | apps/web/src/components/Layout/Header.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/explorer/WidgetCard.tsx · apps/web/src/widgets/explorer/WidgetExplorer.tsx · … (6 en total) |
| 2026-08-01 | [`0f1c00d`](https://github.com/Doritozz05/Cubeforge/commit/0f1c00d) | sin clasificar | widget | apps/web/src/components/Layout/Header.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-08-01 | [`cad8ff4`](https://github.com/Doritozz05/Cubeforge/commit/cad8ff4) | sin clasificar | Update FloatingWidgetWrapper.tsx | apps/web/src/widgets/components/FloatingWidgetWrapper.tsx |
| 2026-08-01 | [`f0198a5`](https://github.com/Doritozz05/Cubeforge/commit/f0198a5) | sin clasificar | settings | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/SettingsSidebar.tsx · … (14 en total) |
| 2026-08-01 | [`218bedc`](https://github.com/Doritozz05/Cubeforge/commit/218bedc) | sin clasificar | fixes | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · packages/ui/src/components/dropdown-menu.tsx · packages/ui/src/components/select.tsx |
| 2026-08-01 | [`6361b54`](https://github.com/Doritozz05/Cubeforge/commit/6361b54) | sin clasificar | fixes | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-01 | [`229e2b9`](https://github.com/Doritozz05/Cubeforge/commit/229e2b9) | sin clasificar | fase 8 | apps/web/src/App.tsx · apps/web/src/components/Layout/MobileTabBar.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · apps/web/src/components/Timer/TimerContainer.tsx · … (9 en total) |
| 2026-08-01 | [`99be41f`](https://github.com/Doritozz05/Cubeforge/commit/99be41f) | sin clasificar | fixes | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/widgets/explorer/WidgetExplorer.tsx · packages/ui/src/components/select.tsx |
| 2026-08-01 | [`72fc13b`](https://github.com/Doritozz05/Cubeforge/commit/72fc13b) | sin clasificar | Update SkillGraphCanvas.tsx | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx |
| 2026-08-01 | [`62816a0`](https://github.com/Doritozz05/Cubeforge/commit/62816a0) | sin clasificar | fix | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/widgets/explorer/WidgetExplorer.tsx |
| 2026-08-01 | [`6bc51cd`](https://github.com/Doritozz05/Cubeforge/commit/6bc51cd) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/index.css |
| 2026-08-01 | [`4677b7a`](https://github.com/Doritozz05/Cubeforge/commit/4677b7a) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Layout/MobileMoreSheet.tsx · … (8 en total) |
| 2026-08-01 | [`1f2faf1`](https://github.com/Doritozz05/Cubeforge/commit/1f2faf1) | sin clasificar | fix | apps/web/src/widgets/implementations/cube-button/definition.ts · apps/web/src/widgets/implementations/scramble-2d/definition.ts · apps/web/src/widgets/implementations/times-log/definition.ts |
| 2026-08-01 | [`d646e5d`](https://github.com/Doritozz05/Cubeforge/commit/d646e5d) | sin clasificar | Update TouchPanel.tsx | apps/web/src/components/TouchPanel.tsx |
| 2026-08-01 | [`e53790a`](https://github.com/Doritozz05/Cubeforge/commit/e53790a) | sin clasificar | fixes | apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/UltraSkillTreeView.tsx |
| 2026-08-01 | [`d8412e7`](https://github.com/Doritozz05/Cubeforge/commit/d8412e7) | sin clasificar | Update UltraSkillTreeView.tsx | apps/web/src/views/SkillTree/UltraSkillTreeView.tsx |
| 2026-08-01 | [`3027734`](https://github.com/Doritozz05/Cubeforge/commit/3027734) | sin clasificar | Update LeftSidebar.tsx | apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-08-01 | [`8c378f4`](https://github.com/Doritozz05/Cubeforge/commit/8c378f4) | sin clasificar | fixes | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/components/Layout/MobileSessionSheet.tsx · … (10 en total) |
| 2026-08-01 | [`8b86b34`](https://github.com/Doritozz05/Cubeforge/commit/8b86b34) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-08-01 | [`ee20cbd`](https://github.com/Doritozz05/Cubeforge/commit/ee20cbd) | sin clasificar | Update SessionStats.tsx | apps/web/src/components/Stats/SessionStats.tsx |
| 2026-08-01 | [`d473dbc`](https://github.com/Doritozz05/Cubeforge/commit/d473dbc) | sin clasificar | Update LeftSidebar.tsx | apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-08-01 | [`4b873bf`](https://github.com/Doritozz05/Cubeforge/commit/4b873bf) | sin clasificar | Update tooltip.tsx | packages/ui/src/components/tooltip.tsx |
| 2026-08-01 | [`bdc4c5e`](https://github.com/Doritozz05/Cubeforge/commit/bdc4c5e) | sin clasificar | Merge pull request #4 from Doritozz05/android | — |
| 2026-08-01 | [`05dc2fe`](https://github.com/Doritozz05/Cubeforge/commit/05dc2fe) | sin clasificar | Update CubeConnector.tsx | apps/web/src/components/Hardware/CubeConnector.tsx |
| 2026-08-01 | [`060d28f`](https://github.com/Doritozz05/Cubeforge/commit/060d28f) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-01 | [`84c1914`](https://github.com/Doritozz05/Cubeforge/commit/84c1914) | sin clasificar | fix | apps/web/src/hooks/useCube3D.ts · apps/web/src/services/Global3DSnapshotService.ts · packages/cube-3d-engine/src/__tests__/SceneManager.edgeCases.test.ts · packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-08-01 | [`f251224`](https://github.com/Doritozz05/Cubeforge/commit/f251224) | sin clasificar | fix | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-01 | [`be44fb2`](https://github.com/Doritozz05/Cubeforge/commit/be44fb2) | sin clasificar | Update Cube3DPanel.tsx | apps/web/src/components/Cube3D/Cube3DPanel.tsx |

### v0.4.8 — PWA Deployment & COOP/COEP Headers / Despliegue PWA y cabeceras COOP/COEP — 2026-08-02 → 2026-08-02 — 26 commits

**Resumen:** Manifiesto PWA, caché offline con service worker y cabeceras de aislamiento de origen cruzado.

**Destacados:**
- PWA offline support with service worker asset caching and install prompts.
- Configured COOP and COEP cross-origin isolation headers for high-resolution SharedArrayBuffer timers.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-02 | [`93b7165`](https://github.com/Doritozz05/Cubeforge/commit/93b7165) | sin clasificar | fix grande | apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Settings/sections/DataSection.tsx · … (23 en total) |
| 2026-08-02 | [`6080774`](https://github.com/Doritozz05/Cubeforge/commit/6080774) | feat | feat(webgl): mitigate iOS Safari context-limit risk + sidebar layout polish | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/components/Settings/SettingsSidebar.tsx · apps/web/src/hooks/useCube3D.ts · … (14 en total) |
| 2026-08-02 | [`bda35ec`](https://github.com/Doritozz05/Cubeforge/commit/bda35ec) | sin clasificar | bd fix | apps/web/src/hooks/usePracticeSession.ts · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx · … (14 en total) |
| 2026-08-02 | [`dde652a`](https://github.com/Doritozz05/Cubeforge/commit/dde652a) | sin clasificar | fase 1 | apps/web/src/hooks/useTrainingProgress.ts · packages/database/src/__tests__/training.repository.test.ts · packages/database/src/migrations/migrations.ts · packages/database/src/repositories/training.repository.ts · … (9 en total) |
| 2026-08-02 | [`0b556d0`](https://github.com/Doritozz05/Cubeforge/commit/0b556d0) | sin clasificar | fase f | apps/web/src/hooks/useSRSQueue.ts · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/views/Training/SRSInsightsView.tsx · apps/web/src/views/Training/SRSReviewView.tsx · … (17 en total) |
| 2026-08-02 | [`59945b7`](https://github.com/Doritozz05/Cubeforge/commit/59945b7) | sin clasificar | fix | apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/views/Training/AlgorithmRecognizeView.tsx · apps/web/src/views/Training/SRSReviewView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx · … (7 en total) |
| 2026-08-02 | [`80ff54a`](https://github.com/Doritozz05/Cubeforge/commit/80ff54a) | sin clasificar | Update WidgetRegistry.ts | apps/web/src/widgets/WidgetRegistry.ts |
| 2026-08-02 | [`299e0dd`](https://github.com/Doritozz05/Cubeforge/commit/299e0dd) | sin clasificar | fixes | apps/web/src/hooks/usePracticeSession.ts · apps/web/src/hooks/useSRSQueue.ts · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/hooks/useTrainingSession.ts · … (19 en total) |
| 2026-08-02 | [`0c9c2f6`](https://github.com/Doritozz05/Cubeforge/commit/0c9c2f6) | sin clasificar | fixes | apps/web/src/hooks/usePersistentSession.ts · apps/web/src/hooks/useSkillProgress.ts · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/utils/env.ts · … (16 en total) |
| 2026-08-02 | [`d3247ec`](https://github.com/Doritozz05/Cubeforge/commit/d3247ec) | sin clasificar | fix | packages/database/src/repositories/training.repository.ts · packages/training/src/progress/insights.ts · packages/training/src/progress/progress-tracker.ts |
| 2026-08-02 | [`221dd5d`](https://github.com/Doritozz05/Cubeforge/commit/221dd5d) | sin clasificar | test | packages/database/src/__tests__/training.repository.test.ts · packages/training/src/progress/__tests__/insights.test.ts · packages/training/src/progress/__tests__/progress-tracker.test.ts · packages/training/src/progress/scheduler.ts |
| 2026-08-02 | [`891839f`](https://github.com/Doritozz05/Cubeforge/commit/891839f) | sin clasificar | fix | apps/web/src/views/Training/components/ReviewQueueSection.tsx · packages/algorithm-db/src/seed/index.ts · packages/database/src/__tests__/db.test.ts · packages/database/src/__tests__/training.repository.test.ts · … (6 en total) |
| 2026-08-02 | [`805a1a1`](https://github.com/Doritozz05/Cubeforge/commit/805a1a1) | sin clasificar | fix | apps/web/src/views/Training/TrainingDashboard.tsx · apps/web/src/views/Training/components/ReviewQueueSection.tsx |
| 2026-08-02 | [`f5f179d`](https://github.com/Doritozz05/Cubeforge/commit/f5f179d) | sin clasificar | fixes | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/BlindPracticeView.tsx · apps/web/src/views/Training/CrossCNView.tsx · apps/web/src/views/Training/CrossOptimalView.tsx · … (9 en total) |
| 2026-08-02 | [`fb36537`](https://github.com/Doritozz05/Cubeforge/commit/fb36537) | sin clasificar | Update SkillGraphCanvas.tsx | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx |
| 2026-08-02 | [`af0fbd8`](https://github.com/Doritozz05/Cubeforge/commit/af0fbd8) | sin clasificar | fix | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/views/Training/CrossCNView.tsx · apps/web/src/views/Training/CrossTrainerView.tsx |
| 2026-08-02 | [`fafe975`](https://github.com/Doritozz05/Cubeforge/commit/fafe975) | docs | Create Auditoria_Producto_2026-08.md | docs/00-product/Auditoria_Producto_2026-08.md |
| 2026-08-02 | [`c5ac143`](https://github.com/Doritozz05/Cubeforge/commit/c5ac143) | sin clasificar | removed imports | apps/web/src/widgets/explorer/WidgetExplorer.tsx · apps/web/src/widgets/loader/WidgetSandbox.tsx · apps/web/src/widgets/loader/index.ts · apps/web/src/widgets/loader/validators.ts |
| 2026-08-02 | [`f00d13a`](https://github.com/Doritozz05/Cubeforge/commit/f00d13a) | sin clasificar | fix | apps/web/src/widgets/explorer/WidgetExplorer.tsx · apps/web/src/widgets/registerAllWidgets.ts · apps/web/src/widgets/registry.ts · apps/web/src/widgets/widgetStore.migration.test.ts · … (5 en total) |
| 2026-08-02 | [`fd13fdd`](https://github.com/Doritozz05/Cubeforge/commit/fd13fdd) | sin clasificar | libraries | apps/web/package.json · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Timer/PbCelebrationBanner.tsx · … (12 en total) |
| 2026-08-02 | [`c6f13f4`](https://github.com/Doritozz05/Cubeforge/commit/c6f13f4) | sin clasificar | Update SessionStats.tsx | apps/web/src/components/Stats/SessionStats.tsx |
| 2026-08-02 | [`97ff5e4`](https://github.com/Doritozz05/Cubeforge/commit/97ff5e4) | sin clasificar | Update pbDetection.ts | apps/web/src/utils/pbDetection.ts |
| 2026-08-02 | [`5b5a598`](https://github.com/Doritozz05/Cubeforge/commit/5b5a598) | test | Update pbDetection.test.ts | apps/web/src/utils/__tests__/pbDetection.test.ts |
| 2026-08-02 | [`2a3e323`](https://github.com/Doritozz05/Cubeforge/commit/2a3e323) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/hooks/useSolveSession.ts |
| 2026-08-02 | [`d3de8b7`](https://github.com/Doritozz05/Cubeforge/commit/d3de8b7) | sin clasificar | limpieza knip | apps/desktop/package.json · apps/desktop/src/env.ts · apps/web/package.json · apps/web/src/App.css · … (34 en total) |
| 2026-08-02 | [`a6778ae`](https://github.com/Doritozz05/Cubeforge/commit/a6778ae) | sin clasificar | fixes | apps/desktop/src/database-override.ts · apps/web/src/views/Training/FullSolveView.tsx |

### v0.4.9 — Manual Focus Mode & Confirmation Dialogs / Modo foco manual y diálogos de borrado — 2026-08-03 → 2026-08-03 — 23 commits

**Resumen:** Modo foco que oculta elementos distractores al cronometrar y diálogos de confirmación de borrado.

**Destacados:**
- Manual focus mode dimming secondary panels to maximize attention on the timer.
- Destructive solve deletion protected by modal confirmation to prevent accidental loss.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-03 | [`f160592`](https://github.com/Doritozz05/Cubeforge/commit/f160592) | docs | Create README.md | docs/plan_profile/README.md |
| 2026-08-03 | [`2e7efd6`](https://github.com/Doritozz05/Cubeforge/commit/2e7efd6) | sin clasificar | init | apps/web/src/App.tsx · apps/web/src/hooks/useProfile.ts · docs/plan_profile/README.md · packages/database/src/__tests__/db.test.ts · … (14 en total) |
| 2026-08-03 | [`70290df`](https://github.com/Doritozz05/Cubeforge/commit/70290df) | sin clasificar | fase 1 | apps/desktop/package.json · apps/desktop/src/database-override.ts · apps/web/package.json · apps/web/src/App.tsx · … (24 en total) |
| 2026-08-03 | [`691896f`](https://github.com/Doritozz05/Cubeforge/commit/691896f) | sin clasificar | fase 1-4 | apps/web/src/components/Identity/IdenticonAvatar.tsx · apps/web/src/components/Identity/StatStrip.tsx · apps/web/src/hooks/useProfileStats.test.ts · apps/web/src/hooks/useProfileStats.ts · … (8 en total) |
| 2026-08-03 | [`ccaf7c6`](https://github.com/Doritozz05/Cubeforge/commit/ccaf7c6) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Identity/ProfileHero.tsx · apps/web/src/components/Identity/StatStrip.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · … (9 en total) |
| 2026-08-03 | [`28720b5`](https://github.com/Doritozz05/Cubeforge/commit/28720b5) | sin clasificar | fixes | apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Layout/MobileMoreSheet.tsx |
| 2026-08-03 | [`296154f`](https://github.com/Doritozz05/Cubeforge/commit/296154f) | sin clasificar | Merge pull request #5 from Doritozz05/profiles | — |
| 2026-08-03 | [`fc26e1b`](https://github.com/Doritozz05/Cubeforge/commit/fc26e1b) | sin clasificar | Update SessionStats.tsx | apps/web/src/components/Stats/SessionStats.tsx |
| 2026-08-03 | [`e24049d`](https://github.com/Doritozz05/Cubeforge/commit/e24049d) | sin clasificar | profile | apps/web/src/App.tsx · apps/web/src/components/Identity/IdenticonAvatar.tsx · apps/web/src/components/Identity/ProfileHero.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · … (10 en total) |
| 2026-08-03 | [`ce191f5`](https://github.com/Doritozz05/Cubeforge/commit/ce191f5) | sin clasificar | Update ProfileHero.tsx | apps/web/src/components/Identity/ProfileHero.tsx |
| 2026-08-03 | [`759d8d0`](https://github.com/Doritozz05/Cubeforge/commit/759d8d0) | sin clasificar | fix | apps/web/src/components/Identity/IdenticonAvatar.tsx · apps/web/src/components/Settings/sections/ProfileSection.tsx · apps/web/src/hooks/useProfile.ts · apps/web/src/utils/processAvatarImage.ts · … (10 en total) |
| 2026-08-03 | [`c7b08a3`](https://github.com/Doritozz05/Cubeforge/commit/c7b08a3) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-03 | [`cb8bf05`](https://github.com/Doritozz05/Cubeforge/commit/cb8bf05) | sin clasificar | Update LeftSidebar.tsx | apps/web/src/components/Layout/LeftSidebar.tsx |
| 2026-08-03 | [`d730c23`](https://github.com/Doritozz05/Cubeforge/commit/d730c23) | docs | Create REFACTOR_PLAN.md | docs/plan_training/REFACTOR_PLAN.md |
| 2026-08-03 | [`012178a`](https://github.com/Doritozz05/Cubeforge/commit/012178a) | docs | Update REFACTOR_PLAN.md | docs/plan_training/REFACTOR_PLAN.md |
| 2026-08-03 | [`ee95e72`](https://github.com/Doritozz05/Cubeforge/commit/ee95e72) | docs | Update REFACTOR_PLAN.md | docs/plan_training/REFACTOR_PLAN.md |
| 2026-08-03 | [`2db4da5`](https://github.com/Doritozz05/Cubeforge/commit/2db4da5) | feat | feat(web): persist puzzle selection and stats options in localStorage | apps/web/src/App.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/views/Training/FullSolveView.tsx · … (5 en total) |
| 2026-08-03 | [`0d5b0d6`](https://github.com/Doritozz05/Cubeforge/commit/0d5b0d6) | sin clasificar | fix | packages/training/src/index.ts · packages/training/src/progress/__tests__/insights.test.ts · packages/training/src/progress/__tests__/metrics-invariance.test.ts · packages/training/src/progress/__tests__/scheduler.test.ts · … (6 en total) |
| 2026-08-03 | [`01a37b7`](https://github.com/Doritozz05/Cubeforge/commit/01a37b7) | sin clasificar | push | apps/desktop/package.json · apps/desktop/src/database-override.ts · apps/web/src/hooks/useDrillTimer.ts · apps/web/src/hooks/usePersistentSession.ts · … (52 en total) |
| 2026-08-03 | [`354dc5b`](https://github.com/Doritozz05/Cubeforge/commit/354dc5b) | sin clasificar | fix | apps/desktop/src/database-override.ts · apps/web/src/hooks/useTrainingEngine.ts · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/stores/storageStatus.ts · … (36 en total) |
| 2026-08-03 | [`c231766`](https://github.com/Doritozz05/Cubeforge/commit/c231766) | sin clasificar | fix | apps/web/src/hooks/usePracticeSession.ts · apps/web/src/hooks/useTrainingEngine.ts · docs/plan_training/README.md · docs/plan_training/REFACTOR_PLAN.md |
| 2026-08-03 | [`2ec83b8`](https://github.com/Doritozz05/Cubeforge/commit/2ec83b8) | sin clasificar | fixes | apps/web/src/hooks/useTrainingEngine.ts · packages/database/src/migrations/migrations.ts · packages/database/src/repositories/training.repository.ts · packages/training/src/progress/__tests__/progress-tracker.test.ts · … (8 en total) |
| 2026-08-03 | [`7212dcf`](https://github.com/Doritozz05/Cubeforge/commit/7212dcf) | test | Update progress-tracker.test.ts | packages/training/src/progress/__tests__/progress-tracker.test.ts |

### v0.5.0 — Typed i18n Foundation & Bilingual Support / Infraestructura i18n tipada y bilingüe — 2026-08-04 → 2026-08-05 — 71 commits

**Resumen:** Infraestructura bilingüe completa (español e inglés) con claves de traducción estrictamente tipadas.

**Destacados:**
- Typed internationalization (i18n) foundation with Spanish and English translations.
- Dynamic language switcher updating all active panels, timers and tooltips instantly.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-04 | [`10f4f98`](https://github.com/Doritozz05/Cubeforge/commit/10f4f98) | sin clasificar | Update .gitignore | .gitignore |
| 2026-08-04 | [`813ee6b`](https://github.com/Doritozz05/Cubeforge/commit/813ee6b) | sin clasificar | Update .gitignore | .gitignore |
| 2026-08-04 | [`324f5ac`](https://github.com/Doritozz05/Cubeforge/commit/324f5ac) | docs | Create PRODUCT.md | PRODUCT.md |
| 2026-08-04 | [`f0fff40`](https://github.com/Doritozz05/Cubeforge/commit/f0fff40) | docs | Create DESIGN.md | DESIGN.md |
| 2026-08-04 | [`70ae6aa`](https://github.com/Doritozz05/Cubeforge/commit/70ae6aa) | sin clasificar | Update .gitignore | .gitignore |
| 2026-08-04 | [`0369497`](https://github.com/Doritozz05/Cubeforge/commit/0369497) | sin clasificar | fixes | DESIGN.md · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/components/Identity/StatStrip.tsx · … (18 en total) |
| 2026-08-04 | [`51fa7b7`](https://github.com/Doritozz05/Cubeforge/commit/51fa7b7) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-08-04 | [`ef43ec9`](https://github.com/Doritozz05/Cubeforge/commit/ef43ec9) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-08-04 | [`38220a4`](https://github.com/Doritozz05/Cubeforge/commit/38220a4) | docs | Create README.md | docs/plan_onboarding/README.md |
| 2026-08-04 | [`dc73dc8`](https://github.com/Doritozz05/Cubeforge/commit/dc73dc8) | sin clasificar | onboarding | apps/desktop/src/database-override.ts · apps/web/src/App.tsx · apps/web/src/components/Identity/ProfileHero.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · … (21 en total) |
| 2026-08-04 | [`31e94b8`](https://github.com/Doritozz05/Cubeforge/commit/31e94b8) | docs | Update README.md | docs/plan_onboarding/README.md |
| 2026-08-04 | [`a34d83e`](https://github.com/Doritozz05/Cubeforge/commit/a34d83e) | sin clasificar | fix | apps/web/src/components/Onboarding/OnboardingSpotlight.tsx · apps/web/src/components/Onboarding/OnboardingTour.tsx · apps/web/src/components/Onboarding/TourTooltip.tsx · docs/05-tdd/TDD-0020-Onboarding-Tour.md |
| 2026-08-04 | [`1aff93a`](https://github.com/Doritozz05/Cubeforge/commit/1aff93a) | sin clasificar | fix | apps/web/src/components/Onboarding/OnboardingTour.tsx · apps/web/src/hooks/useOnboarding.ts · docs/05-tdd/TDD-0020-Onboarding-Tour.md |
| 2026-08-04 | [`14b9625`](https://github.com/Doritozz05/Cubeforge/commit/14b9625) | sin clasificar | Update ProfileView.tsx | apps/web/src/views/Profile/ProfileView.tsx |
| 2026-08-04 | [`2e0f577`](https://github.com/Doritozz05/Cubeforge/commit/2e0f577) | sin clasificar | fix | apps/desktop/src/database-override.ts · apps/web/src/App.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · … (11 en total) |
| 2026-08-04 | [`473432c`](https://github.com/Doritozz05/Cubeforge/commit/473432c) | sin clasificar | Update catalog.ts | packages/training/src/exercises/catalog.ts |
| 2026-08-04 | [`dc7ba2c`](https://github.com/Doritozz05/Cubeforge/commit/dc7ba2c) | sin clasificar | Update useTrainingEngine.ts | apps/web/src/hooks/useTrainingEngine.ts |
| 2026-08-04 | [`4ae127a`](https://github.com/Doritozz05/Cubeforge/commit/4ae127a) | sin clasificar | Merge pull request #7 from Doritozz05/bd-training | — |
| 2026-08-04 | [`cd05532`](https://github.com/Doritozz05/Cubeforge/commit/cd05532) | refactor | refactor(web): split App into hooks and stage components | apps/web/src/App.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/StageOverlays.tsx · apps/web/src/components/Layout/appShell.types.ts · … (15 en total) |
| 2026-08-04 | [`bbbe2ea`](https://github.com/Doritozz05/Cubeforge/commit/bbbe2ea) | fix | fix(database): transactional imports and ordered merge | apps/web/src/hooks/usePersistentSession.ts · packages/database/src/__tests__/db.test.ts · packages/database/src/repositories/solves.repository.ts |
| 2026-08-04 | [`a741bf0`](https://github.com/Doritozz05/Cubeforge/commit/a741bf0) | fix | fix(web): sanitize formula exports and bound snapshot cache | apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/utils/__tests__/exportSolves.test.ts · apps/web/src/utils/__tests__/importSolves.test.ts · apps/web/src/utils/exportSolves.ts · … (5 en total) |
| 2026-08-04 | [`904ec2f`](https://github.com/Doritozz05/Cubeforge/commit/904ec2f) | fix | fix(web): add CSP headers and gate demo helpers | apps/web/index.html · apps/web/public/theme-color.js · apps/web/src/utils/seedDemoData.ts · apps/web/vite.config.ts · … (5 en total) |
| 2026-08-04 | [`b0160ee`](https://github.com/Doritozz05/Cubeforge/commit/b0160ee) | fix | fix(desktop): disable updater and harden CSP | apps/desktop/src-tauri/Cargo.lock · apps/desktop/src-tauri/Cargo.toml · apps/desktop/src-tauri/capabilities/default.json · apps/desktop/src-tauri/gen/schemas/acl-manifests.json · … (12 en total) |
| 2026-08-04 | [`f5fe6d5`](https://github.com/Doritozz05/Cubeforge/commit/f5fe6d5) | chore | chore(tooling): enforce conventional commits and raise line limit | .github/workflows/ci.yml · .github/workflows/quality-gates.yml · .gitignore · .husky/commit-msg · … (12 en total) |
| 2026-08-04 | [`b1640a5`](https://github.com/Doritozz05/Cubeforge/commit/b1640a5) | chore | chore(test): translate comments to English | apps/web/src/views/SkillTree/UltraSkillTreeView.tsx · packages/analysis-engine/src/__tests__/EfficiencyCalculator.edgeCases.test.ts · packages/cube-3d-engine/src/__tests__/CubeModel.edgeCases.test.ts · packages/cube-3d-engine/src/__tests__/SceneManager.edgeCases.test.ts · … (11 en total) |
| 2026-08-04 | [`542ee51`](https://github.com/Doritozz05/Cubeforge/commit/542ee51) | test | test(database): add real-engine import smoke test | packages/database/src/__tests__/db.realEngine.smoke.test.ts |
| 2026-08-04 | [`3cbfe4a`](https://github.com/Doritozz05/Cubeforge/commit/3cbfe4a) | perf | perf(web): lazy-load stage views and split vendor chunks | apps/web/src/components/Stage/MainStage.tsx · apps/web/vite.config.ts |
| 2026-08-04 | [`38a6f5e`](https://github.com/Doritozz05/Cubeforge/commit/38a6f5e) | perf | perf(database): count solves per session in one GROUP BY query | apps/web/src/hooks/usePersistentSession.ts · packages/database/src/__tests__/db.realEngine.smoke.test.ts · packages/database/src/repositories/solves.repository.ts |
| 2026-08-04 | [`d728070`](https://github.com/Doritozz05/Cubeforge/commit/d728070) | chore | chore(git): allow local commitlint bypass via SKIP_COMMITLINT | .husky/commit-msg · docs/08-standards/Git_Workflow.md |
| 2026-08-04 | [`391282d`](https://github.com/Doritozz05/Cubeforge/commit/391282d) | perf | perf(database): batch import inserts into multi-row statements | packages/database/src/__tests__/db.realEngine.smoke.test.ts · packages/database/src/__tests__/db.test.ts · packages/database/src/repositories/solves.repository.ts |
| 2026-08-04 | [`725ddcd`](https://github.com/Doritozz05/Cubeforge/commit/725ddcd) | chore | chore(git): remove commitlint gates from CI and local hook | .github/workflows/quality-gates.yml · .husky/commit-msg · docs/08-standards/Git_Workflow.md |
| 2026-08-04 | [`033dabd`](https://github.com/Doritozz05/Cubeforge/commit/033dabd) | sin clasificar | zoom and scramble | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/hooks/useCube3D.ts · packages/cube-3d-engine/src/__tests__/SceneManager.edgeCases.test.ts · packages/cube-3d-engine/src/__tests__/ScrambleAnimator.test.ts · … (8 en total) |
| 2026-08-04 | [`4aaace9`](https://github.com/Doritozz05/Cubeforge/commit/4aaace9) | sin clasificar | Update useCube3D.ts | apps/web/src/hooks/useCube3D.ts |
| 2026-08-04 | [`e88f45d`](https://github.com/Doritozz05/Cubeforge/commit/e88f45d) | sin clasificar | Update Cube3DEngine.ts | packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-08-04 | [`a9de4dd`](https://github.com/Doritozz05/Cubeforge/commit/a9de4dd) | refactor | refactor: zoom and animations | packages/cube-3d-engine/src/__tests__/Cube3DEngine.test.ts · packages/cube-3d-engine/src/__tests__/SceneManager.edgeCases.test.ts · packages/cube-3d-engine/src/core/CubeMeshFactory.ts · packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-08-04 | [`ea651f4`](https://github.com/Doritozz05/Cubeforge/commit/ea651f4) | sin clasificar | Update Header.tsx | apps/web/src/components/Layout/Header.tsx |
| 2026-08-04 | [`84a94f3`](https://github.com/Doritozz05/Cubeforge/commit/84a94f3) | sin clasificar | Update PracticeDashboard.tsx | apps/web/src/views/Practice/PracticeDashboard.tsx |
| 2026-08-04 | [`e985814`](https://github.com/Doritozz05/Cubeforge/commit/e985814) | sin clasificar | fix | apps/web/src/components/Layout/MobileTabBar.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/components/Onboarding/tourSteps.ts · apps/web/src/components/Stage/MainStage.tsx · … (24 en total) |
| 2026-08-04 | [`8e20654`](https://github.com/Doritozz05/Cubeforge/commit/8e20654) | sin clasificar | hide stats | apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Stage/TimerStage.tsx · packages/state/src/__tests__/state.test.ts · packages/state/src/store.ts |
| 2026-08-04 | [`a5df062`](https://github.com/Doritozz05/Cubeforge/commit/a5df062) | sin clasificar | theme mpved | apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx |
| 2026-08-05 | [`38c00c7`](https://github.com/Doritozz05/Cubeforge/commit/38c00c7) | sin clasificar | Update OnboardingTour.tsx | apps/web/src/components/Onboarding/OnboardingTour.tsx |
| 2026-08-05 | [`4df08a2`](https://github.com/Doritozz05/Cubeforge/commit/4df08a2) | sin clasificar | Update OnboardingTour.tsx | apps/web/src/components/Onboarding/OnboardingTour.tsx |
| 2026-08-05 | [`3a3db80`](https://github.com/Doritozz05/Cubeforge/commit/3a3db80) | sin clasificar | fix | apps/web/src/components/Onboarding/OnboardingTour.tsx · apps/web/src/components/Onboarding/TourTooltip.tsx |
| 2026-08-05 | [`b4e3956`](https://github.com/Doritozz05/Cubeforge/commit/b4e3956) | sin clasificar | settings | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Identity/CountryFlag.tsx · apps/web/src/components/Identity/ProfileHero.tsx · … (22 en total) |
| 2026-08-05 | [`3ce819a`](https://github.com/Doritozz05/Cubeforge/commit/3ce819a) | sin clasificar | Update ProfileHero.tsx | apps/web/src/components/Identity/ProfileHero.tsx |
| 2026-08-05 | [`8cf6651`](https://github.com/Doritozz05/Cubeforge/commit/8cf6651) | sin clasificar | refactor chunking and widgets | apps/web/package.json · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/lib/utils.ts · … (21 en total) |
| 2026-08-05 | [`3566bf6`](https://github.com/Doritozz05/Cubeforge/commit/3566bf6) | sin clasificar | fix | apps/desktop/src/database-override.ts · apps/web/src/components/Insights/InsightsDashboard.tsx · packages/database/src/__tests__/restore.test.ts · packages/database/src/migrations/restore.ts · … (5 en total) |
| 2026-08-05 | [`d7991eb`](https://github.com/Doritozz05/Cubeforge/commit/d7991eb) | test | Update restore.test.ts | packages/database/src/__tests__/restore.test.ts |
| 2026-08-05 | [`a157a6b`](https://github.com/Doritozz05/Cubeforge/commit/a157a6b) | sin clasificar | fix | apps/desktop/src/database-override.ts · packages/database/src/worker.ts |
| 2026-08-05 | [`4615e28`](https://github.com/Doritozz05/Cubeforge/commit/4615e28) | sin clasificar | spinner | apps/web/index.html · apps/web/src/components/Layout/MobileTabBar.tsx · apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Settings/sections/ProfileSection.tsx · … (10 en total) |
| 2026-08-05 | [`9d25695`](https://github.com/Doritozz05/Cubeforge/commit/9d25695) | sin clasificar | fix | apps/web/index.html · apps/web/public/theme-bootstrap.js · apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Stage/MainStage.tsx · … (5 en total) |
| 2026-08-05 | [`56efc20`](https://github.com/Doritozz05/Cubeforge/commit/56efc20) | sin clasificar | llm | apps/web/public/llms.txt · apps/web/public/robots.txt · apps/web/public/sitemap.xml · vercel.json |
| 2026-08-05 | [`9fcc781`](https://github.com/Doritozz05/Cubeforge/commit/9fcc781) | sin clasificar | fix | packages/database/src/__tests__/migrations.test.ts · packages/database/src/migrations/migrations.ts · packages/database/src/worker.ts |
| 2026-08-05 | [`76f5b41`](https://github.com/Doritozz05/Cubeforge/commit/76f5b41) | sin clasificar | fix | apps/desktop/src/database-override.ts · packages/database/src/__tests__/migrations.execution.test.ts · packages/database/src/migrations/migrations.ts |
| 2026-08-05 | [`bb4c8e7`](https://github.com/Doritozz05/Cubeforge/commit/bb4c8e7) | test | Update migrations.execution.test.ts | packages/database/src/__tests__/migrations.execution.test.ts |
| 2026-08-05 | [`eac6d53`](https://github.com/Doritozz05/Cubeforge/commit/eac6d53) | sin clasificar | fix | apps/web/src/components/Onboarding/OnboardingTour.tsx · apps/web/src/components/Settings/sections/DataSection.tsx |
| 2026-08-05 | [`484ebf3`](https://github.com/Doritozz05/Cubeforge/commit/484ebf3) | sin clasificar | Update theme-bootstrap.js | apps/web/public/theme-bootstrap.js |
| 2026-08-05 | [`f4358c1`](https://github.com/Doritozz05/Cubeforge/commit/f4358c1) | sin clasificar | Merge pull request #8 from Doritozz05/refactor | — |
| 2026-08-05 | [`d839930`](https://github.com/Doritozz05/Cubeforge/commit/d839930) | sin clasificar | notes | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-08-05 | [`f2d546b`](https://github.com/Doritozz05/Cubeforge/commit/f2d546b) | sin clasificar | Merge pull request #9 from Doritozz05/refactor | — |
| 2026-08-05 | [`b3c81fe`](https://github.com/Doritozz05/Cubeforge/commit/b3c81fe) | sin clasificar | Update switch.tsx | packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`c29fc8a`](https://github.com/Doritozz05/Cubeforge/commit/c29fc8a) | sin clasificar | Update switch.tsx | packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`845d0a0`](https://github.com/Doritozz05/Cubeforge/commit/845d0a0) | sin clasificar | fix | apps/web/src/components/Settings/components/SettingToggle.tsx · apps/web/src/components/Settings/sections/NotificationsSection.tsx · apps/web/src/hooks/use-mobile.ts · apps/web/src/widgets/explorer/WidgetCard.tsx · … (5 en total) |
| 2026-08-05 | [`9b25c70`](https://github.com/Doritozz05/Cubeforge/commit/9b25c70) | sin clasificar | fix | apps/web/src/components/Settings/components/SettingToggle.tsx · packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`daa0dfe`](https://github.com/Doritozz05/Cubeforge/commit/daa0dfe) | sin clasificar | fix | apps/web/src/components/Settings/components/SettingToggle.tsx · apps/web/src/components/Settings/sections/NotificationsSection.tsx · apps/web/src/widgets/explorer/WidgetCard.tsx · packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`59e806d`](https://github.com/Doritozz05/Cubeforge/commit/59e806d) | sin clasificar | fix | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/AdvancedSection.tsx · apps/web/src/components/Settings/sections/AnalysisSection.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · … (6 en total) |
| 2026-08-05 | [`8be6ee7`](https://github.com/Doritozz05/Cubeforge/commit/8be6ee7) | sin clasificar | Update switch.tsx | packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`9bca3dc`](https://github.com/Doritozz05/Cubeforge/commit/9bca3dc) | sin clasificar | pill | packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`82748ae`](https://github.com/Doritozz05/Cubeforge/commit/82748ae) | sin clasificar | fix | apps/web/src/components/Settings/components/SettingToggle.tsx · packages/ui/src/components/switch.tsx |
| 2026-08-05 | [`2f8d101`](https://github.com/Doritozz05/Cubeforge/commit/2f8d101) | sin clasificar | Update ProfileHero.tsx | apps/web/src/components/Identity/ProfileHero.tsx |
| 2026-08-05 | [`dcf6260`](https://github.com/Doritozz05/Cubeforge/commit/dcf6260) | sin clasificar | fix | apps/web/index.html · apps/web/src/index.css |

### v0.5.1 — Configurable Precision & Timer Preferences / Precisión configurable y preferencias — 2026-08-05 → 2026-08-05 — 0 commits

**Resumen:** Selector de precisión decimal (0.00 vs 0.000), control de inicio por espacio y avisos de audio.

**Destacados:**
- Configurable decimal display precision (2 decimal places 0.00 vs 3 decimal places 0.000).
- Timer start key configuration (Spacebar, Any Key, or Touch Only).

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.5.2 — SCDB Seed Merge & COLL/WV Algorithms / Integración SCDB y algoritmos COLL/WV — 2026-08-06 → 2026-08-06 — 18 commits

**Resumen:** Fusión de bases de algoritmos de SpeedSolving y SCDB incluyendo sets de COLL y Winter Variation.

**Destacados:**
- Merged SpeedSolving and SCDB algorithm databases with COLL and Winter Variation (WV) sets.
- Deduplicated algorithm triggers showing community popularity rankings.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-06 | [`ad54b5b`](https://github.com/Doritozz05/Cubeforge/commit/ad54b5b) | sin clasificar | Update ProfileHero.tsx | apps/web/src/components/Identity/ProfileHero.tsx |
| 2026-08-06 | [`d288a39`](https://github.com/Doritozz05/Cubeforge/commit/d288a39) | sin clasificar | Update ProfileHero.tsx | apps/web/src/components/Identity/ProfileHero.tsx |
| 2026-08-06 | [`7817017`](https://github.com/Doritozz05/Cubeforge/commit/7817017) | sin clasificar | Update ProfileHero.tsx | apps/web/src/components/Identity/ProfileHero.tsx |
| 2026-08-06 | [`e258498`](https://github.com/Doritozz05/Cubeforge/commit/e258498) | sin clasificar | manual entry improved | apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Stats/ManualSolveSheet.tsx · apps/web/src/components/Timer/ManualTimeInput.tsx · apps/web/src/hooks/useManualSolves.ts · … (6 en total) |
| 2026-08-06 | [`276885d`](https://github.com/Doritozz05/Cubeforge/commit/276885d) | sin clasificar | fix | apps/web/src/components/Stats/ManualSolveSheet.tsx · packages/solver-engine/src/__tests__/determinism.test.ts · packages/solver-engine/src/__tests__/stress-load.test.ts |
| 2026-08-06 | [`b7fcf03`](https://github.com/Doritozz05/Cubeforge/commit/b7fcf03) | sin clasificar | color | apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/index.css |
| 2026-08-06 | [`3fd6790`](https://github.com/Doritozz05/Cubeforge/commit/3fd6790) | sin clasificar | color | apps/web/src/index.css · apps/web/src/widgets/implementations/phase-balance/PhaseBalancePreview.tsx |
| 2026-08-06 | [`a6e0f01`](https://github.com/Doritozz05/Cubeforge/commit/a6e0f01) | sin clasificar | fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-08-06 | [`e96e923`](https://github.com/Doritozz05/Cubeforge/commit/e96e923) | test | fix | packages/algorithm-db/src/__tests__/oll-speedcubedb-comparison.test.ts · packages/algorithm-db/src/__tests__/pll-speedcubedb-comparison.test.ts · packages/algorithm-db/src/__tests__/scdb-import-comparison.test.ts |
| 2026-08-06 | [`0703d69`](https://github.com/Doritozz05/Cubeforge/commit/0703d69) | test | algs | packages/algorithm-db/src/__tests__/scdb-alg-verification.test.ts · packages/solver-engine/src/__tests__/_oracle.test.ts |
| 2026-08-06 | [`44851c7`](https://github.com/Doritozz05/Cubeforge/commit/44851c7) | test | fix | packages/algorithm-db/src/__tests__/scdb-alg-verification.test.ts · packages/solver-engine/src/__tests__/_cmll_oracle.test.ts |
| 2026-08-06 | [`da342c6`](https://github.com/Doritozz05/Cubeforge/commit/da342c6) | sin clasificar | Add SCDB seed merge with COLL and WV data | apps/web/src/views/Algorithms/components/Case3DPanel.tsx · packages/algorithm-db/src/__tests__/caseVerifier.test.ts · packages/algorithm-db/src/__tests__/scdb-alg-verification.test.ts · packages/algorithm-db/src/__tests__/scdb-dump-seed-catalog.test.ts · … (15 en total) |
| 2026-08-06 | [`25abaa8`](https://github.com/Doritozz05/Cubeforge/commit/25abaa8) | sin clasificar | fix | apps/web/src/services/Global3DSnapshotService.ts · packages/algorithm-db/src/visualization/casePresentation.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-08-06 | [`042408e`](https://github.com/Doritozz05/Cubeforge/commit/042408e) | sin clasificar | fix | apps/web/src/views/Algorithms/components/CaseDetailPanel.tsx · apps/web/src/views/Algorithms/components/CaseDiagram.tsx · apps/web/src/views/Algorithms/components/CaseGrid.tsx · apps/web/src/views/Training/AlgorithmDrillView.tsx · … (11 en total) |
| 2026-08-06 | [`f0554af`](https://github.com/Doritozz05/Cubeforge/commit/f0554af) | sin clasificar | fix | apps/web/src/views/Training/components/DashboardSections.tsx · packages/algorithm-db/src/__tests__/methodRegistry.test.ts · packages/algorithm-db/src/__tests__/scdb-alg-verification.test.ts · packages/algorithm-db/src/__tests__/scdb-seed-catalog.test.ts · … (11 en total) |
| 2026-08-06 | [`e468a0e`](https://github.com/Doritozz05/Cubeforge/commit/e468a0e) | sin clasificar | Update DashboardSections.tsx | apps/web/src/views/Training/components/DashboardSections.tsx |
| 2026-08-06 | [`a06016a`](https://github.com/Doritozz05/Cubeforge/commit/a06016a) | sin clasificar | birdf2l | packages/algorithm-db/src/__tests__/f2l.test.ts · packages/algorithm-db/src/__tests__/scdb-alg-verification.test.ts · packages/algorithm-db/src/__tests__/scdb-import-comparison.test.ts · packages/algorithm-db/src/__tests__/scdb-seed-catalog.test.ts · … (9 en total) |
| 2026-08-06 | [`ef938f0`](https://github.com/Doritozz05/Cubeforge/commit/ef938f0) | sin clasificar | fix | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/hooks/useCube3D.ts · apps/web/src/services/Case3DRenderAdapter.ts · … (10 en total) |

### v0.5.3 — BirdF2L Advanced Notation Codes / Códigos de notación avanzada BirdF2L — 2026-08-06 → 2026-08-06 — 0 commits

**Resumen:** Códigos de notación corta BirdF2L en casos básicos y avanzados con rotación de slot.

**Destacados:**
- BirdF2L notation code system integrated across all F2L case recognition cards.
- Rotatable slot perspective view for inspecting F2L cases from any angle.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.5.4 — Automated Case Verification Pipeline / Pipeline de verificación de casos — 2026-08-07 → 2026-08-07 — 21 commits

**Resumen:** Suite de tests automatizada que verifica la exactitud matemática de cada algoritmo e inversa.

**Destacados:**
- Automated algorithm verification verifying 100% of cases solve into expected states.
- Corrected inverse scramble setups for complex OLL dot cases and F2L awkward insertions.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-07 | [`93b9f8a`](https://github.com/Doritozz05/Cubeforge/commit/93b9f8a) | sin clasificar | Update cfop-f2l.ts | packages/algorithm-db/src/seed/cfop-f2l.ts |
| 2026-08-07 | [`713e614`](https://github.com/Doritozz05/Cubeforge/commit/713e614) | sin clasificar | fix | packages/algorithm-db/src/__tests__/casePresentation.test.ts · packages/algorithm-db/src/visualization/casePresentation.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-08-07 | [`d68ccf5`](https://github.com/Doritozz05/Cubeforge/commit/d68ccf5) | sin clasificar | Update CaseGrid.tsx | apps/web/src/views/Algorithms/components/CaseGrid.tsx |
| 2026-08-07 | [`cfe9044`](https://github.com/Doritozz05/Cubeforge/commit/cfe9044) | sin clasificar | fix | packages/analysis-engine/src/phases/PhaseSplitter.ts · packages/math-core/src/CubeState.ts · packages/math-core/src/FaceletStringConverter.ts · packages/math-core/src/__tests__/CubeState.extendedMoves.test.ts · … (7 en total) |
| 2026-08-07 | [`7c4515f`](https://github.com/Doritozz05/Cubeforge/commit/7c4515f) | sin clasificar | fix | apps/web/src/App.tsx · apps/web/src/hooks/useSessionActions.ts |
| 2026-08-07 | [`48150b5`](https://github.com/Doritozz05/Cubeforge/commit/48150b5) | sin clasificar | recognition | packages/algorithm-db/src/__tests__/recognition/f2l-invariance.test.ts · packages/algorithm-db/src/__tests__/recognition/moveNotation.test.ts · packages/algorithm-db/src/__tests__/recognition/ollPll-recognition.test.ts · packages/algorithm-db/src/__tests__/recognition/reconstruction-2510.test.ts · … (12 en total) |
| 2026-08-07 | [`62e8171`](https://github.com/Doritozz05/Cubeforge/commit/62e8171) | sin clasificar | fix | packages/algorithm-db/src/__tests__/recognition/reconstruction-2510.test.ts · packages/algorithm-db/src/__tests__/scdb-alg-verification.test.ts · packages/algorithm-db/src/recognition/reconstructionAnalyzer.ts · packages/algorithm-db/src/seed/cfop-antipll.ts · … (12 en total) |
| 2026-08-07 | [`4630a96`](https://github.com/Doritozz05/Cubeforge/commit/4630a96) | sin clasificar | fix | apps/web/public/reconstructions/data/chunk-000.json · apps/web/public/reconstructions/data/chunk-001.json · apps/web/public/reconstructions/data/chunk-002.json · apps/web/public/reconstructions/data/chunk-003.json · … (55 en total) |
| 2026-08-07 | [`12f570d`](https://github.com/Doritozz05/Cubeforge/commit/12f570d) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/views/Reconstructions/reconData.ts · apps/web/src/views/Training/CrossTrainerView.tsx · … (7 en total) |
| 2026-08-07 | [`47e1a79`](https://github.com/Doritozz05/Cubeforge/commit/47e1a79) | sin clasificar | fix | apps/web/src/views/Reconstructions/reconData.ts · docs/plan_reconstruction/README.md · packages/algorithm-db/src/__tests__/recognition/moveNotation.test.ts · packages/algorithm-db/src/recognition/moveNotation.ts |
| 2026-08-07 | [`2400570`](https://github.com/Doritozz05/Cubeforge/commit/2400570) | sin clasificar | clean | docs/plan_reconstruction/README.md · knip.jsonc · packages/algorithm-db/src/__tests__/recognition/f2l-invariance.test.ts · packages/algorithm-db/src/__tests__/recognition/ollPll-recognition.test.ts · … (30 en total) |
| 2026-08-07 | [`c7bd32c`](https://github.com/Doritozz05/Cubeforge/commit/c7bd32c) | sin clasificar | dates | apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · apps/web/src/views/Reconstructions/ReconstructionsView.tsx |
| 2026-08-07 | [`d32982f`](https://github.com/Doritozz05/Cubeforge/commit/d32982f) | sin clasificar | fix | apps/web/src/views/Reconstructions/reconData.ts · docs/plan_reconstruction/README.md · packages/math-core/src/__tests__/conjugateToBaseFrame.test.ts · packages/math-core/src/index.ts · … (7 en total) |
| 2026-08-07 | [`a79f8fd`](https://github.com/Doritozz05/Cubeforge/commit/a79f8fd) | sin clasificar | fix | apps/web/src/views/Reconstructions/reconData.ts · packages/math-core/src/__tests__/conjugateToBaseFrame.test.ts · packages/math-core/src/notation/conjugateToBaseFrame.ts |
| 2026-08-07 | [`8eabddc`](https://github.com/Doritozz05/Cubeforge/commit/8eabddc) | sin clasificar | fix | apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · apps/web/src/views/Reconstructions/reconData.ts · packages/math-core/src/__tests__/_bulk-recon.test.ts · packages/math-core/src/__tests__/conjugateToBaseFrame.test.ts · … (5 en total) |
| 2026-08-07 | [`c81e01b`](https://github.com/Doritozz05/Cubeforge/commit/c81e01b) | sin clasificar | fixes | apps/web/src/views/Reconstructions/reconData.ts · docs/plan_reconstruction/README.md · packages/math-core/src/__tests__/_bulk-recon.test.ts · packages/math-core/src/__tests__/moveNotation.test.ts · … (5 en total) |
| 2026-08-07 | [`a213299`](https://github.com/Doritozz05/Cubeforge/commit/a213299) | sin clasificar | Xcross | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · docs/plan_reconstruction/README.md · packages/analysis-engine/src/__tests__/PhaseSplitter.xcross.test.ts · packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts · … (10 en total) |
| 2026-08-07 | [`c144636`](https://github.com/Doritozz05/Cubeforge/commit/c144636) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-07 | [`390b632`](https://github.com/Doritozz05/Cubeforge/commit/390b632) | sin clasificar | fase 2 | docs/plan_reconstruction/README.md · packages/analysis-engine/src/__tests__/analyzeSolveText.test.ts · packages/analysis-engine/src/__tests__/fase2-comparison.test.ts · packages/analysis-engine/src/index.ts · … (6 en total) |
| 2026-08-07 | [`56052ca`](https://github.com/Doritozz05/Cubeforge/commit/56052ca) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/reconData.ts · apps/web/src/views/Training/CrossTrainerView.tsx · docs/plan_reconstruction/README.md · … (7 en total) |
| 2026-08-07 | [`948e5bb`](https://github.com/Doritozz05/Cubeforge/commit/948e5bb) | sin clasificar | fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · docs/plan_reconstruction/README.md |

### v0.5.5 — Solve Re-analysis Pipeline / Pipeline de reanálisis de solves — 2026-08-08 → 2026-08-08 — 23 commits

**Resumen:** Botón de reanálisis de solves que reejecuta la detección CFOP actualizada en solves pasados sin perder datos.

**Destacados:**
- Solve re-analysis engine re-evaluating historical solves against latest algorithm recognition rules.
- Non-destructive metadata updates preserving original solve timestamps and raw moves.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-08 | [`3e1b3e3`](https://github.com/Doritozz05/Cubeforge/commit/3e1b3e3) | sin clasificar | fix | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/vite.config.http.ts · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts · scripts/_scan-panel.cjs |
| 2026-08-08 | [`e213967`](https://github.com/Doritozz05/Cubeforge/commit/e213967) | sin clasificar | fx | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts |
| 2026-08-08 | [`76e6309`](https://github.com/Doritozz05/Cubeforge/commit/76e6309) | sin clasificar | Update OurDetectionPanel.tsx | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx |
| 2026-08-08 | [`9b1d04d`](https://github.com/Doritozz05/Cubeforge/commit/9b1d04d) | sin clasificar | Update OurDetectionPanel.tsx | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx |
| 2026-08-08 | [`9aab378`](https://github.com/Doritozz05/Cubeforge/commit/9aab378) | sin clasificar | fix | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/components/Layout/StageOverlays.tsx · … (13 en total) |
| 2026-08-08 | [`4f95616`](https://github.com/Doritozz05/Cubeforge/commit/4f95616) | sin clasificar | Update App.tsx | apps/web/src/App.tsx |
| 2026-08-08 | [`6e9c719`](https://github.com/Doritozz05/Cubeforge/commit/6e9c719) | sin clasificar | fix | apps/web/public/reconstructions/data/chunk-000.json · apps/web/public/reconstructions/data/chunk-001.json · apps/web/public/reconstructions/data/chunk-002.json · apps/web/public/reconstructions/data/chunk-003.json · … (53 en total) |
| 2026-08-08 | [`96c42c6`](https://github.com/Doritozz05/Cubeforge/commit/96c42c6) | sin clasificar | credits | DATA_SOURCES.md · README.md · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/CreditsSection.tsx · … (28 en total) |
| 2026-08-08 | [`e6cf52f`](https://github.com/Doritozz05/Cubeforge/commit/e6cf52f) | sin clasificar | fix | apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/components/Layout/MobileTabBar.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/views/Profile/ProfileView.tsx · … (7 en total) |
| 2026-08-08 | [`0c120cc`](https://github.com/Doritozz05/Cubeforge/commit/0c120cc) | sin clasificar | p0+p1 | apps/web/src/views/Reconstructions/reconData.ts · docs/plan_reconstruction/README.md · packages/analysis-engine/src/__tests__/analyzeSolveText.test.ts · packages/analysis-engine/src/__tests__/recon-rotated-solve.test.ts · … (20 en total) |
| 2026-08-08 | [`9fd8636`](https://github.com/Doritozz05/Cubeforge/commit/9fd8636) | sin clasificar | fix | apps/web/src/views/Reconstructions/reconData.ts · packages/analysis-engine/src/__tests__/recon-rotated-solve.test.ts · packages/math-core/src/CubeState.ts |
| 2026-08-08 | [`b933665`](https://github.com/Doritozz05/Cubeforge/commit/b933665) | sin clasificar | p2 | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/reconData.ts · packages/analysis-engine/src/__tests__/recon-rotated-solve.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · … (11 en total) |
| 2026-08-08 | [`6979f97`](https://github.com/Doritozz05/Cubeforge/commit/6979f97) | sin clasificar | fix | packages/analysis-engine/src/__tests__/recon-rotated-solve.test.ts · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts |
| 2026-08-08 | [`54bb115`](https://github.com/Doritozz05/Cubeforge/commit/54bb115) | sin clasificar | p3 | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/types/index.ts · apps/web/src/views/Reconstructions/reconData.ts · packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · … (5 en total) |
| 2026-08-08 | [`40b252e`](https://github.com/Doritozz05/Cubeforge/commit/40b252e) | sin clasificar | fixes | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/__tests__/analyzeSolveText.test.ts · packages/analysis-engine/src/__tests__/recon-rotated-solve.test.ts · … (8 en total) |
| 2026-08-08 | [`ae9353f`](https://github.com/Doritozz05/Cubeforge/commit/ae9353f) | sin clasificar | fixes | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts · packages/analysis-engine/src/timeline/TimelineBuilder.ts · packages/types/src/analysis.ts |
| 2026-08-08 | [`172af7d`](https://github.com/Doritozz05/Cubeforge/commit/172af7d) | sin clasificar | Update ReplayEngine.ts | packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-08-08 | [`a85716e`](https://github.com/Doritozz05/Cubeforge/commit/a85716e) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/types/index.ts · apps/web/src/views/Reconstructions/reconData.ts · packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · … (7 en total) |
| 2026-08-08 | [`6f6d209`](https://github.com/Doritozz05/Cubeforge/commit/6f6d209) | sin clasificar | fix | packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-08-08 | [`25d5b6e`](https://github.com/Doritozz05/Cubeforge/commit/25d5b6e) | sin clasificar | Update ReplayEngine.ts | packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-08-08 | [`8bba4e2`](https://github.com/Doritozz05/Cubeforge/commit/8bba4e2) | sin clasificar | Update ReplaySection.tsx | apps/web/src/components/Insights/ReplaySection.tsx |
| 2026-08-08 | [`be06331`](https://github.com/Doritozz05/Cubeforge/commit/be06331) | sin clasificar | fix replay rotations | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/types/index.ts · apps/web/src/views/Reconstructions/reconData.ts · packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · … (6 en total) |
| 2026-08-08 | [`532d417`](https://github.com/Doritozz05/Cubeforge/commit/532d417) | sin clasificar | fix | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Training/CrossTrainerView.tsx · packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts |

### v0.5.6 — Replay Move Grip Smooth Timeline / Cronología de replay y transiciones de agarre — 2026-08-08 → 2026-08-08 — 0 commits

**Resumen:** Transiciones suaves de posición de agarre en la cronología de replay 3D evitando saltos visuales.

**Destacados:**
- Smooth hand grip transition interpolation during 3D replay layer rotations.
- Eliminated rotation jumping artifacts during consecutive slice and wide move executions.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.5.7 — Color-Neutral Scrambler & Standard Deviation / Mezclador color-neutral y desviación estándar — 2026-08-09 → 2026-08-09 — 27 commits

**Resumen:** Reorientación de mezcla color-neutral, cálculo de desviación estándar (σ) de sesión y filtros.

**Destacados:**
- Color-neutral scramble orientation remapping to practice from any user-defined top/front color.
- Standard deviation (σ) calculation in session statistics measuring consistency.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-09 | [`cd7aef6`](https://github.com/Doritozz05/Cubeforge/commit/cd7aef6) | sin clasificar | fix | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/reconData.ts · packages/analysis-engine/src/__tests__/analyzeSolveText.test.ts · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts |
| 2026-08-09 | [`d1973d8`](https://github.com/Doritozz05/Cubeforge/commit/d1973d8) | sin clasificar | fix | packages/cube-3d-engine/src/__tests__/recon11413Replay.test.ts · packages/cube-3d-engine/src/__tests__/recon11413ReplayAsync.test.ts · packages/cube-3d-engine/src/__tests__/scramblePlayRace.test.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-08-09 | [`0b976a5`](https://github.com/Doritozz05/Cubeforge/commit/0b976a5) | sin clasificar | fix scrmable | DATA_SOURCES.md · apps/web/public/reconstructions/data/chunk-000.json · apps/web/public/reconstructions/data/chunk-001.json · apps/web/public/reconstructions/data/chunk-002.json · … (51 en total) |
| 2026-08-09 | [`88829fd`](https://github.com/Doritozz05/Cubeforge/commit/88829fd) | sin clasificar | Update ReconstructionDetailView.tsx | apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-09 | [`337a196`](https://github.com/Doritozz05/Cubeforge/commit/337a196) | sin clasificar | navbar | apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/components/Layout/MobileTabBar.tsx · apps/web/src/components/Layout/StageOverlays.tsx |
| 2026-08-09 | [`7215866`](https://github.com/Doritozz05/Cubeforge/commit/7215866) | sin clasificar | Update MobileTabBar.tsx | apps/web/src/components/Layout/MobileTabBar.tsx |
| 2026-08-09 | [`269b8a3`](https://github.com/Doritozz05/Cubeforge/commit/269b8a3) | sin clasificar | Update MobileTabBar.tsx | apps/web/src/components/Layout/MobileTabBar.tsx |
| 2026-08-09 | [`a1e0707`](https://github.com/Doritozz05/Cubeforge/commit/a1e0707) | docs | Create README.md | docs/plan_analysis_unification/README.md |
| 2026-08-09 | [`6442548`](https://github.com/Doritozz05/Cubeforge/commit/6442548) | sin clasificar | pipline analysis | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/atoms/CoherenceBadge.tsx · apps/web/src/components/Insights/atoms/FaceChip.tsx · apps/web/src/components/Insights/atoms/SkippedBadge.tsx · … (22 en total) |
| 2026-08-09 | [`ea34952`](https://github.com/Doritozz05/Cubeforge/commit/ea34952) | sin clasificar | fix | apps/web/public/reconstructions/data/chunk-000.json · apps/web/public/reconstructions/data/chunk-001.json · apps/web/public/reconstructions/data/chunk-002.json · apps/web/public/reconstructions/data/chunk-003.json · … (50 en total) |
| 2026-08-09 | [`ec6af64`](https://github.com/Doritozz05/Cubeforge/commit/ec6af64) | sin clasificar | fix | apps/web/src/hooks/solveSessionDebug.ts · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · apps/web/src/views/Reconstructions/reconData.ts · packages/types/src/analysis.ts |
| 2026-08-09 | [`3e81f50`](https://github.com/Doritozz05/Cubeforge/commit/3e81f50) | sin clasificar | Update Header.tsx | apps/web/src/components/Layout/Header.tsx |
| 2026-08-09 | [`d0bf9d0`](https://github.com/Doritozz05/Cubeforge/commit/d0bf9d0) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-09 | [`4d39fea`](https://github.com/Doritozz05/Cubeforge/commit/4d39fea) | sin clasificar | fix black stickers | apps/web/src/components/Insights/ReplaySection.tsx · packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · packages/cube-3d-engine/src/__tests__/transportRace.test.ts · packages/cube-3d-engine/src/animation/RotationEngine.ts · … (7 en total) |
| 2026-08-09 | [`4115aa9`](https://github.com/Doritozz05/Cubeforge/commit/4115aa9) | sin clasificar | rotations | apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Timer/hintFor.test.ts · apps/web/src/components/Timer/hintFor.ts · … (9 en total) |
| 2026-08-09 | [`c75fa40`](https://github.com/Doritozz05/Cubeforge/commit/c75fa40) | sin clasificar | scramble fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/atoms/AlgorithmNotation.tsx |
| 2026-08-09 | [`4977138`](https://github.com/Doritozz05/Cubeforge/commit/4977138) | sin clasificar | fix | apps/web/src/hooks/useStatsFilters.ts · packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts · packages/math-core/src/__tests__/OrientationTable.decompose.test.ts · … (5 en total) |
| 2026-08-09 | [`0da3d8a`](https://github.com/Doritozz05/Cubeforge/commit/0da3d8a) | sin clasificar | filters | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Insights/atoms/AlgorithmNotation.tsx · … (7 en total) |
| 2026-08-09 | [`29c9eaa`](https://github.com/Doritozz05/Cubeforge/commit/29c9eaa) | sin clasificar | fix tps graph | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/hooks/useStatsFilters.ts · apps/web/src/utils/__tests__/insights.test.ts · … (5 en total) |
| 2026-08-09 | [`cf2e155`](https://github.com/Doritozz05/Cubeforge/commit/cf2e155) | sin clasificar | fix | packages/database/src/__tests__/db.edgeCases.test.ts · packages/database/src/repositories/solves.repository.ts |
| 2026-08-09 | [`83fac12`](https://github.com/Doritozz05/Cubeforge/commit/83fac12) | sin clasificar | Update solves.repository.ts | packages/database/src/repositories/solves.repository.ts |
| 2026-08-09 | [`c9aeed8`](https://github.com/Doritozz05/Cubeforge/commit/c9aeed8) | sin clasificar | fix | apps/web/src/widgets/explorer/WidgetCard.tsx · apps/web/src/widgets/implementations/algorithm-db/definition.ts · apps/web/src/widgets/implementations/cube-button/definition.ts · apps/web/src/widgets/implementations/layout-organizer/definition.ts · … (16 en total) |
| 2026-08-09 | [`a022c06`](https://github.com/Doritozz05/Cubeforge/commit/a022c06) | sin clasificar | fix | apps/web/src/components/Timer/TimerContainer.tsx · packages/timer-engine/src/TimerEngine.ts · packages/timer-engine/tests/TimerEngine.edgeCases.test.ts |
| 2026-08-09 | [`f8abbbc`](https://github.com/Doritozz05/Cubeforge/commit/f8abbbc) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-09 | [`7745d68`](https://github.com/Doritozz05/Cubeforge/commit/7745d68) | sin clasificar | ao fix | apps/web/src/components/Stats/SolveProgressionChart.tsx · apps/web/src/components/Stats/TrendChart.tsx · apps/web/src/utils/formatTime.ts · packages/statistics/src/__tests__/statistics.test.ts · … (5 en total) |
| 2026-08-09 | [`3b91fe6`](https://github.com/Doritozz05/Cubeforge/commit/3b91fe6) | sin clasificar | fix | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Stats/TrendChart.tsx |
| 2026-08-09 | [`aa3e212`](https://github.com/Doritozz05/Cubeforge/commit/aa3e212) | sin clasificar | fix | apps/web/src/components/Timer/hintFor.test.ts · apps/web/src/components/Timer/hintFor.ts · apps/web/src/hooks/pressDispatch.test.ts · apps/web/src/hooks/pressDispatch.ts · … (5 en total) |

### v0.5.8 — Algorithm Creator Credits Attribution / Atribución de créditos a creadores — 2026-08-10 → 2026-08-10 — 37 commits

**Resumen:** Metadatos de atribución de autores honrando a los creadores y desarrolladores de la comunidad.

**Destacados:**
- Algorithm attribution metadata honoring creator credits (SpeedSolving Wiki, SCDB, community inventors).
- Community credits section in settings acknowledging open-source speedcubing libraries.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-10 | [`1278f08`](https://github.com/Doritozz05/Cubeforge/commit/1278f08) | sin clasificar | fix | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/__tests__/reconz-12340-xcross.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · packages/analysis-engine/src/pipeline/analyzeSolve.ts · … (9 en total) |
| 2026-08-10 | [`b736228`](https://github.com/Doritozz05/Cubeforge/commit/b736228) | sin clasificar | fix | apps/web/src/utils/seedDemoData.ts · docs/plan_analysis_unification/README.md · packages/analysis-engine/src/__tests__/phase-hardening.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · … (7 en total) |
| 2026-08-10 | [`19426ae`](https://github.com/Doritozz05/Cubeforge/commit/19426ae) | sin clasificar | fix | packages/analysis-engine/src/__tests__/PhaseSplitter.xcross.test.ts · packages/analysis-engine/src/__tests__/phase-hardening.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · packages/types/src/analysis.ts |
| 2026-08-10 | [`7244bf7`](https://github.com/Doritozz05/Cubeforge/commit/7244bf7) | sin clasificar | Update PhaseSplitter.ts | packages/analysis-engine/src/phases/PhaseSplitter.ts |
| 2026-08-10 | [`2a2b305`](https://github.com/Doritozz05/Cubeforge/commit/2a2b305) | sin clasificar | Update SolveProgressionChart.tsx | apps/web/src/components/Stats/SolveProgressionChart.tsx |
| 2026-08-10 | [`52b2a12`](https://github.com/Doritozz05/Cubeforge/commit/52b2a12) | sin clasificar | 26weeks | apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/atoms/ActivityHeatmap.tsx |
| 2026-08-10 | [`dac5026`](https://github.com/Doritozz05/Cubeforge/commit/dac5026) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-10 | [`d830122`](https://github.com/Doritozz05/Cubeforge/commit/d830122) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-10 | [`0493cf8`](https://github.com/Doritozz05/Cubeforge/commit/0493cf8) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-10 | [`b48d39e`](https://github.com/Doritozz05/Cubeforge/commit/b48d39e) | sin clasificar | Update CreditsSection.tsx | apps/web/src/components/Settings/sections/CreditsSection.tsx |
| 2026-08-10 | [`e8b9635`](https://github.com/Doritozz05/Cubeforge/commit/e8b9635) | sin clasificar | Update OurDetectionPanel.tsx | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx |
| 2026-08-10 | [`39e9eb9`](https://github.com/Doritozz05/Cubeforge/commit/39e9eb9) | sin clasificar | fix loader | apps/web/index.html · apps/web/src/boot/appReady.ts · apps/web/src/components/Settings/sections/ProfileSection.tsx · apps/web/src/components/Stage/MainStage.tsx · … (8 en total) |
| 2026-08-10 | [`d6c29ea`](https://github.com/Doritozz05/Cubeforge/commit/d6c29ea) | sin clasificar | Update MainStage.tsx | apps/web/src/components/Stage/MainStage.tsx |
| 2026-08-10 | [`0515387`](https://github.com/Doritozz05/Cubeforge/commit/0515387) | sin clasificar | Create .probe-boot.mjs | .probe-boot.mjs |
| 2026-08-10 | [`1132360`](https://github.com/Doritozz05/Cubeforge/commit/1132360) | sin clasificar | Delete .probe-boot.mjs | .probe-boot.mjs |
| 2026-08-10 | [`abb4dbd`](https://github.com/Doritozz05/Cubeforge/commit/abb4dbd) | sin clasificar | improved | docs/09-testing/CFOP-CROSS-RELAXED-STUDY.md · packages/analysis-engine/src/__tests__/cross-study.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · packages/analysis-engine/src/pipeline/analyzeSolve.ts · … (10 en total) |
| 2026-08-10 | [`5a80725`](https://github.com/Doritozz05/Cubeforge/commit/5a80725) | sin clasificar | fix | docs/09-testing/CFOP-CROSS-RELAXED-STUDY.md · packages/analysis-engine/src/__tests__/divergence-study.test.ts · packages/analysis-engine/src/__tests__/reconz-9068-e-layer.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · … (9 en total) |
| 2026-08-10 | [`0edb8be`](https://github.com/Doritozz05/Cubeforge/commit/0edb8be) | sin clasificar | fix | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/reconData.ts · docs/09-testing/CFOP-CROSS-RELAXED-STUDY.md · packages/analysis-engine/src/__tests__/divergence-study.test.ts · … (6 en total) |
| 2026-08-10 | [`73f19ac`](https://github.com/Doritozz05/Cubeforge/commit/73f19ac) | sin clasificar | fix | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · docs/09-testing/CFOP-CROSS-RELAXED-STUDY.md · packages/analysis-engine/src/__tests__/audit-large/detail.test.ts · … (16 en total) |
| 2026-08-10 | [`88c0b58`](https://github.com/Doritozz05/Cubeforge/commit/88c0b58) | sin clasificar | fix | packages/cube-3d-engine/src/replay/ReplayEngine.ts · packages/cube-3d-engine/src/replay/types.ts · scripts/lint-lines.cjs |
| 2026-08-10 | [`cfef2c1`](https://github.com/Doritozz05/Cubeforge/commit/cfef2c1) | test | fix | packages/algorithm-db/src/__tests__/scdb-dump-seed-catalog.test.ts · packages/algorithm-db/src/__tests__/scdb-import-comparison.test.ts · packages/algorithm-db/src/__tests__/scdb-seed-catalog.test.ts · packages/solver-engine/src/__tests__/_cmll_oracle.test.ts · … (5 en total) |
| 2026-08-10 | [`7a0ff65`](https://github.com/Doritozz05/Cubeforge/commit/7a0ff65) | test | fix | packages/algorithm-db/src/__tests__/scdb-dump-seed-catalog.test.ts · packages/algorithm-db/src/__tests__/scdb-seed-catalog.test.ts |
| 2026-08-10 | [`40fb3e4`](https://github.com/Doritozz05/Cubeforge/commit/40fb3e4) | sin clasificar | Merge pull request #10 from Doritozz05/algortihms | — |
| 2026-08-10 | [`545e62d`](https://github.com/Doritozz05/Cubeforge/commit/545e62d) | sin clasificar | Update SolveAnalysisPanel.tsx | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-10 | [`d874478`](https://github.com/Doritozz05/Cubeforge/commit/d874478) | test | Update CrossScrambleGenerator.test.ts | packages/solver-engine/src/CrossScrambleGenerator.test.ts |
| 2026-08-10 | [`ec20ac7`](https://github.com/Doritozz05/Cubeforge/commit/ec20ac7) | sin clasificar | fix | apps/web/src/views/Algorithms/components/AlgorithmEditorDialog.tsx · apps/web/src/views/Algorithms/components/CaseDetailPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx · apps/web/vite.no-ssl.config.ts |
| 2026-08-10 | [`db5874c`](https://github.com/Doritozz05/Cubeforge/commit/db5874c) | sin clasificar | fix | apps/web/src/components/Timer/hintFor.test.ts · apps/web/src/components/Timer/hintFor.ts |
| 2026-08-10 | [`bfb1735`](https://github.com/Doritozz05/Cubeforge/commit/bfb1735) | sin clasificar | fix skeleton db | apps/web/src/App.tsx · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/views/Profile/ProfileView.tsx |
| 2026-08-10 | [`b8d7051`](https://github.com/Doritozz05/Cubeforge/commit/b8d7051) | sin clasificar | Delete vite.no-ssl.config.ts | apps/web/vite.no-ssl.config.ts |
| 2026-08-10 | [`3a76178`](https://github.com/Doritozz05/Cubeforge/commit/3a76178) | sin clasificar | badges | apps/web/src/components/Identity/CreativeBadges.tsx · apps/web/src/components/Identity/MockAchievementBadges.tsx |
| 2026-08-10 | [`9a9084c`](https://github.com/Doritozz05/Cubeforge/commit/9a9084c) | sin clasificar | Update ProfileView.tsx | apps/web/src/views/Profile/ProfileView.tsx |
| 2026-08-10 | [`8b3b0de`](https://github.com/Doritozz05/Cubeforge/commit/8b3b0de) | sin clasificar | traduccion | apps/desktop/tsconfig.json · apps/web/package.json · apps/web/src/App.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · … (14 en total) |
| 2026-08-10 | [`fdd3494`](https://github.com/Doritozz05/Cubeforge/commit/fdd3494) | docs | Update README.md | apps/web/src/i18n/README.md |
| 2026-08-10 | [`e989c20`](https://github.com/Doritozz05/Cubeforge/commit/e989c20) | feat | feat(i18n): migrate nav and settings structure to typed keys | apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/SettingsSidebar.tsx · … (9 en total) |
| 2026-08-10 | [`ea29198`](https://github.com/Doritozz05/Cubeforge/commit/ea29198) | docs | Create README.md | docs/plan_i18n/README.md |
| 2026-08-10 | [`deb2eaa`](https://github.com/Doritozz05/Cubeforge/commit/deb2eaa) | feat | feat(i18n): migrate shell (tanda 2) to typed keys | apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · … (11 en total) |
| 2026-08-10 | [`eae61d8`](https://github.com/Doritozz05/Cubeforge/commit/eae61d8) | feat | feat(i18n): migrate global feedback (tanda 4) to typed keys | apps/web/src/App.tsx · apps/web/src/components/Hardware/CubeConnector.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Settings/sections/AdvancedSection.tsx · … (21 en total) |

### v0.5.9 — Complete Typed Translation Sweep / Barrido completo de traducción tipada — 2026-08-10 → 2026-08-10 — 0 commits

**Resumen:** Barrido de traducción completo migrando navegación, diálogos, gráficos y textos de training a i18n tipado.

**Destacados:**
- 100% typed translation coverage across all 16 views, modals and floating widgets.
- Optimized translation bundle chunking reducing initial JavaScript load time.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.6.0 — Virtual Cube Simulator csTimer Style / Simulador de cubo virtual estilo csTimer — 2026-08-11 → 2026-08-11 — 34 commits

**Resumen:** Simulador de cubo virtual estilo csTimer con controles completos de teclado QWERTY y gestos táctiles.

**Destacados:**
- Virtual Cube Simulator with full QWERTY keyboard controls (face, slice, wide turns and rotations) and touch gestures.
- Cube Help Overlay with on-screen interactive keyboard map and configurable turn speeds (slow, normal, fast, instant).

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-11 | [`07ebf2f`](https://github.com/Doritozz05/Cubeforge/commit/07ebf2f) | feat | feat(i18n): migrate Insights view (tanda 5) to typed keys | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · … (11 en total) |
| 2026-08-11 | [`2fe1f04`](https://github.com/Doritozz05/Cubeforge/commit/2fe1f04) | feat | feat(i18n): migrate Timer and session Stats zone (tanda 3) to typed keys | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/components/Stats/ManualSolveSheet.tsx · … (14 en total) |
| 2026-08-11 | [`9522f67`](https://github.com/Doritozz05/Cubeforge/commit/9522f67) | feat | feat(i18n): migrate Algorithms view (tanda 6) to typed keys | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Algorithms/AlgorithmDashboard.tsx · apps/web/src/views/Algorithms/components/AlgorithmEditorDialog.tsx · … (12 en total) |
| 2026-08-11 | [`fdc1b8c`](https://github.com/Doritozz05/Cubeforge/commit/fdc1b8c) | feat | feat(i18n): migrate Training dashboard and basic practice (tanda 7A) to typed keys | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Training/PlainPracticeView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx · … (8 en total) |
| 2026-08-11 | [`6defdd7`](https://github.com/Doritozz05/Cubeforge/commit/6defdd7) | feat | feat(i18n): migrate Training drills and phases (tanda 7B) to typed keys | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/AlgorithmRecognizeView.tsx · … (15 en total) |
| 2026-08-11 | [`a3c1b51`](https://github.com/Doritozz05/Cubeforge/commit/a3c1b51) | feat | feat(i18n): migrate SRS and calendar (tanda 7C) to typed keys | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Training/SRSInsightsView.tsx · apps/web/src/views/Training/SRSReviewView.tsx · … (8 en total) |
| 2026-08-11 | [`b2cb48d`](https://github.com/Doritozz05/Cubeforge/commit/b2cb48d) | feat | feat(i18n): migrate Skill Tree infrastructure and UI chrome (tanda 8A) to typed keys | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/SkillNodeModal.tsx · … (7 en total) |
| 2026-08-11 | [`040e0f0`](https://github.com/Doritozz05/Cubeforge/commit/040e0f0) | feat | feat(i18n): translate Skill Tree branches 1-4 to Spanish (tanda 8B) | apps/web/src/i18n/locales/es.json · docs/plan_i18n/README.md |
| 2026-08-11 | [`b428292`](https://github.com/Doritozz05/Cubeforge/commit/b428292) | feat | feat(i18n): translate Skill Tree branches 5-9 to Spanish (tanda 8C) | apps/web/src/i18n/locales/es.json · docs/plan_i18n/README.md |
| 2026-08-11 | [`8dfbbfd`](https://github.com/Doritozz05/Cubeforge/commit/8dfbbfd) | feat | feat(i18n): translate Skill Tree branches 10-13 to Spanish (tanda 8D) | apps/web/src/i18n/locales/es.json · docs/plan_i18n/README.md |
| 2026-08-11 | [`8b898a1`](https://github.com/Doritozz05/Cubeforge/commit/8b898a1) | feat | feat(i18n): translate Skill Tree branches 14-16 to Spanish (tanda 8E) — Skill Tree complete | apps/web/src/i18n/locales/es.json · docs/plan_i18n/README.md |
| 2026-08-11 | [`6c8bef0`](https://github.com/Doritozz05/Cubeforge/commit/6c8bef0) | feat | feat(i18n): migrate Profile zone to typed keys (tanda 9) | apps/web/src/components/Identity/ProfileHero.tsx · apps/web/src/components/Identity/StatStrip.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · … (6 en total) |
| 2026-08-11 | [`08ec22a`](https://github.com/Doritozz05/Cubeforge/commit/08ec22a) | feat | feat(i18n): migrate Reconstructions zone to typed keys (tanda 10) | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · … (6 en total) |
| 2026-08-11 | [`efb8dc0`](https://github.com/Doritozz05/Cubeforge/commit/efb8dc0) | feat | feat(i18n): migrate Widgets zone to typed keys (tanda 11) | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · … (26 en total) |
| 2026-08-11 | [`7e52616`](https://github.com/Doritozz05/Cubeforge/commit/7e52616) | feat | feat(i18n): migrate Settings General/Appearance/Timer sections (tanda 12A) | apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/i18n/locales/en.json · … (6 en total) |
| 2026-08-11 | [`67db77d`](https://github.com/Doritozz05/Cubeforge/commit/67db77d) | feat | feat(i18n): migrate Settings Profile/Data/Scramble/Analysis sections (tanda 12B) | apps/web/src/components/Settings/sections/AnalysisSection.tsx · apps/web/src/components/Settings/sections/DataSection.tsx · apps/web/src/components/Settings/sections/ProfileSection.tsx · apps/web/src/components/Settings/sections/ScrambleSection.tsx · … (7 en total) |
| 2026-08-11 | [`e010600`](https://github.com/Doritozz05/Cubeforge/commit/e010600) | feat | feat(i18n): migrate Settings Notifications/Shortcuts/SmartCube/Advanced/Credits + atoms (tanda 12C) | apps/web/src/components/Settings/components/ColorPicker.tsx · apps/web/src/components/Settings/sections/AdvancedSection.tsx · apps/web/src/components/Settings/sections/CreditsSection.tsx · apps/web/src/components/Settings/sections/NotificationsSection.tsx · … (10 en total) |
| 2026-08-11 | [`fe7395c`](https://github.com/Doritozz05/Cubeforge/commit/fe7395c) | feat | feat(i18n): complete the translation plan with tanda 13 (data & non-React surfaces) | apps/web/src/components/Identity/CountryFlag.tsx · apps/web/src/components/Settings/sections/ProfileSection.tsx · apps/web/src/i18n/index.ts · apps/web/src/i18n/locales/en.json · … (7 en total) |
| 2026-08-11 | [`fe31f49`](https://github.com/Doritozz05/Cubeforge/commit/fe31f49) | feat | feat(i18n): localize training catalog descriptions + 3D panel overlays (sweep) | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · … (5 en total) |
| 2026-08-11 | [`b9143d6`](https://github.com/Doritozz05/Cubeforge/commit/b9143d6) | sin clasificar | fixes | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Stats/SolveProgressionChart.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/components/Stats/TrendChart.tsx · … (6 en total) |
| 2026-08-11 | [`6764fb2`](https://github.com/Doritozz05/Cubeforge/commit/6764fb2) | sin clasificar | fixes widgets | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/widgets/implementations/algorithm-db/FloatingAlgorithmDbPanel.tsx · apps/web/src/widgets/implementations/algorithm-db/components/AlgorithmViewerCard.tsx · … (10 en total) |
| 2026-08-11 | [`5e5da7a`](https://github.com/Doritozz05/Cubeforge/commit/5e5da7a) | sin clasificar | fixes | apps/web/src/components/Onboarding/OnboardingTour.tsx · apps/web/src/components/Onboarding/TourTooltip.tsx · apps/web/src/components/Onboarding/tourSteps.ts · apps/web/src/i18n/locales/en.json · … (9 en total) |
| 2026-08-11 | [`f4a7fab`](https://github.com/Doritozz05/Cubeforge/commit/f4a7fab) | sin clasificar | improved traslations | apps/web/src/components/Identity/MockAchievementBadges.tsx · apps/web/src/components/Identity/ProfileHero.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Settings/components/ColorPicker.tsx · … (24 en total) |
| 2026-08-11 | [`2b25421`](https://github.com/Doritozz05/Cubeforge/commit/2b25421) | sin clasificar | fix | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-11 | [`83357a4`](https://github.com/Doritozz05/Cubeforge/commit/83357a4) | sin clasificar | fix tables | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-11 | [`9a419cf`](https://github.com/Doritozz05/Cubeforge/commit/9a419cf) | sin clasificar | Merge pull request #11 from Doritozz05/feat/spanish-translation | — |
| 2026-08-11 | [`55ea152`](https://github.com/Doritozz05/Cubeforge/commit/55ea152) | sin clasificar | fix recog | packages/analysis-engine/src/__tests__/reconz-5061-pair-displacement.test.ts · packages/analysis-engine/src/pipeline/segmentF2LPairs.ts |
| 2026-08-11 | [`d5eee43`](https://github.com/Doritozz05/Cubeforge/commit/d5eee43) | sin clasificar | pll skip improved | packages/analysis-engine/src/__tests__/audit-large/shared.ts · packages/analysis-engine/src/__tests__/cross-study.test.ts · packages/analysis-engine/src/__tests__/fase2-comparison.test.ts · packages/analysis-engine/src/__tests__/reconz-5061-pair-displacement.test.ts · … (8 en total) |
| 2026-08-11 | [`a96fc80`](https://github.com/Doritozz05/Cubeforge/commit/a96fc80) | sin clasificar | Update sidebar.constants.ts | apps/web/src/components/Layout/sidebar.constants.ts |
| 2026-08-11 | [`9ba6469`](https://github.com/Doritozz05/Cubeforge/commit/9ba6469) | sin clasificar | headers | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · … (10 en total) |
| 2026-08-11 | [`84d6a18`](https://github.com/Doritozz05/Cubeforge/commit/84d6a18) | feat | feat(training): redesign training workspace UI (#12) | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Training/TrainingCalendar.tsx · apps/web/src/views/Training/TrainingDashboard.tsx · … (5 en total) |
| 2026-08-11 | [`9628c46`](https://github.com/Doritozz05/Cubeforge/commit/9628c46) | sin clasificar | fix | apps/web/src/views/Training/AlgorithmDrillView.tsx · apps/web/src/views/Training/TrainingDashboard.tsx · apps/web/src/views/Training/components/DashboardSections.tsx |
| 2026-08-11 | [`01f7bfb`](https://github.com/Doritozz05/Cubeforge/commit/01f7bfb) | sin clasificar | fix kayout | apps/web/src/views/Training/TrainingDashboard.tsx · apps/web/src/views/Training/components/DashboardSections.tsx |
| 2026-08-11 | [`92c5759`](https://github.com/Doritozz05/Cubeforge/commit/92c5759) | sin clasificar | Update DashboardSections.tsx | apps/web/src/views/Training/components/DashboardSections.tsx |

### v0.6.1 — Web Audio Mechanical Turn Sounds / Sonidos mecánicos Web Audio — 2026-08-11 → 2026-08-11 — 0 commits

**Resumen:** Sonidos mecánicos realistas de giro del cubo sintetizados con Web Audio sin archivos externos.

**Destacados:**
- Mechanical cube turn sound synthesis with randomized micro-variations using Web Audio API.
- Specialized training suites: EO Detect, EO Efficiency, LSE Sub-Phase, and Blindfold Practice.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.6.2 — Modular Dock Pieces Architecture / Arquitectura de piezas modulares del dock — 2026-08-12 → 2026-08-12 — 36 commits

**Resumen:** Arquitectura de piezas modulares del dock (reloj en vivo, pastilla de batería, perfil, espaciadores y separadores).

**Destacados:**
- Modular dock pieces architecture decoupling tray controls into reusable draggable pieces.
- Live Clock and Smart Cube Battery charge indicator dock pieces.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-12 | [`dec98b6`](https://github.com/Doritozz05/Cubeforge/commit/dec98b6) | sin clasificar | Feat/cube simulator (#13) | apps/web/src/App.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/components/Stage/MainStage.tsx · apps/web/src/hooks/__tests__/scrambleValidatorUndoContract.test.ts · … (33 en total) |
| 2026-08-12 | [`45e558a`](https://github.com/Doritozz05/Cubeforge/commit/45e558a) | sin clasificar | Update es.json | apps/web/src/i18n/locales/es.json |
| 2026-08-12 | [`3214967`](https://github.com/Doritozz05/Cubeforge/commit/3214967) | feat | feat(web): Virtual tab in mobile More sheet + stable cube layout (#14) | apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Cube/CubeSimulatorView.tsx |
| 2026-08-12 | [`81d3e25`](https://github.com/Doritozz05/Cubeforge/commit/81d3e25) | feat | feat(web): virtual cube saves full solves tagged as "virtual" (#15) | apps/web/src/App.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Layout/AppShell.tsx · … (26 en total) |
| 2026-08-12 | [`2e4bf61`](https://github.com/Doritozz05/Cubeforge/commit/2e4bf61) | sin clasificar | fix | apps/web/src/hooks/__tests__/useCubeTurnControls.test.ts · apps/web/src/hooks/useCubeTurnControls.ts |
| 2026-08-12 | [`d1ad534`](https://github.com/Doritozz05/Cubeforge/commit/d1ad534) | sin clasificar | fix virtual widgets | apps/web/src/components/Layout/StageOverlays.tsx · apps/web/src/stores/virtualScrambleStore.test.ts · apps/web/src/stores/virtualScrambleStore.ts · apps/web/src/views/Cube/CubeSimulatorView.tsx |
| 2026-08-12 | [`cc667a4`](https://github.com/Doritozz05/Cubeforge/commit/cc667a4) | feat | feat(web): unified glass dock with stable drag-to-dock | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/hooks/useDraggable.ts · … (8 en total) |
| 2026-08-12 | [`da36a1e`](https://github.com/Doritozz05/Cubeforge/commit/da36a1e) | feat | feat(web): context menu + dock edit mode with modular areas | apps/web/src/components/ContextMenu/ContextMenu.tsx · apps/web/src/components/ContextMenu/ContextMenuArea.tsx · apps/web/src/components/ContextMenu/contextMenuStore.ts · apps/web/src/components/Layout/AppShell.tsx · … (15 en total) |
| 2026-08-12 | [`95b463d`](https://github.com/Doritozz05/Cubeforge/commit/95b463d) | feat | feat(web): dock area reorder in edit mode + DockExplorer with all piece types | apps/web/src/components/Layout/Header.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/widgets/dock/DockExplorer.tsx · … (7 en total) |
| 2026-08-12 | [`a2abe5c`](https://github.com/Doritozz05/Cubeforge/commit/a2abe5c) | feat | feat(web): dock Phase 4 — live clock, profile, spacer, separator pieces | apps/web/src/components/Layout/Header.tsx · apps/web/src/widgets/dock/DockExplorer.tsx · apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-08-12 | [`d15777b`](https://github.com/Doritozz05/Cubeforge/commit/d15777b) | refactor | refactor(web): extract dock pieces to individual files + fix edit mode z-index | apps/web/src/components/Layout/Header.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/pieces/clock/ClockPiece.tsx · apps/web/src/widgets/dock/pieces/index.ts · … (10 en total) |
| 2026-08-12 | [`5174576`](https://github.com/Doritozz05/Cubeforge/commit/5174576) | fix | fix(web): dock edit mode fixes — clip buttons, toggle switch, repeatable counter | apps/web/src/widgets/dock/DockExplorer.tsx · apps/web/src/widgets/dock/DockItemCard.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/dockAreasRegistry.ts |
| 2026-08-12 | [`d9efad3`](https://github.com/Doritozz05/Cubeforge/commit/d9efad3) | feat | feat(web): polish unified glass dock | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/widgets/dock/DockItemCard.tsx · … (10 en total) |
| 2026-08-12 | [`63cfcd4`](https://github.com/Doritozz05/Cubeforge/commit/63cfcd4) | feat | feat(web): dock battery piece, edit-mode blur, and codebase cleanup | apps/web/package.json · apps/web/src/components/ContextMenu/ContextMenu.tsx · apps/web/src/components/ContextMenu/ContextMenuArea.tsx · apps/web/src/components/Hardware/BatteryIcon.tsx · … (25 en total) |
| 2026-08-12 | [`8d726d9`](https://github.com/Doritozz05/Cubeforge/commit/8d726d9) | feat | feat(web): dock running indicator + deterministic instance ids | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/widgets/dock/DockExplorer.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · … (6 en total) |
| 2026-08-12 | [`564ceed`](https://github.com/Doritozz05/Cubeforge/commit/564ceed) | feat | feat(web): dock pill click toggles launch/dock-back | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-08-12 | [`00e87fc`](https://github.com/Doritozz05/Cubeforge/commit/00e87fc) | fix | fix(web): keep dock pill position when toggling back to docked | apps/web/src/widgets/widgetStore.ts |
| 2026-08-12 | [`cce93ea`](https://github.com/Doritozz05/Cubeforge/commit/cce93ea) | sin clasificar | Merge pull request #16 from Doritozz05/feat/unified-glass-dock | — |
| 2026-08-12 | [`3f5af33`](https://github.com/Doritozz05/Cubeforge/commit/3f5af33) | docs | docs: cierra Fase 0 de documentación — archiva planes y audita ADRs | docs/02-architecture/Architecture_Decision_Register.md · docs/02-architecture/diagrams/README.md · docs/02-architecture/overview/README.md · docs/02-architecture/validation/ADR_Drift_Audit_2026-08-12.md · … (29 en total) |
| 2026-08-12 | [`251c947`](https://github.com/Doritozz05/Cubeforge/commit/251c947) | docs | docs: Fase 1 — documenta la vista Training (docs + ADR-024 + TDD-0001) | docs/02-architecture/Architecture_Decision_Register.md · docs/03-adr/ADR-024-Training_SRS_System.md · docs/03-adr/README.md · docs/05-tdd/training/0001-srs-training-system.md · … (7 en total) |
| 2026-08-12 | [`9982d81`](https://github.com/Doritozz05/Cubeforge/commit/9982d81) | docs | docs: Fase 1 completa — documenta las 6 vistas de la web (+ ADR-025 i18n) | docs/02-architecture/Architecture_Decision_Register.md · docs/03-adr/ADR-025-i18n_Strategy.md · docs/03-adr/README.md · docs/16-user/Algorithms_View.md · … (10 en total) |
| 2026-08-12 | [`c224bc6`](https://github.com/Doritozz05/Cubeforge/commit/c224bc6) | docs | docs: Fase 2 — documenta el sistema de widgets (arquitectura + 11 fichas) | docs/02-architecture/Widgets_System.md · docs/02-architecture/overview/README.md · docs/02-architecture/widgets/README.md · docs/02-architecture/widgets/algorithm-db.md · … (15 en total) |
| 2026-08-12 | [`cc2531a`](https://github.com/Doritozz05/Cubeforge/commit/cc2531a) | docs | docs: Fase 2 — añade ADR-026 (Widget SDK) y TDD-0002 (sistema de dock) | docs/02-architecture/Architecture_Decision_Register.md · docs/02-architecture/Widgets_System.md · docs/03-adr/ADR-017-Plugin_System.md · docs/03-adr/ADR-026-Widget_SDK_Host_Architecture.md · … (7 en total) |
| 2026-08-12 | [`9030691`](https://github.com/Doritozz05/Cubeforge/commit/9030691) | docs | docs: Fase 3 — documenta la arquitectura de la web (estado, componentes, hooks) | docs/02-architecture/overview/README.md · docs/02-architecture/web/Components.md · docs/02-architecture/web/Hooks_Services_and_Lib.md · docs/02-architecture/web/README.md · … (6 en total) |
| 2026-08-12 | [`1e0753b`](https://github.com/Doritozz05/Cubeforge/commit/1e0753b) | docs | docs: Fase 4 — documenta los 19 paquetes del monorepo (docs/06-api) | docs/06-api/3d.md · docs/06-api/README.md · docs/06-api/analysis.md · docs/06-api/core.md · … (8 en total) |
| 2026-08-12 | [`b10bda4`](https://github.com/Doritozz05/Cubeforge/commit/b10bda4) | docs | docs: Fase 5 — apps/desktop (Tauri) + decisión de apps/api | docs/02-architecture/Architecture_Decision_Register.md · docs/02-architecture/Desktop_App.md · docs/02-architecture/overview/README.md · docs/03-adr/ADR-019-Backend_Architecture.md · … (8 en total) |
| 2026-08-12 | [`927920c`](https://github.com/Doritozz05/Cubeforge/commit/927920c) | docs | docs: Fase 6 — documenta la plombería (devops/CI/deploy/releases) | docs/02-architecture/Architecture_Decision_Register.md · docs/03-adr/ADR-028-CI_Quality_Gates.md · docs/03-adr/README.md · docs/11-devops/CI_and_Quality_Gates.md · … (9 en total) |
| 2026-08-12 | [`bd897dc`](https://github.com/Doritozz05/Cubeforge/commit/bd897dc) | docs | docs: Fase 7 — API reference con TypeDoc (script docs:api) | .gitignore · docs/06-api/README.md · docs/DOCUMENTATION_PLAN.md · package.json · … (8 en total) |
| 2026-08-12 | [`8273800`](https://github.com/Doritozz05/Cubeforge/commit/8273800) | docs | docs: Fase 8 (releases) + limpia los warnings de TypeDoc | apps/desktop/CHANGELOG.md · apps/desktop/package.json · apps/web/CHANGELOG.md · apps/web/package.json · … (53 en total) |
| 2026-08-12 | [`c0f4137`](https://github.com/Doritozz05/Cubeforge/commit/c0f4137) | docs | docs: Fase 9 — cierre y validación del índice (docs/ completo) | docs/02-architecture/Architecture_Index.md · docs/02-architecture/diagrams/README.md · docs/02-architecture/diagrams/data-flow.mmd · docs/02-architecture/diagrams/monorepo-dependencies.mmd · … (13 en total) |
| 2026-08-12 | [`8a0cb86`](https://github.com/Doritozz05/Cubeforge/commit/8a0cb86) | docs | docs: crea 14-ai/AGENTS.md — manual operativo para asistentes de IA | docs/14-ai/AGENTS.md · docs/14-ai/README.md · docs/DOCUMENTATION_PLAN.md · docs/README.md |
| 2026-08-12 | [`744c03f`](https://github.com/Doritozz05/Cubeforge/commit/744c03f) | sin clasificar | Merge pull request #17 from Doritozz05/docs/documentation | — |
| 2026-08-12 | [`87bf7e6`](https://github.com/Doritozz05/Cubeforge/commit/87bf7e6) | feat | feat(solver-engine): WCA-compliant 2×2 scrambles of exactly 11 moves | docs/wca.md · packages/solver-engine/src/TwoByTwoScrambler.test.ts · packages/solver-engine/src/TwoByTwoScrambler.ts · packages/solver-engine/src/TwoByTwoSolver.test.ts · … (6 en total) |
| 2026-08-12 | [`c22d85d`](https://github.com/Doritozz05/Cubeforge/commit/c22d85d) | sin clasificar | Merge pull request #18 from Doritozz05/feat/wca-scramble-compliance | — |
| 2026-08-12 | [`e991144`](https://github.com/Doritozz05/Cubeforge/commit/e991144) | sin clasificar | sound | apps/web/src/assets/sounds/README.md · apps/web/src/assets/sounds/turn-1.wav · apps/web/src/assets/sounds/turn-2.wav · apps/web/src/assets/sounds/turn-3.wav · … (9 en total) |
| 2026-08-12 | [`c6dfba3`](https://github.com/Doritozz05/Cubeforge/commit/c6dfba3) | fix | fix(audio): trim leading silence from cube turn samples | apps/web/src/assets/sounds/README.md · apps/web/src/assets/sounds/turn-1.wav · apps/web/src/assets/sounds/turn-2.wav · apps/web/src/assets/sounds/turn-3.wav · … (5 en total) |

### v0.6.3 — DockExplorer Catalog & Virtual Solve Tag / Catálogo DockExplorer y tag virtual — 2026-08-12 → 2026-08-12 — 0 commits

**Resumen:** Modal de catálogo DockExplorer para añadir piezas y etiquetado automático 'virtual' para análisis.

**Destacados:**
- DockExplorer catalog modal for discovering and adding pieces to the dock bar.
- Virtual solve logging tagged 'virtual' feeding full move and orientation timelines into CFOP analysis.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.6.4 — Dock Edit Mode & Removal Badges / Modo edición del dock e insignias de borrado — 2026-08-13 → 2026-08-13 — 36 commits

**Resumen:** Modo edición del dock con botones de borrado directo (X), reordenación por arrastre y widgets montados.

**Destacados:**
- Dock edit mode with drag-and-drop piece reordering and direct removal badges (X).
- Maintained widget instances mounted and preserved across dock collapse and expands.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-13 | [`a7d4f39`](https://github.com/Doritozz05/Cubeforge/commit/a7d4f39) | feat | feat(settings): move all sound options into a dedicated Audio section | apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/AudioSection.tsx · apps/web/src/components/Settings/sections/NotificationsSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · … (13 en total) |
| 2026-08-13 | [`8f3c747`](https://github.com/Doritozz05/Cubeforge/commit/8f3c747) | sin clasificar | Merge pull request #19 from Doritozz05/feat/audio-cube-turn-sounds | — |
| 2026-08-13 | [`e4c28ec`](https://github.com/Doritozz05/Cubeforge/commit/e4c28ec) | sin clasificar | fix 3d panel | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-13 | [`01c3fe3`](https://github.com/Doritozz05/Cubeforge/commit/01c3fe3) | sin clasificar | Update MainLayout.tsx | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-13 | [`ef245df`](https://github.com/Doritozz05/Cubeforge/commit/ef245df) | chore | chore(deps): migrate TypeScript to 6.0.3 across the monorepo | apps/web/src/i18n/README.md · package.json · packages/algorithm-db/package.json · packages/analysis-engine/package.json · … (21 en total) |
| 2026-08-13 | [`fee367a`](https://github.com/Doritozz05/Cubeforge/commit/fee367a) | perf | perf(web): optimize floating widget drag-to-dock detection and rendering | apps/web/src/hooks/useDraggable.ts · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/dockZoneState.ts |
| 2026-08-13 | [`ea80d08`](https://github.com/Doritozz05/Cubeforge/commit/ea80d08) | refactor | refactor(dock): unify widget tooltips and update reconstructions icon to FaListOl | apps/web/package.json · apps/web/src/components/Layout/MobileMoreSheet.tsx · apps/web/src/components/Layout/sidebar.constants.ts · apps/web/src/widgets/dock/WidgetDock.tsx · … (5 en total) |
| 2026-08-13 | [`9ea4e3c`](https://github.com/Doritozz05/Cubeforge/commit/9ea4e3c) | fix | fix(ui): preserve widget positions on toggle and scope smart cube scramble highlights | apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/views/Cube/CubeSimulatorView.tsx · apps/web/src/views/Training/AlgorithmDrillView.tsx · … (13 en total) |
| 2026-08-13 | [`8ee16ac`](https://github.com/Doritozz05/Cubeforge/commit/8ee16ac) | sin clasificar | Update timeline.ts | packages/analysis-engine/src/derived/timeline.ts |
| 2026-08-13 | [`7996bcb`](https://github.com/Doritozz05/Cubeforge/commit/7996bcb) | fix | fix(build): preserve dist output during dev watch mode and fix rootDir warnings | packages/analysis-engine/package.json · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts · packages/gan-protocol/tsup.config.ts · packages/hardware-hal/tsup.config.ts · … (12 en total) |
| 2026-08-13 | [`831d0a5`](https://github.com/Doritozz05/Cubeforge/commit/831d0a5) | feat | feat(dock): redesign battery widget visual layout and tweak piece styling | apps/web/src/components/Hardware/BatteryIcon.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/pieces/battery/BatteryPiece.tsx · apps/web/src/widgets/dock/pieces/clock/ClockPiece.tsx · … (6 en total) |
| 2026-08-13 | [`abe6b61`](https://github.com/Doritozz05/Cubeforge/commit/abe6b61) | feat | feat(widgets): default all built-in widgets to active and set new dock area default order | apps/web/src/widgets/dock/dockAreasRegistry.ts · apps/web/src/widgets/implementations/algorithm-db/definition.ts · apps/web/src/widgets/implementations/layout-organizer/definition.ts · apps/web/src/widgets/implementations/metronome/definition.ts · … (13 en total) |
| 2026-08-13 | [`d14e166`](https://github.com/Doritozz05/Cubeforge/commit/d14e166) | feat | feat(theme): default application theme to light instead of system | apps/web/src/components/theme-provider.tsx · packages/state/src/__tests__/state.test.ts · packages/state/src/store.ts |
| 2026-08-13 | [`bec96c5`](https://github.com/Doritozz05/Cubeforge/commit/bec96c5) | feat | feat(settings): set focusMode and showPbDelta to true by default | packages/state/src/store.ts |
| 2026-08-13 | [`ca92193`](https://github.com/Doritozz05/Cubeforge/commit/ca92193) | fix | fix(timer): hide scramble during solve when focus mode is active | apps/web/src/components/Stage/TimerStage.tsx |
| 2026-08-13 | [`14147d5`](https://github.com/Doritozz05/Cubeforge/commit/14147d5) | feat | feat: redesign manual entry action pill & move time precision to timer settings | apps/web/src/components/Layout/appShell.types.ts · apps/web/src/components/Settings/sections/GeneralSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Stage/TimerStage.tsx · … (8 en total) |
| 2026-08-13 | [`2de8e9b`](https://github.com/Doritozz05/Cubeforge/commit/2de8e9b) | feat | feat: add showHints setting, move BPA/WPA setting to Timer section, and fix tsconfig/unused imports | apps/web/src/components/Settings/sections/AnalysisSection.tsx · apps/web/src/components/Settings/sections/TimerSection.tsx · apps/web/src/components/Timer/TimerDisplay.tsx · apps/web/src/i18n/locales/en.json · … (8 en total) |
| 2026-08-13 | [`bcdf558`](https://github.com/Doritozz05/Cubeforge/commit/bcdf558) | refactor | refactor(settings): move background image settings to Appearance tab, remove liquid glass from dock, and optimize image quality | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/BackgroundLayer.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · … (11 en total) |
| 2026-08-13 | [`8eefd76`](https://github.com/Doritozz05/Cubeforge/commit/8eefd76) | fix | fix(background): remove artificial theme overlay to display pristine background image | apps/web/src/components/Layout/BackgroundLayer.tsx · apps/web/src/components/Settings/components/CustomBackgroundSetting.tsx |
| 2026-08-13 | [`59df7ad`](https://github.com/Doritozz05/Cubeforge/commit/59df7ad) | feat | feat(settings): add user-controllable dark overlay slider for custom background | apps/web/src/components/Layout/BackgroundLayer.tsx · apps/web/src/components/Settings/components/CustomBackgroundSetting.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · … (5 en total) |
| 2026-08-13 | [`01db558`](https://github.com/Doritozz05/Cubeforge/commit/01db558) | fix | fix(syntax): add missing closing parenthesis in BackgroundLayer and clean Tailwind z-index class | apps/web/src/components/Layout/BackgroundLayer.tsx · apps/web/src/components/Layout/Header.tsx |
| 2026-08-13 | [`e2f3ab2`](https://github.com/Doritozz05/Cubeforge/commit/e2f3ab2) | fix | fix(manual-entry): use solid bg-surface on input field, removing transparency | apps/web/src/components/Timer/ManualTimeInput.tsx |
| 2026-08-13 | [`60b8a88`](https://github.com/Doritozz05/Cubeforge/commit/60b8a88) | style | style(timer): remove liquid glass from action pills in TimerContainer and ManualTimeInput | apps/web/src/components/Timer/ManualTimeInput.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-08-13 | [`cf9a8d0`](https://github.com/Doritozz05/Cubeforge/commit/cf9a8d0) | style | style(timer): remove phase halo when background image active; fix focus mode bg visibility; remove liquid from focus button; align pill color to bg-surface | apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/components/Timer/ManualTimeInput.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-08-13 | [`5e8dc17`](https://github.com/Doritozz05/Cubeforge/commit/5e8dc17) | feat | feat(timer): add confirm dialog before deleting a solve from timer and times list | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Stats/TimesList.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/shared/ConfirmDialog.tsx · … (6 en total) |
| 2026-08-13 | [`4bc162a`](https://github.com/Doritozz05/Cubeforge/commit/4bc162a) | fix | fix(web): make analyze/replay open the solve analysis, restore desktop router, and confirm clears | apps/desktop/package.json · apps/desktop/src/main.tsx · apps/web/src/App.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · … (13 en total) |
| 2026-08-13 | [`3749fb4`](https://github.com/Doritozz05/Cubeforge/commit/3749fb4) | feat | feat(web): standalone 404 page and localized per-view document titles | apps/web/src/App.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/appShell.types.ts · apps/web/src/components/Stage/MainStage.tsx · … (10 en total) |
| 2026-08-13 | [`6b80490`](https://github.com/Doritozz05/Cubeforge/commit/6b80490) | fix | fix(web): keep the dock bar crisp above the blur while editing the dock | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-13 | [`41a5e30`](https://github.com/Doritozz05/Cubeforge/commit/41a5e30) | perf | perf(web): cut initial JS ~40% via lazy seed/settings/i18n and keep widgets mounted on dock collapse | apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/hooks/useTrainingProgress.ts · apps/web/src/i18n/index.test.ts · apps/web/src/i18n/index.ts · … (8 en total) |
| 2026-08-13 | [`94e1cd2`](https://github.com/Doritozz05/Cubeforge/commit/94e1cd2) | sin clasificar | Update WidgetDock.tsx | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-08-13 | [`539fd3b`](https://github.com/Doritozz05/Cubeforge/commit/539fd3b) | test | Update fase2-comparison.test.ts | packages/analysis-engine/src/__tests__/fase2-comparison.test.ts |
| 2026-08-13 | [`e75a7c0`](https://github.com/Doritozz05/Cubeforge/commit/e75a7c0) | feat | feat(web): dock edit X-buttons, visible spacer/separator, vertical icon, and loader gating on DB ready | apps/web/src/App.tsx · apps/web/src/boot/appReady.ts · apps/web/src/main.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · … (5 en total) |
| 2026-08-13 | [`790231a`](https://github.com/Doritozz05/Cubeforge/commit/790231a) | fix | fix(web): make boot loader + in-app spinner animation robust and seamless | apps/web/index.html · apps/web/src/index.css |
| 2026-08-13 | [`43bcc58`](https://github.com/Doritozz05/Cubeforge/commit/43bcc58) | docs | Create Ecosistema_Cubing_Investigacion_2026-08.md | docs/00-product/Ecosistema_Cubing_Investigacion_2026-08.md |
| 2026-08-13 | [`498f045`](https://github.com/Doritozz05/Cubeforge/commit/498f045) | docs | Create Analisis_Pipeline_F2L_y_Frame_2026-08.md | docs/02-architecture/research/Analisis_Pipeline_F2L_y_Frame_2026-08.md |
| 2026-08-13 | [`dd1e92d`](https://github.com/Doritozz05/Cubeforge/commit/dd1e92d) | docs | docs(research): phase 0 slice/wide normalization ground-truth + 5-phase plan | docs/02-architecture/research/Analisis_Pipeline_F2L_y_Frame_2026-08.md · docs/02-architecture/research/Fase0_Normalizacion_SliceWide_2026-08.md |

### v0.6.5 — Modular Bottom Layout Templates / Plantillas modulares de layout inferior — 2026-08-13 → 2026-08-13 — 0 commits

**Resumen:** Plantillas modulares de layout inferior: estadísticas compactas, vista a 3 columnas, gráficos divididos y red 2D.

**Destacados:**
- Modular bottom layout templates: compact stats, 3-column view, split charts and 2D scramble preview.
- Persistent bottom layout preferences across app sessions.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.6.6 — Dock Auto-Hide Tri-State Top Bar / Auto-hide del dock y barra tri-estado — 2026-08-14 → 2026-08-14 — 19 commits

**Resumen:** Control tri-estado del dock (Siempre/Oculto/Auto-hide al resolver) y revelado por arrastre.

**Destacados:**
- Tri-state top bar control: Always visible, Hidden, or Auto-hide dock when starting the timer.
- Drag-to-reveal dock: dragging a floating widget upwards towards the retracted dock smoothly reveals the drop zone.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-14 | [`841e892`](https://github.com/Doritozz05/Cubeforge/commit/841e892) | docs | Update Ecosistema_Cubing_Investigacion_2026-08.md | docs/00-product/Ecosistema_Cubing_Investigacion_2026-08.md |
| 2026-08-14 | [`1c9df42`](https://github.com/Doritozz05/Cubeforge/commit/1c9df42) | fix | fix(math-core): strict cross detection no longer locks onto a spurious cross | packages/math-core/src/__tests__/strictCrossSpurious.test.ts · packages/math-core/src/methods/cfop/ColorPhaseDetector.ts |
| 2026-08-14 | [`ea8d75f`](https://github.com/Doritozz05/Cubeforge/commit/ea8d75f) | fix | fix(web): scramble validator stops poisoning startedFromSolved on first move | apps/web/src/hooks/__tests__/scrambleValidatorUndoContract.test.ts · apps/web/src/hooks/useScrambleValidator.ts |
| 2026-08-14 | [`3df0562`](https://github.com/Doritozz05/Cubeforge/commit/3df0562) | fix | fix(cube-3d-engine): replay rotates the grip before the move, not concurrently | packages/cube-3d-engine/src/__tests__/ReplayEngine.test.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-08-14 | [`e80fff4`](https://github.com/Doritozz05/Cubeforge/commit/e80fff4) | fix | fix(hardware): request facelets on connect so first moves aren't dropped | apps/desktop/src/adapters/GanCubeAdapterTauri.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts · packages/hardware-hal/tests/GanCubeAdapter.connect.test.ts |
| 2026-08-14 | [`19e46b9`](https://github.com/Doritozz05/Cubeforge/commit/19e46b9) | fix | fix(orientation): auto-calibrate the gyro only while the cube is at rest | apps/web/src/hooks/useCube3D.ts · apps/web/src/services/orientationTracking.ts · packages/cube-3d-engine/src/__tests__/GyroFusion.test.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts · … (7 en total) |
| 2026-08-14 | [`bbc0f85`](https://github.com/Doritozz05/Cubeforge/commit/bbc0f85) | feat | feat(web): add re-analyze button that re-runs the analysis pipeline | apps/web/src/App.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Layout/AppShell.tsx · … (11 en total) |
| 2026-08-14 | [`babc5f0`](https://github.com/Doritozz05/Cubeforge/commit/babc5f0) | sin clasificar | fixes | apps/web/src/hooks/__tests__/reanalyzeSolve.test.ts · apps/web/src/hooks/useCube3D.ts · apps/web/src/hooks/useSolveSession.ts · apps/web/src/services/__tests__/orientationTracking.test.ts · … (11 en total) |
| 2026-08-14 | [`d7d2d4d`](https://github.com/Doritozz05/Cubeforge/commit/d7d2d4d) | fix | fix(orientation): auto-calibrate reliably on connect | apps/web/src/hooks/useCube3D.ts · apps/web/src/services/__tests__/orientationTracking.test.ts · apps/web/src/services/orientationTracking.ts · packages/cube-3d-engine/src/__tests__/GyroFusion.test.ts · … (5 en total) |
| 2026-08-14 | [`9770a78`](https://github.com/Doritozz05/Cubeforge/commit/9770a78) | fix | fix(cube-3d-engine): rebased-interpolation gyro fusion — no more jumps, freezes or x2 teleports | packages/cube-3d-engine/src/__tests__/GyroFusion.test.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts |
| 2026-08-14 | [`08dc602`](https://github.com/Doritozz05/Cubeforge/commit/08dc602) | feat | feat(cube-3d-engine): critically-damped spring follower — continuous angular velocity | packages/cube-3d-engine/src/__tests__/GyroFusion.test.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts |
| 2026-08-14 | [`098ec4b`](https://github.com/Doritozz05/Cubeforge/commit/098ec4b) | revert | revert(cube-3d-engine): restore rebased-interpolation gyro fusion over the spring follower | packages/cube-3d-engine/src/__tests__/GyroFusion.test.ts · packages/cube-3d-engine/src/hardware/GyroFusion.ts |
| 2026-08-14 | [`4242b7b`](https://github.com/Doritozz05/Cubeforge/commit/4242b7b) | feat | feat(web): modular bottom layout templates | apps/web/src/bottom-layout/BottomLayout.tsx · apps/web/src/bottom-layout/GenericBottomLayout.tsx · apps/web/src/bottom-layout/registry.ts · apps/web/src/bottom-layout/types.ts · … (14 en total) |
| 2026-08-14 | [`f222a6c`](https://github.com/Doritozz05/Cubeforge/commit/f222a6c) | feat | feat(web): tablet support — desktop layout at 768px, compact touch panel, header rework | apps/web/src/bottom-layout/GenericBottomLayout.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · … (32 en total) |
| 2026-08-14 | [`c1cc890`](https://github.com/Doritozz05/Cubeforge/commit/c1cc890) | sin clasificar | Update MainLayout.tsx | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-14 | [`9bb231e`](https://github.com/Doritozz05/Cubeforge/commit/9bb231e) | fix | fix(cube-3d-engine): trackball orbit camera — infinite rotation over the poles | packages/cube-3d-engine/src/__tests__/SceneManager.edgeCases.test.ts · packages/cube-3d-engine/src/core/SceneManager.ts |
| 2026-08-14 | [`db0e3a5`](https://github.com/Doritozz05/Cubeforge/commit/db0e3a5) | feat | feat(web): tri-state top bar control — always / hidden / auto-hide dock | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/i18n/locales/en.json · … (8 en total) |
| 2026-08-14 | [`7b7a5b7`](https://github.com/Doritozz05/Cubeforge/commit/7b7a5b7) | sin clasificar | Merge pull request #22 from Doritozz05/feat/trackball-orbit-camera | — |
| 2026-08-14 | [`d2f8c36`](https://github.com/Doritozz05/Cubeforge/commit/d2f8c36) | fix | fix(web): reveal the auto-hide dock while dragging a widget to it | apps/web/src/components/Layout/Header.tsx · apps/web/src/widgets/components/FloatingWidgetWrapper.tsx · apps/web/src/widgets/dock/WidgetDock.tsx · apps/web/src/widgets/dock/dockZoneState.ts |

### v0.6.7 — Trackball Orbit Camera & Tablet Layout / Cámara trackball y layout para tablet — 2026-08-14 → 2026-08-14 — 0 commits

**Resumen:** Cámara orbital trackball con rotación continua sobre polos y diseño responsive para tablet a 768px.

**Destacados:**
- Trackball orbit camera allowing continuous rotation over the poles without gimbal lock.
- Tablet responsive layout with height-aware clamp scaling (vw & vh) to prevent viewport clipping.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.6.8 — WCA Event Registry & Solid UI Surfaces / Registro de eventos WCA y superficies sólidas — 2026-08-15 → 2026-08-15 — 8 commits

**Resumen:** Registro oficial de eventos WCA y rediseño de superficies sólidas eliminando halos de cristal líquido.

**Destacados:**
- WCA event registry architecture standardizing puzzle categories and scramble formats.
- Solid UI styling refactor removing liquid glass for crisp surface styling and background image halo suppression.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-15 | [`5b8136f`](https://github.com/Doritozz05/Cubeforge/commit/5b8136f) | perf | perf(web): measure the dock rect only while dragging and suppress tooltips mid-drag | apps/web/src/hooks/useDraggable.ts · apps/web/src/widgets/dock/WidgetDock.tsx · packages/ui/src/components/dragActivity.ts · packages/ui/src/components/tooltip.tsx |
| 2026-08-15 | [`845c5fb`](https://github.com/Doritozz05/Cubeforge/commit/845c5fb) | feat | feat(web): request persistent browser storage to protect OPFS from eviction | apps/web/src/boot/storagePersistence.ts · apps/web/src/components/Settings/sections/AdvancedSection.tsx · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/i18n/locales/en.json · … (6 en total) |
| 2026-08-15 | [`749ec83`](https://github.com/Doritozz05/Cubeforge/commit/749ec83) | fix | fix(web): clear all app-namespaced localStorage keys on "Clear app storage" | apps/web/src/components/Settings/sections/AdvancedSection.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json |
| 2026-08-15 | [`9ec2519`](https://github.com/Doritozz05/Cubeforge/commit/9ec2519) | fix | fix(database): retry OPFS open before falling back to in-memory storage | packages/database/src/worker.ts |
| 2026-08-15 | [`51eb3c2`](https://github.com/Doritozz05/Cubeforge/commit/51eb3c2) | fix | fix(web): persist the volatile-storage warning as a banner | apps/web/src/components/Layout/AppShell.tsx |
| 2026-08-15 | [`b923737`](https://github.com/Doritozz05/Cubeforge/commit/b923737) | fix | fix(web): measure the dock overflow budget from the constraining ancestor | apps/web/src/widgets/dock/WidgetDock.tsx |
| 2026-08-15 | [`3a6640d`](https://github.com/Doritozz05/Cubeforge/commit/3a6640d) | fix | fix(web): use the canonical canvas colors in the PWA manifest | apps/web/public/theme-color.js · apps/web/src/theme/themeColors.ts · apps/web/vite.config.ts |
| 2026-08-15 | [`1c3765a`](https://github.com/Doritozz05/Cubeforge/commit/1c3765a) | docs | docs(roadmap): plan for WCA events coverage — generic foundation first | docs/01-roadmap/Plan_Eventos_WCA_2026-08.md |

### v0.6.9 — 2×2 Virtual Cube & iOS Ghost Click Filter / Cubo virtual 2×2 y filtro anticlic iOS — 2026-08-16 → 2026-08-17 — 11 commits

**Resumen:** Simulador virtual de 2×2 desde el selector del dock, filtro anticlic en iOS y soporte pointercancel.

**Destacados:**
- 2×2 Virtual Cube simulator driven directly by the dock puzzle selector with full QWERTY keyboard controls.
- Ghost click suppression on iOS/iPad preventing accidental 0.20s timer stops after hold-and-release.
- Handled pointercancel alongside pointerup so system gestures never trap the timer in ready state.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-16 | [`8ad86f7`](https://github.com/Doritozz05/Cubeforge/commit/8ad86f7) | feat | feat(events): WCA event registry and data integrity fixes | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/bottom-layout/BottomLayout.tsx · apps/web/src/bottom-layout/useBottomLayoutStats.ts · … (132 en total) |
| 2026-08-16 | [`45732ce`](https://github.com/Doritozz05/Cubeforge/commit/45732ce) | fix | fix(db): stop migrations from cascade-deleting solves on upgrade | apps/desktop/src/database-override.ts · apps/web/src/hooks/usePersistentSession.ts · apps/web/src/utils/dataIntegrity.ts · packages/database/src/__tests__/fk-cascade-regression.test.ts · … (6 en total) |
| 2026-08-16 | [`f44f67c`](https://github.com/Doritozz05/Cubeforge/commit/f44f67c) | feat | feat(web): 2×2 virtual cube driven by the dock puzzle selector | apps/web/src/App.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · … (16 en total) |
| 2026-08-16 | [`07cc0b3`](https://github.com/Doritozz05/Cubeforge/commit/07cc0b3) | fix | fix(web): decode-warm turn sounds and never repeat a sample back-to-back | apps/web/src/utils/__tests__/cubeTurnSounds.test.ts · apps/web/src/utils/cubeTurnSounds.ts · apps/web/src/views/Cube/CubeSimulatorView.tsx |
| 2026-08-16 | [`7bec5b4`](https://github.com/Doritozz05/Cubeforge/commit/7bec5b4) | feat | feat(web): show interactive scramble progress in the virtual cube | apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/views/Cube/CubeSimulatorView.tsx |
| 2026-08-16 | [`c5e1918`](https://github.com/Doritozz05/Cubeforge/commit/c5e1918) | fix | fix(web): play turn sounds via Web Audio to remove delay after tab backgrounding | apps/web/src/utils/__tests__/cubeTurnSounds.test.ts · apps/web/src/utils/cubeTurnSounds.ts |
| 2026-08-17 | [`ee6d514`](https://github.com/Doritozz05/Cubeforge/commit/ee6d514) | fix | fix(web): keep the audio device open so turn sounds play instantly after tab switch | apps/web/src/utils/__tests__/cubeTurnSounds.test.ts · apps/web/src/utils/cubeTurnSounds.ts |
| 2026-08-17 | [`ee13605`](https://github.com/Doritozz05/Cubeforge/commit/ee13605) | fix | fix(web): re-arm the virtual cube timer on repeated scramble presses | apps/web/src/hooks/__tests__/virtualCubeDoubleScrambleArm.test.ts · apps/web/src/hooks/useVirtualCubeSession.ts |
| 2026-08-17 | [`4c62428`](https://github.com/Doritozz05/Cubeforge/commit/4c62428) | fix | fix(web): re-run the virtual cube auto-arm on every scramble press | apps/web/src/hooks/__tests__/virtualCubeDoubleScrambleArm.test.ts · apps/web/src/hooks/useVirtualCubeSession.ts |
| 2026-08-17 | [`43e88b8`](https://github.com/Doritozz05/Cubeforge/commit/43e88b8) | fix | fix(web): remove the audible warm-keep loop and quiet turn-sound logging | apps/web/src/utils/__tests__/cubeTurnSounds.test.ts · apps/web/src/utils/cubeTurnSounds.ts |
| 2026-08-17 | [`defe5ba`](https://github.com/Doritozz05/Cubeforge/commit/defe5ba) | fix | fix(web): stop updating the widget store during CubeSimulatorCore render | apps/web/src/views/Cube/CubeSimulatorView.tsx |

### v0.7.0 — Supabase User Accounts & Authentication / Cuentas de usuario y auth Supabase — 2026-08-18 → 2026-08-18 — 6 commits

**Resumen:** Sistema de cuentas de usuario con Supabase, autenticación segura y perfiles en la nube.

**Destacados:**
- User authentication with sign-in, sign-up and session management via Supabase.
- Cloud profile synchronization linking PBs and settings across multiple devices.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-18 | [`399daa2`](https://github.com/Doritozz05/Cubeforge/commit/399daa2) | fix | fix(web): reclaim dock auto-hide space, tablet click-to-stop, mobile stats strip | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/hooks/use-mobile.ts · … (5 en total) |
| 2026-08-18 | [`5c9d09e`](https://github.com/Doritozz05/Cubeforge/commit/5c9d09e) | fix | fix(web): confirm solve deletion in Insights, space the touch detail | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json |
| 2026-08-18 | [`9f69f64`](https://github.com/Doritozz05/Cubeforge/commit/9f69f64) | style | style(web): hide scrollbars on the touch layout | apps/web/src/index.css |
| 2026-08-18 | [`49e0d5f`](https://github.com/Doritozz05/Cubeforge/commit/49e0d5f) | fix | fix(web): keep sidebar footer visible on short screens, hide rail scrollbar | apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/index.css |
| 2026-08-18 | [`0f81a34`](https://github.com/Doritozz05/Cubeforge/commit/0f81a34) | fix | fix(web): never open the app menu on tablet long-press | apps/web/src/components/Layout/AppShell.tsx |
| 2026-08-18 | [`fd3c0c1`](https://github.com/Doritozz05/Cubeforge/commit/fd3c0c1) | feat | feat(web): touch-first iPad interactions — swipe rail, tap-reveal dock, long-press tooltips | apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/LeftSidebar.tsx · apps/web/src/index.css · packages/ui/src/components/tooltip.tsx |

### v0.7.1 — Offline-First Cloud Sync Service / Servicio de sync offline-first — 2026-08-19 → 2026-08-19 — 3 commits

**Resumen:** Servicio de sincronización offline-first que encola solves locales y los respalda al recuperar conexión.

**Destacados:**
- Offline-first synchronization queuing mutations locally and syncing in the background.
- Conflict-resolution algorithm ensuring local PBs and new solves are never overwritten.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-19 | [`c3aea7f`](https://github.com/Doritozz05/Cubeforge/commit/c3aea7f) | feat | feat(web): solve selection mode with bulk move/delete, session-filter fixes | apps/web/src/App.tsx · apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/MoveToSessionDialog.tsx · apps/web/src/components/Insights/SolveAnalysisPanel.tsx · … (12 en total) |
| 2026-08-19 | [`12cc93f`](https://github.com/Doritozz05/Cubeforge/commit/12cc93f) | fix | fix: fix animation focus | apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Stage/TimerStage.tsx |
| 2026-08-19 | [`ad7a7d0`](https://github.com/Doritozz05/Cubeforge/commit/ad7a7d0) | sin clasificar | Update MainLayout.tsx | apps/web/src/components/Layout/MainLayout.tsx |

### v0.7.2 — OPFS Storage Worker & Fallbacks / Worker de almacenamiento OPFS y fallbacks — 2026-08-20 → 2026-08-20 — 17 commits

**Resumen:** Web Worker dedicado para Origin Private File System (OPFS) con fallbacks resilientes en localStorage.

**Destacados:**
- Origin Private File System (OPFS) dedicated worker for ultra-fast SQLite persistence.
- Tiered storage fallback ensuring zero data loss if browser OPFS permissions are restricted.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-20 | [`e9fe8c1`](https://github.com/Doritozz05/Cubeforge/commit/e9fe8c1) | sin clasificar | Update AppShell.tsx | apps/web/src/components/Layout/AppShell.tsx |
| 2026-08-20 | [`a52b12f`](https://github.com/Doritozz05/Cubeforge/commit/a52b12f) | fix | fix(timer-engine): clamp solve time to 10 ms minimum to prevent 0.00 s results | packages/timer-engine/src/TimerEngine.ts |
| 2026-08-20 | [`4d85144`](https://github.com/Doritozz05/Cubeforge/commit/4d85144) | fix | fix(web): disable timer space handler on all non-timer views | apps/web/src/App.tsx |
| 2026-08-20 | [`8fd5e8d`](https://github.com/Doritozz05/Cubeforge/commit/8fd5e8d) | fix | fix(web): replace left-border selection bar with ring-inset on solve list rows | apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-08-20 | [`f5f6739`](https://github.com/Doritozz05/Cubeforge/commit/f5f6739) | fix | fix(web): animate solve row selection with framer-motion pill matching sidebar style | apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-08-20 | [`248450e`](https://github.com/Doritozz05/Cubeforge/commit/248450e) | style | style(web): refine solve list selection with subtle hairline inset card and smooth fade | apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-08-20 | [`e24e544`](https://github.com/Doritozz05/Cubeforge/commit/e24e544) | sin clasificar | Update SolveListPanel.tsx | apps/web/src/components/Insights/SolveListPanel.tsx |
| 2026-08-20 | [`1c36882`](https://github.com/Doritozz05/Cubeforge/commit/1c36882) | fix | fix(web): touch timer reliability, configurable start key and keyboard-safe settings | apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/ShortcutsSection.tsx · apps/web/src/components/Stage/TimerStage.tsx · … (16 en total) |
| 2026-08-20 | [`92dcc3c`](https://github.com/Doritozz05/Cubeforge/commit/92dcc3c) | fix | fix(web): context menu stays usable over modal dialogs | apps/web/src/components/ContextMenu/ContextMenu.tsx |
| 2026-08-20 | [`a9e3f4f`](https://github.com/Doritozz05/Cubeforge/commit/a9e3f4f) | feat | feat(web): minimal mobile header, widgets in More, tablet bottom safe-area | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Layout/MobileMoreSheet.tsx · … (10 en total) |
| 2026-08-20 | [`620f9d3`](https://github.com/Doritozz05/Cubeforge/commit/620f9d3) | fix | fix(web): fit timer stage on touch tablets without scroll | apps/web/src/components/Layout/MainLayout.tsx · apps/web/src/components/Timer/TimerContainer.tsx |
| 2026-08-20 | [`01fa5ff`](https://github.com/Doritozz05/Cubeforge/commit/01fa5ff) | feat | feat(web): stack settings dropdown rows on mobile | apps/web/src/components/Settings/components/SettingRow.tsx · apps/web/src/components/Settings/sections/AppearanceSection.tsx · apps/web/src/components/Settings/sections/AudioSection.tsx · apps/web/src/components/Settings/sections/GeneralSection.tsx · … (5 en total) |
| 2026-08-20 | [`99d4b5c`](https://github.com/Doritozz05/Cubeforge/commit/99d4b5c) | fix | fix(web): scale timer and scramble with viewport height on short tablets | apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Timer/ManualTimeInput.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Timer/TimerDisplay.tsx |
| 2026-08-20 | [`542d4c2`](https://github.com/Doritozz05/Cubeforge/commit/542d4c2) | feat | feat(web): shrink bottom layout and open scramble preview from the 2D net | apps/web/src/bottom-layout/GenericBottomLayout.tsx · apps/web/src/components/Scramble/Scramble2DNet.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/i18n/locales/en.json · … (5 en total) |
| 2026-08-20 | [`3ceff49`](https://github.com/Doritozz05/Cubeforge/commit/3ceff49) | feat | feat(state): auto-hide the top bar by default | packages/state/src/__tests__/state.test.ts · packages/state/src/store.ts |
| 2026-08-20 | [`74b67b8`](https://github.com/Doritozz05/Cubeforge/commit/74b67b8) | fix | fix(web): reduce dock-to-scramble gap on short viewports | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-20 | [`8f074a2`](https://github.com/Doritozz05/Cubeforge/commit/8f074a2) | fix | fix(web): keep PB delta from pushing the timer | apps/web/src/components/Timer/TimerDisplay.tsx |

### v0.7.3 — Crash Diagnostics & Settings SHA Footer / Diagnósticos de caídas y pie SHA en ajustes — 2026-08-21 → 2026-08-21 — 19 commits

**Resumen:** Pantalla de diagnóstico de caídas, visor de logs y pie en Ajustes con versión activa y commit SHA.

**Destacados:**
- On-device crash screen and diagnostic log viewer for instant issue troubleshooting.
- Settings footer displaying active app version and build commit SHA.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-21 | [`b1e87c2`](https://github.com/Doritozz05/Cubeforge/commit/b1e87c2) | feat | feat(web): drop the More tab from the mobile bottom bar | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/MobileTabBar.tsx · apps/web/src/components/Layout/StageOverlays.tsx |
| 2026-08-21 | [`1a97eb3`](https://github.com/Doritozz05/Cubeforge/commit/1a97eb3) | fix | fix(web): center the puzzle selector label, chevron, and dropdown | apps/web/src/widgets/dock/pieces/puzzle/PuzzlePiece.tsx |
| 2026-08-21 | [`ce7b27a`](https://github.com/Doritozz05/Cubeforge/commit/ce7b27a) | fix | fix(web): make PWA service worker updates reach users without a hard refresh | apps/web/src/main.tsx · apps/web/tsconfig.app.json · apps/web/vite.config.ts · vercel.json |
| 2026-08-21 | [`79c15ee`](https://github.com/Doritozz05/Cubeforge/commit/79c15ee) | feat | feat(web): show app version in Settings and clean up lint/typecheck/CI gates | apps/desktop/tsconfig.json · apps/web/src/components/Layout/Header.tsx · apps/web/src/components/Settings/sections/CreditsSection.tsx · apps/web/src/components/Timer/hintFor.ts · … (10 en total) |
| 2026-08-21 | [`bd48da0`](https://github.com/Doritozz05/Cubeforge/commit/bd48da0) | fix | fix(web): remove invalid path-to-regexp pattern from vercel.json | vercel.json |
| 2026-08-21 | [`fb9e0c0`](https://github.com/Doritozz05/Cubeforge/commit/fb9e0c0) | fix | fix(web): add workbox-window as a direct dependency | apps/web/package.json · pnpm-lock.yaml |
| 2026-08-21 | [`43cf283`](https://github.com/Doritozz05/Cubeforge/commit/43cf283) | feat | feat(web): show the build commit SHA next to the app version in Settings | apps/web/src/components/Settings/sections/CreditsSection.tsx · apps/web/src/vite-env.d.ts · apps/web/vite.config.ts |
| 2026-08-21 | [`2fa9832`](https://github.com/Doritozz05/Cubeforge/commit/2fa9832) | feat | feat(accounts): Supabase accounts with offline-first cloud sync + full audit hardening (#23) | .gitignore · apps/desktop/src/database-override.ts · apps/web/package.json · apps/web/src/App.tsx · … (84 en total) |
| 2026-08-21 | [`a8aaee5`](https://github.com/Doritozz05/Cubeforge/commit/a8aaee5) | fix | fix(database): wire SharedWorker port and guard the build against regressions | apps/web/package.json · apps/web/scripts/verify-worker-build.mjs · packages/database/src/client.ts · packages/database/src/worker.ts |
| 2026-08-21 | [`b8b8589`](https://github.com/Doritozz05/Cubeforge/commit/b8b8589) | fix | fix(database): restore OPFS persistence with dedicated worker + fallback storage tiers | apps/web/eslint.config.js · apps/web/scripts/verify-worker-build.mjs · apps/web/src/components/Settings/sections/AdvancedSection.tsx · apps/web/src/hooks/usePersistentSession.ts · … (13 en total) |
| 2026-08-21 | [`5782941`](https://github.com/Doritozz05/Cubeforge/commit/5782941) | fix | fix(database): rescue data stranded across storage tiers | packages/database/src/__tests__/db.realEngine.smoke.test.ts · packages/database/src/__tests__/indexeddb-snapshot.test.ts · packages/database/src/__tests__/migrated-upload.test.ts · packages/database/src/indexeddb-snapshot.ts · … (6 en total) |
| 2026-08-21 | [`d23878d`](https://github.com/Doritozz05/Cubeforge/commit/d23878d) | feat | feat(web): on-device diagnostics — crash screen + log viewer | apps/web/src/boot/AppErrorBoundary.tsx · apps/web/src/boot/logCapture.ts · apps/web/src/components/LogViewer/LogViewer.tsx · apps/web/src/main.tsx |
| 2026-08-21 | [`6c99fae`](https://github.com/Doritozz05/Cubeforge/commit/6c99fae) | fix | fix(ui): prevent browser-translation crash on Radix Select | apps/web/src/boot/AppErrorBoundary.tsx · packages/ui/src/components/select.tsx |
| 2026-08-21 | [`5676e4c`](https://github.com/Doritozz05/Cubeforge/commit/5676e4c) | fix | fix(sync): tombstone deleted_at floored at row updated_at+1 to prevent LWW loss | apps/web/src/components/Layout/Header.tsx · apps/web/src/hooks/useAccount.ts · packages/database/src/migrations/migrations.ts · packages/database/src/repositories/sessions.repository.ts · … (5 en total) |
| 2026-08-21 | [`e8ef4a9`](https://github.com/Doritozz05/Cubeforge/commit/e8ef4a9) | fix | fix(cube3d): improve drag accuracy and fix core/translucent picking | apps/web/src/utils/cubeDragLayer.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-08-21 | [`a3a86fc`](https://github.com/Doritozz05/Cubeforge/commit/a3a86fc) | fix | fix(layout): prevent dock autohide while a dropdown/popover is open | apps/web/src/components/Layout/Header.tsx |
| 2026-08-21 | [`82e2686`](https://github.com/Doritozz05/Cubeforge/commit/82e2686) | fix | fix(profile): redesign layout for desktop/tablet with 2-column grid | apps/web/src/views/Profile/ProfileView.tsx |
| 2026-08-21 | [`edfc238`](https://github.com/Doritozz05/Cubeforge/commit/edfc238) | fix | fix(header): move anyPopoverOpen before scheduleRetract to fix TDZ crash | apps/web/src/components/Layout/Header.tsx |
| 2026-08-21 | [`c936032`](https://github.com/Doritozz05/Cubeforge/commit/c936032) | fix | fix: header popover | apps/web/src/components/Layout/Header.tsx · apps/web/vite.config.ts |

### v0.7.4 — Solve Multi-Select & Bulk Operations / Selección múltiple de solves y acciones en bloque — 2026-08-21 → 2026-08-21 — 0 commits

**Resumen:** Modo de selección múltiple de solves con mover, asignar penalizaciones y borrar en bloque.

**Destacados:**
- Solve multi-select mode with batch actions (bulk move to session, bulk delete, bulk penalty).
- Mobile stacked dropdown rows in Settings for easy touch navigation.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.7.5 — Profile View & 52-Week Activity Heatmap / Vista de perfil y heatmap de 52 semanas — 2026-08-22 → 2026-08-22 — 7 commits

**Resumen:** Vista de perfil completa con ProfileHero, identicon CubeMark y heatmap de actividad de 52 semanas.

**Destacados:**
- Full-page Profile view (ProfileView) with ProfileHero, CubeMark identicon, and StatStrip.
- 52-week solve activity heatmap (ActivityHeatmap) visualizing training consistency over the entire year.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-22 | [`b8377ba`](https://github.com/Doritozz05/Cubeforge/commit/b8377ba) | fix | fix(web): redesign profile layout for responsive devices and fix metric ring containment | apps/web/src/components/Identity/ProfileHero.tsx · apps/web/src/components/Identity/StatStrip.tsx · apps/web/src/components/Insights/atoms/MetricRing.tsx · apps/web/src/views/Profile/ProfileView.tsx |
| 2026-08-22 | [`4160521`](https://github.com/Doritozz05/Cubeforge/commit/4160521) | feat | feat(web): keep header visible on mobile across all views while preserving desktop layout | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-22 | [`e24ad8b`](https://github.com/Doritozz05/Cubeforge/commit/e24ad8b) | feat | feat(web): compact mobile Insights dashboard with consistent margins and dropdowns | apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · apps/web/src/components/Insights/atoms/ActivityHeatmap.tsx · … (10 en total) |
| 2026-08-22 | [`a8f98e9`](https://github.com/Doritozz05/Cubeforge/commit/a8f98e9) | feat | feat(web): redesign Training desktop into a single-page dashboard | apps/web/src/views/Training/TrainingDashboard.tsx · apps/web/src/views/Training/components/DashboardSections.tsx |
| 2026-08-22 | [`de28a58`](https://github.com/Doritozz05/Cubeforge/commit/de28a58) | fix | fix(web): add skill tree margins and center initial graph view | apps/web/src/views/SkillTree/SkillGraphCanvas.tsx · apps/web/src/views/SkillTree/UltraSkillTreeView.tsx |
| 2026-08-22 | [`8b0a27f`](https://github.com/Doritozz05/Cubeforge/commit/8b0a27f) | fix | fix(web): PWA updates without surprise mid-session reloads | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/main.tsx · apps/web/vite.config.ts · … (6 en total) |
| 2026-08-22 | [`cc81317`](https://github.com/Doritozz05/Cubeforge/commit/cc81317) | chore | chore(web): bump app version to 0.8.0 | apps/web/package.json |

### v0.7.6 — Sub-X Milestone Badges & 5 Performance Tabs / Insignias Sub-X y 5 pestañas de rendimiento — 2026-08-22 → 2026-08-22 — 0 commits

**Resumen:** Insignias Sub-X derivadas de PBs, 5 pestañas de rendimiento real y dashboard de entrenamiento.

**Destacados:**
- Sub-X milestone badges (e.g. Sub-10 3×3, Sub-4 2×2) dynamically computed from puzzle PBs.
- 5-tab performance center: Overview heatmap, per-puzzle stats, SRS review queue, algorithm mastery ring, and skill XP.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.7.7 — Zero-Latency SoundManager / SoundManager de latencia cero — 2026-08-23 → 2026-08-23 — 1 commits

**Resumen:** SoundManager profesional con calentamiento previo de AudioContext para sonido instantáneo desde el primer giro.

**Destacados:**
- Professional SoundManager with AudioContext pre-warming for zero-latency first turns.
- Audio buffer caching eliminating stutter during high-speed turning sequences.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-23 | [`6f36217`](https://github.com/Doritozz05/Cubeforge/commit/6f36217) | feat | feat(web): professional SoundManager with instant first-turn audio | apps/web/src/App.tsx · apps/web/src/audio/__tests__/soundManager.test.ts · apps/web/src/audio/__tests__/webAudioFakes.ts · apps/web/src/audio/soundManager.ts · … (7 en total) |

### v0.7.8 — Advanced F2L Slot Views & Fixed Pair Geometry / Vistas de slot F2L avanzado y geometría fija — 2026-08-24 → 2026-08-24 — 3 commits

**Resumen:** Correcciones de vista de slot en F2L avanzado manteniendo el par fijo en perspectiva al rotar.

**Destacados:**
- Kept F2L target pair fixed in position when rotating the slot view angle.
- Advanced F2L case grouping by slot state (Free Pair, Connected, Split, In Slot).

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-24 | [`e558c15`](https://github.com/Doritozz05/Cubeforge/commit/e558c15) | fix | fix(algorithm-db): keep F2L case pair fixed when rotating the slot view | packages/algorithm-db/src/__tests__/casePresentation.test.ts · packages/algorithm-db/src/visualization/casePresentation.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-08-24 | [`ca9e6e8`](https://github.com/Doritozz05/Cubeforge/commit/ca9e6e8) | feat | feat(algorithm-db): show BirdF2L codes on basic F2L cases | .gitignore · packages/algorithm-db/src/seed/cfop-f2l.ts · pruebas/scripts/_check-f2l-nums.py · pruebas/scripts/_debug-2510-pair.ts · … (164 en total) |
| 2026-08-24 | [`a31762f`](https://github.com/Doritozz05/Cubeforge/commit/a31762f) | fix | fix(algorithm-db): drop misattributed SCDB algs from Advanced F2L | packages/algorithm-db/src/__tests__/scdb-import-comparison.test.ts · packages/algorithm-db/src/__tests__/scdb-seed-catalog.test.ts · packages/algorithm-db/src/seed/cfop-f2l.ts · pruebas/scripts/generate_seed_catalog.py |

### v0.7.9 — BirdF2L Notation Badges & Profile Country Sorting / Insignias BirdF2L y orden de países en perfil — 2026-08-24 → 2026-08-24 — 0 commits

**Resumen:** Códigos BirdF2L mostrados directamente en tarjetas de F2L básico y orden alfabético de países en perfil.

**Destacados:**
- BirdF2L notation codes displayed directly on basic F2L case cards.
- Profile country and region selector ordered alphabetically by the active language's localized display names.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.8.0 — Slot-Agnostic Relational Signatures / Signaturas relacionales independientes del slot — 2026-08-25 → 2026-08-25 — 0 commits

**Resumen:** Detección de F2L independiente del slot mediante signaturas geométricas relacionales.

**Destacados:**
- Slot-agnostic F2L case detection using relational geometry signatures matching patterns in any slot (FR, FL, BR, BL).
- Vector transformation pipeline normalizing piece relationships independent of cube rotation.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.8.1 — Mini 3D Case Cubes with Real Sticker Colors / Mini-cubos 3D con colores reales — 2026-08-26 → 2026-08-26 — 9 commits

**Resumen:** Mini-cubos 3D en panel de detección con colores reales del solve y replay 3D para 2×2 virtual.

**Destacados:**
- Mini 3D case cubes in detection panel showing the solve's real sticker colors.
- 3D Replay support for virtual 2×2 solves with animated layer turns and orientation tracking.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-26 | [`8e886e8`](https://github.com/Doritozz05/Cubeforge/commit/8e886e8) | feat | feat(algorithm-db): slot-agnostic F2L case detection via relational signature | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/algorithm-db/src/index.ts · packages/algorithm-db/src/recognition/README.md · packages/algorithm-db/src/recognition/__tests__/caseCatalog.test.ts · … (22 en total) |
| 2026-08-26 | [`5708e97`](https://github.com/Doritozz05/Cubeforge/commit/5708e97) | feat | feat(web): mini 3D case cubes in detection panel with the solve's real colors | apps/web/src/services/Case3DRenderAdapter.ts · apps/web/src/services/Global3DSnapshotService.ts · apps/web/src/views/Algorithms/components/Case3DDiagram.tsx · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · … (6 en total) |
| 2026-08-26 | [`ea54d22`](https://github.com/Doritozz05/Cubeforge/commit/ea54d22) | fix | fix(cube-3d-engine): replay applies deferred moves stranded by aborted grip chains | packages/cube-3d-engine/src/__tests__/transportRace.test.ts · packages/cube-3d-engine/src/replay/ReplayEngine.ts |
| 2026-08-26 | [`aa48443`](https://github.com/Doritozz05/Cubeforge/commit/aa48443) | fix | fix(sync-engine): cloud profile wins the claim merge + persist identicon seed | packages/sync-engine/src/SyncEngine.ts · packages/sync-engine/src/__tests__/sync.integrity.test.ts · packages/sync-engine/src/pull.ts · packages/sync-engine/src/push.ts · … (5 en total) |
| 2026-08-26 | [`8d66966`](https://github.com/Doritozz05/Cubeforge/commit/8d66966) | fix | fix(lint): clear pre-existing eslint errors in test files to unblock CI | packages/algorithm-db/src/recognition/__tests__/parkedCornerMatrix.test.ts · packages/sync-engine/src/__tests__/sync.integrity.test.ts |
| 2026-08-26 | [`b10c56e`](https://github.com/Doritozz05/Cubeforge/commit/b10c56e) | chore | chore(lint): allowlist sync-integrity test from the line gate | scripts/lint-lines.cjs |
| 2026-08-26 | [`361feae`](https://github.com/Doritozz05/Cubeforge/commit/361feae) | sin clasificar | Merge pull request #24 from Doritozz05/feat/case-detector | — |
| 2026-08-26 | [`4ca02c6`](https://github.com/Doritozz05/Cubeforge/commit/4ca02c6) | fix | fix(web): order country list by the active language's display name | apps/web/src/components/Settings/sections/ProfileSection.tsx · apps/web/src/utils/countries.ts |
| 2026-08-26 | [`f8c468c`](https://github.com/Doritozz05/Cubeforge/commit/f8c468c) | feat | feat(web): enable replay for virtual 2×2 solves | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/hooks/useSolveCompletion.ts · apps/web/src/views/Cube/CubeSimulatorView.tsx |

### v0.8.2 — Unified CFOP Case Analysis Architecture / Arquitectura unificada de análisis CFOP — 2026-08-26 → 2026-08-26 — 0 commits

**Resumen:** Motor unificado de análisis CFOP compartido idénticamente entre smart cube, cubo virtual y reconstrucciones.

**Destacados:**
- Unified CFOP case analysis architecture across smart cube, virtual cube and reconstructions.
- Shared case detection cache ensuring instant analysis results across all solve viewers.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.8.3 — 100% Color-Neutral Recognition Engine / Motor de reconocimiento 100% color-neutral — 2026-08-27 → 2026-08-27 — 0 commits

**Resumen:** Motor de reconocimiento F2L, OLL y PLL 100% independiente del color con corrección de reflexión quiral.

**Destacados:**
- 100% color-neutral F2L, OLL and PLL recognition engine.
- Fixed chiral reflection detection bug in last layer OLL and PLL cases.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.8.4 — Floating Stickers & Direct Replay Seek / Stickers flotantes y salto en replay — 2026-08-28 → 2026-08-28 — 17 commits

**Resumen:** Stickers flotantes en replay 3D, salto directo desde filas de detección y detección de casos desde texto.

**Destacados:**
- Direct replay seeking: clicking any detection row (Cross, F2L pairs, OLL, PLL) jumps the 3D replay to that exact moment.
- Floating sticker 3D projections during replay and analysis.
- State-based OLL and PLL case detection directly from reconstruction text.
- Derived real F2L pair sticker colors via 3D vector geometry and locked mini cube to slot angles.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-28 | [`60b818d`](https://github.com/Doritozz05/Cubeforge/commit/60b818d) | feat | feat(analysis): state-based OLL/PLL case detection for reconstruction text | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/algorithm-db/src/__tests__/debug-two-sided-auf.test.ts · packages/algorithm-db/src/recognition/__tests__/cross-face-probe.test.ts · packages/algorithm-db/src/recognition/__tests__/lastLayerProbes.test.ts · … (21 en total) |
| 2026-08-28 | [`e89a25f`](https://github.com/Doritozz05/Cubeforge/commit/e89a25f) | fix | fix(web): seek replay from detection rows and map F2L colors | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · packages/analysis-engine/src/__tests__/f2l-pair-colors.test.ts · … (6 en total) |
| 2026-08-28 | [`1ecb090`](https://github.com/Doritozz05/Cubeforge/commit/1ecb090) | fix | fix(web): orient F2L pair colors consistently | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx |
| 2026-08-28 | [`6019709`](https://github.com/Doritozz05/Cubeforge/commit/6019709) | fix | fix(web): keep FR green-left and mirror FL pairs | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx |
| 2026-08-28 | [`c736a3f`](https://github.com/Doritozz05/Cubeforge/commit/c736a3f) | fix | fix(analysis): wire real F2L pair colors through the render path | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/__tests__/f2l-pair-colors.test.ts · packages/analysis-engine/src/pipeline/segmentF2LPairs.ts · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts |
| 2026-08-28 | [`20cfc08`](https://github.com/Doritozz05/Cubeforge/commit/20cfc08) | fix | fix(web): rotate F2L mini cube to the pair's slot for the real colors | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/__tests__/f2l-pair-colors.test.ts · packages/analysis-engine/src/pipeline/segmentF2LPairs.ts · packages/analysis-engine/src/reconstruction/analyzeSolveText.ts |
| 2026-08-28 | [`416ee00`](https://github.com/Doritozz05/Cubeforge/commit/416ee00) | fix | fix(web): derive F2L pair colors via 3D vector geometry and lock mini cube to FR | apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · packages/analysis-engine/src/__tests__/f2l-pair-colors.test.ts · packages/analysis-engine/src/pipeline/segmentF2LPairs.ts · packages/math-core/src/methods/cfop/ColorPhaseDetector.ts |
| 2026-08-28 | [`32273eb`](https://github.com/Doritozz05/Cubeforge/commit/32273eb) | fix | fix(algorithm-db): fix chiral reflection bug in last layer OLL and PLL case detection | packages/algorithm-db/src/recognition/__tests__/cross-face-probe.test.ts · packages/algorithm-db/src/recognition/__tests__/test-all-6-crossfaces.test.ts · packages/algorithm-db/src/recognition/probes/lastLayerProbes.ts · packages/algorithm-db/tsconfig.json · … (5 en total) |
| 2026-08-28 | [`cac5ff6`](https://github.com/Doritozz05/Cubeforge/commit/cac5ff6) | fix | fix(analysis-engine): defer F2L pair completion in wide conjugates to conserve base slots | packages/analysis-engine/src/__tests__/recon-2542-f2l-conjugate.test.ts · packages/analysis-engine/src/pipeline/segmentF2LPairs.ts |
| 2026-08-28 | [`cccb7ff`](https://github.com/Doritozz05/Cubeforge/commit/cccb7ff) | feat | feat(algorithm-db): make OLL and PLL recognition 100% color-neutral | packages/algorithm-db/src/recognition/__tests__/lastLayerProbes.test.ts · packages/algorithm-db/src/recognition/probes/lastLayerProbes.ts · packages/analysis-engine/src/__tests__/reconz-11889-luke-garrett-color-neutral.test.ts |
| 2026-08-28 | [`deabf5e`](https://github.com/Doritozz05/Cubeforge/commit/deabf5e) | feat | feat(math-core, analysis-engine): make F2L frame tracking and pair segmentation 100% color-neutral | packages/algorithm-db/src/recognition/__tests__/parkedCornerMatrix.test.ts · packages/analysis-engine/src/__tests__/reconz-11417-yiheng-wang-u-cross.test.ts · packages/analysis-engine/src/phases/PhaseSplitter.ts · packages/analysis-engine/src/pipeline/segmentF2LPairs.ts · … (7 en total) |
| 2026-08-28 | [`d51cd69`](https://github.com/Doritozz05/Cubeforge/commit/d51cd69) | fix | fix(math-core): add explicit rootDir to tsconfig compilerOptions | packages/math-core/tsconfig.json |
| 2026-08-28 | [`6a9f728`](https://github.com/Doritozz05/Cubeforge/commit/6a9f728) | fix | fix(web): clean up OurDetectionPanel JSX syntax and add reconstruction i18n keys | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-28 | [`98757d3`](https://github.com/Doritozz05/Cubeforge/commit/98757d3) | feat | feat(web): redesign reconstruction detail with fixed header and anchored replay | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · docs/16-user/Reconstructions_View.md |
| 2026-08-28 | [`60be9bd`](https://github.com/Doritozz05/Cubeforge/commit/60be9bd) | fix | fix(web): improve reconstruction replay layout and header alignment | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-28 | [`8f057b8`](https://github.com/Doritozz05/Cubeforge/commit/8f057b8) | feat | feat(replay): add floating stickers projection in 3D replay and analysis settings | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Settings/sections/AnalysisSection.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · … (9 en total) |
| 2026-08-28 | [`28956f4`](https://github.com/Doritozz05/Cubeforge/commit/28956f4) | feat | feat(reconstructions): add vertical layout mode and improve tablet responsiveness in detail view | apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/views/Reconstructions/OurDetectionPanel.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |

### v0.8.5 — Reconstruction Detail Redesign & Vertical Layout / Rediseño de detalle de reconstrucción — 2026-08-28 → 2026-08-28 — 0 commits

**Resumen:** Detalle de reconstrucción rediseñado con cabecera fija, replay 3D anclado, layout vertical y diseño tablet.

**Destacados:**
- Redesigned reconstruction detail with fixed header and anchored replay panel.
- Vertical layout mode and improved tablet responsiveness in reconstruction detail view.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.8.6 — In-App Theater Fullscreen Replay / Replay de cine en pantalla completa — 2026-08-29 → 2026-08-29 — 21 commits

**Resumen:** Replay de cine en pantalla completa con atajo ESC, gestos táctiles y zoom por pellizco.

**Destacados:**
- Theater replay: in-app fullscreen mode with ESC shortcut, touch gestures and pinch-to-zoom, hiding sidebars and headers.
- Responsive mobile playback controls for 3D replay with scrubbing timeline.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-29 | [`3757960`](https://github.com/Doritozz05/Cubeforge/commit/3757960) | sin clasificar | Merge pull request #25 from Doritozz05/refactor/our-detection-panel | — |
| 2026-08-29 | [`bbe4234`](https://github.com/Doritozz05/Cubeforge/commit/bbe4234) | fix | fix(reconstructions): clean up replay card styling, remove nested panel artifacts and redundant header | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-29 | [`f91358b`](https://github.com/Doritozz05/Cubeforge/commit/f91358b) | feat | feat(replay): add in-app theater fullscreen mode to all 3D replays with ESC shortcut | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json |
| 2026-08-29 | [`ce62902`](https://github.com/Doritozz05/Cubeforge/commit/ce62902) | fix | fix(replay): hide sidebar, header, and tabbar when in-app fullscreen replay is active | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/index.css |
| 2026-08-29 | [`4c327e8`](https://github.com/Doritozz05/Cubeforge/commit/4c327e8) | feat | feat(3d-engine): refactor orbit camera to spherical turntable and eliminate roll drift | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/hooks/useCube3D.ts · apps/web/src/views/Algorithms/components/Case3DDiagram.tsx · … (8 en total) |
| 2026-08-29 | [`6e77a46`](https://github.com/Doritozz05/Cubeforge/commit/6e77a46) | feat | feat(replay): add touch gestures, pinch-zoom, and responsive mobile playback controls | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx · packages/cube-3d-engine/src/core/Cube3DEngine.ts · … (5 en total) |
| 2026-08-29 | [`b0716c4`](https://github.com/Doritozz05/Cubeforge/commit/b0716c4) | style | style(web): standardize Tailwind utility classes in ReplaySection and ReconstructionDetailView | apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-29 | [`dd09138`](https://github.com/Doritozz05/Cubeforge/commit/dd09138) | fix | fix(recon): allow unified page scrolling on mobile while keeping desktop split layout | apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-29 | [`e851922`](https://github.com/Doritozz05/Cubeforge/commit/e851922) | fix | fix(recon): remove redundant lg:max-w-none class in detail view | apps/web/src/views/Reconstructions/ReconstructionDetailView.tsx |
| 2026-08-29 | [`fdb8b2d`](https://github.com/Doritozz05/Cubeforge/commit/fdb8b2d) | fix | fix(reconstructions): align table grid columns and fix method badge overflow | apps/web/src/views/Reconstructions/ReconstructionsView.tsx · docs/16-user/Reconstructions_View.md |
| 2026-08-29 | [`1d9d138`](https://github.com/Doritozz05/Cubeforge/commit/1d9d138) | fix | fix(reconstructions): rename static recon-data folder to stop shadowing the SPA route | DATA_SOURCES.md · apps/web/public/recon-data/data/chunk-000.json · apps/web/public/recon-data/data/chunk-001.json · apps/web/public/recon-data/data/chunk-002.json · … (224 en total) |
| 2026-08-29 | [`ea90904`](https://github.com/Doritozz05/Cubeforge/commit/ea90904) | sin clasificar | Update PuzzlePiece.tsx | apps/web/src/widgets/dock/pieces/puzzle/PuzzlePiece.tsx |
| 2026-08-29 | [`c46651a`](https://github.com/Doritozz05/Cubeforge/commit/c46651a) | feat | feat(web): add dynamic solve context menu, fix backdrop and selection dialogs | apps/web/src/components/ContextMenu/ContextMenu.tsx · apps/web/src/components/ContextMenu/contextMenuStore.ts · apps/web/src/components/Insights/InsightsDashboard.tsx · apps/web/src/components/Insights/SolveListPanel.tsx · … (7 en total) |
| 2026-08-29 | [`787869b`](https://github.com/Doritozz05/Cubeforge/commit/787869b) | feat | feat(dock): add random puzzle roulette slot machine piece with pool customization | apps/web/src/components/ContextMenu/ContextMenu.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/Header.tsx · apps/web/src/i18n/locales/en.json · … (9 en total) |
| 2026-08-29 | [`24f92ba`](https://github.com/Doritozz05/Cubeforge/commit/24f92ba) | fix | fix(dock): fix descender clipping in puzzle selector and keep slot lever knob red | apps/web/src/widgets/dock/pieces/puzzle/PuzzlePiece.tsx |
| 2026-08-29 | [`c84eb54`](https://github.com/Doritozz05/Cubeforge/commit/c84eb54) | fix | fix(dock): remove sparkles icon from random puzzle context menu | apps/web/src/widgets/dock/pieces/random-puzzle/RandomPuzzlePiece.tsx |
| 2026-08-29 | [`8d77473`](https://github.com/Doritozz05/Cubeforge/commit/8d77473) | fix | fix(dock): center and align lever knob and rod perfectly on track groove | apps/web/src/widgets/dock/pieces/random-puzzle/RandomPuzzlePiece.tsx |
| 2026-08-29 | [`830c54a`](https://github.com/Doritozz05/Cubeforge/commit/830c54a) | refactor | refactor(dock): refine lever styling and layout in RandomPuzzlePiece | apps/web/src/widgets/dock/pieces/random-puzzle/RandomPuzzlePiece.tsx |
| 2026-08-29 | [`7464a4e`](https://github.com/Doritozz05/Cubeforge/commit/7464a4e) | feat | feat(dock): improve random puzzle lever animation with bottom-anchored compressing rod and ball slide | apps/web/src/widgets/dock/pieces/random-puzzle/RandomPuzzlePiece.tsx |
| 2026-08-29 | [`fc1f869`](https://github.com/Doritozz05/Cubeforge/commit/fc1f869) | fix | fix(dock): keep context menu open when selecting or toggling random puzzle pool items | apps/web/src/widgets/dock/pieces/random-puzzle/RandomPuzzlePiece.tsx |
| 2026-08-29 | [`05c35b4`](https://github.com/Doritozz05/Cubeforge/commit/05c35b4) | sin clasificar | Unify CFOP case analysis across smart/virtual/reconstructions + professional Insights analytics (#26) | apps/web/src/components/Cases/CaseMiniCube.tsx · apps/web/src/components/Cases/CfopMiniBar.tsx · apps/web/src/components/Cases/CountCell.tsx · apps/web/src/components/Cases/LastLayerCaseCell.tsx · … (37 en total) |

### v0.8.7 — Spherical Turntable Orbit Camera / Cámara orbital esférica tipo turntable — 2026-08-29 → 2026-08-29 — 0 commits

**Resumen:** Cámara orbital turntable que elimina la deriva de inclinación y scroll móvil optimizado.

**Destacados:**
- Spherical turntable orbit camera eliminating roll drift during 3D inspection.
- Unified mobile page scrolling in reconstruction view while maintaining desktop split layout.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|

### v0.8.8 — Professional Pause Analytics & Case Intelligence / Analítica de pausas e inteligencia de casos — 2026-08-30 → 2026-08-30 — 7 commits

**Resumen:** Modelo profesional de pausas (reconocimiento vs ejecución) e inteligencia de casos.

**Destacados:**
- Professional recognition vs execution pause model distinguishing recognition gaps from execution turning time.
- Case intelligence distribution profiling frequency, average time, p75 and recognition time for every individual F2L, OLL and PLL case.
- Headless technical statistics engine aggregating phase distributions (p25/p50/p75), move economy, rotation counts, lookahead fluidity and cross efficiency vs optimal solver.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-30 | [`7c51b05`](https://github.com/Doritozz05/Cubeforge/commit/7c51b05) | style | style(web): use standard Tailwind utility classes in SolveAnalysisPanel | apps/web/src/components/Insights/SolveAnalysisPanel.tsx |
| 2026-08-30 | [`436352d`](https://github.com/Doritozz05/Cubeforge/commit/436352d) | feat | feat(analysis): professional pause model — real per-phase recognition & pure execution | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/utils/__tests__/insights.test.ts · … (13 en total) |
| 2026-08-30 | [`370770d`](https://github.com/Doritozz05/Cubeforge/commit/370770d) | feat | feat(analysis): pair recognition — inter-pair gaps as recognition, pauseBeforeMs renamed | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/utils/seedDemoData.ts · … (15 en total) |
| 2026-08-30 | [`4f07395`](https://github.com/Doritozz05/Cubeforge/commit/4f07395) | feat | feat(analysis): real cross efficiency via solveCross — optimal / actual | packages/analysis-engine/src/__tests__/CFOPMetricsCalculator.integration.test.ts · packages/analysis-engine/src/metrics/CFOPMetricsCalculator.ts · packages/analysis-engine/src/metrics/MetricsAggregator.ts |
| 2026-08-30 | [`8daf503`](https://github.com/Doritozz05/Cubeforge/commit/8daf503) | style | style(layout): open the 3D cube panel at 50% of the viewport on desktop | apps/web/src/components/Layout/MainLayout.tsx |
| 2026-08-30 | [`68e15ae`](https://github.com/Doritozz05/Cubeforge/commit/68e15ae) | chore | Update turbo.json | turbo.json |
| 2026-08-30 | [`c313378`](https://github.com/Doritozz05/Cubeforge/commit/c313378) | feat | feat(insights): recognition vs execution per case + session pause breakdown by cause | apps/web/src/components/Insights/CaseRecognitionSection.tsx · apps/web/src/components/Insights/OverviewPanel.tsx · apps/web/src/components/Insights/PauseCauseSection.tsx · apps/web/src/i18n/locales/en.json · … (11 en total) |

### v0.8.9 — Puzzle Roulette & Reconstruction Table Polish / Ruleta de puzzles y tablas de reconstrucción — 2026-08-31 → 2026-08-31 — 1 commits

**Resumen:** Pieza de ruleta de puzzles con palanca animada y tabla de reconstrucciones con columna de puzzle.

**Destacados:**
- Customizable random puzzle roulette piece in the dock with spring-animated lever and pool selector.
- Reconstructions table with dedicated puzzle column, aligned grid layout and unified mobile page scroll.
- Accurate method group representation in reconstruction tables.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-08-31 | [`f766e70`](https://github.com/Doritozz05/Cubeforge/commit/f766e70) | fix | fix(reconstructions): stop misrepresenting puzzles — replay placeholder, methodGroup fix, puzzle column | apps/web/public/recon-data/data/chunk-000.json · apps/web/public/recon-data/data/chunk-001.json · apps/web/public/recon-data/data/chunk-002.json · apps/web/public/recon-data/data/chunk-003.json · … (52 en total) |

### v0.9.0 — 3D Pyraminx Engine & Face Simulator / Motor 3D de Pyraminx y simulador — 2026-09-01 → 2026-09-01 — 1 commits

**Resumen:** Motor 3D tetraédrico de Pyraminx, simulador virtual con giros por arrastre y mezclas oficiales WCA.

**Destacados:**
- Tetrahedral Pyraminx 3D engine with 4 corner tips, 4 center-octahedral hubs, and 6 edge pieces.
- Virtual Pyraminx simulator with interactive pointer-drag layer turning and tip rotations.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-09-01 | [`19fdcce`](https://github.com/Doritozz05/Cubeforge/commit/19fdcce) | feat | feat(multi-puzzle): 3D Pyraminx engine, virtual simulator and drag interactions (#27) | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Insights/ReplaySection.tsx · apps/web/src/components/Layout/AppShell.tsx · apps/web/src/hooks/__tests__/pyraminxSessionCore.test.ts · … (57 en total) |

### v0.9.1 — Infinite F2L, Skill Radar & Changelog / Infinite F2L, radar de skills y changelog — 2026-09-02 → 2026-09-02 — 18 commits

**Resumen:** Modo de entrenamiento continuo Infinite F2L, radar universal de habilidades en 6 ejes, navegador móvil y changelog interactivo.

**Destacados:**
- Infinite F2L continuous training mode: automatically generates and applies the next F2L pair scramble the instant the active pair is solved.
- Universal 6-axis session skill radar (SkillRadarProfile) evaluating solve performance against professional benchmarks.
- Mobile Method Navigator with floating bottom drawer, auto-prompt method suggestions, and skeleton placeholders.
- Tactile single-collapsible changelog accordion closing previous releases on open with exact dates and commit links.
- Looping video & animated GIF backgrounds (<10s) with IndexedDB persistence, resting as a static frame and looping during inspection and solve.
- Experimental 'Background on all views' setting allowing custom backgrounds across all tabs (Insights, Algorithms, Training, Skill Tree, Profile).
- 'Always animate' toggle for video and GIF backgrounds to run continuously without waiting for inspection or solve.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-09-02 | [`275de84`](https://github.com/Doritozz05/Cubeforge/commit/275de84) | chore | chore(db): drop legacy sessions.puzzle_type end to end (#28) | apps/web/package.json · apps/web/src/App.tsx · apps/web/src/hooks/useCube3D.ts · apps/web/src/hooks/usePersistentSession.ts · … (37 en total) |
| 2026-09-02 | [`dfd0a4d`](https://github.com/Doritozz05/Cubeforge/commit/dfd0a4d) | feat | feat(infinite-f2l): Infinite F2L training mode with pair history and advanced recognition (#29) | apps/web/package.json · apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Cube3D/MiniCube3DPanel.tsx · apps/web/src/components/Layout/Header.tsx · … (41 en total) |
| 2026-09-02 | [`bdf9ba3`](https://github.com/Doritozz05/Cubeforge/commit/bdf9ba3) | ui | ui(infinite-f2l): pair history as a responsive grid of case cards (#30) | apps/web/src/views/Training/infinite-f2l/PairHistoryDialog.tsx |
| 2026-09-02 | [`24725b1`](https://github.com/Doritozz05/Cubeforge/commit/24725b1) | feat | feat(cube-3d-engine): natural downward perspective for initial view and calibration | packages/cube-3d-engine/src/__tests__/Cube3DEngine.camera.test.ts · packages/cube-3d-engine/src/core/Cube3DEngine.ts |
| 2026-09-02 | [`29259f0`](https://github.com/Doritozz05/Cubeforge/commit/29259f0) | feat | feat(algorithms): mobile default view without preselection and auto-prompt navigator | apps/web/src/views/Algorithms/AlgorithmDashboard.tsx · apps/web/src/views/Algorithms/__tests__/MobileMethodNavigator.test.ts · apps/web/src/views/Algorithms/components/MobileMethodNavigator.tsx |
| 2026-09-02 | [`130844f`](https://github.com/Doritozz05/Cubeforge/commit/130844f) | feat | feat(algorithms): add case-sized skeleton placeholders on mobile empty state | apps/web/src/views/Algorithms/AlgorithmDashboard.tsx |
| 2026-09-02 | [`110d15d`](https://github.com/Doritozz05/Cubeforge/commit/110d15d) | refactor | refactor(algorithms): flatten CLL single-subset method and remove redundant EG nesting | apps/web/src/views/Algorithms/__tests__/MobileMethodNavigator.test.ts · apps/web/src/views/Algorithms/components/MethodTree.tsx · apps/web/src/views/Algorithms/components/MobileMethodNavigator.tsx · packages/algorithm-db/src/methodRegistry.ts |
| 2026-09-02 | [`d19fb7e`](https://github.com/Doritozz05/Cubeforge/commit/d19fb7e) | feat | feat(insights): add universal session skill radar and refine benchmarks | apps/web/src/components/Insights/SolveAnalysisPanel.tsx · apps/web/src/components/Insights/TechnicalSection.tsx · apps/web/src/components/Insights/atoms/SkillRadarChart.tsx · apps/web/src/components/Insights/atoms/index.ts · … (11 en total) |
| 2026-09-02 | [`1a98007`](https://github.com/Doritozz05/Cubeforge/commit/1a98007) | fix | fix(statistics): calibrate smart-cube ergonomics and reward progression in session consistency | packages/statistics/src/__tests__/skill-radar.test.ts · packages/statistics/src/technical.ts |
| 2026-09-02 | [`d5d241c`](https://github.com/Doritozz05/Cubeforge/commit/d5d241c) | fix | fix(statistics): sort solves chronologically for trendline and tune consistency curve | packages/statistics/src/__tests__/skill-radar.test.ts · packages/statistics/src/technical.ts |
| 2026-09-02 | [`0be300b`](https://github.com/Doritozz05/Cubeforge/commit/0be300b) | fix | fix(insights): enforce strict chronological sorting by timestamp regardless of UI filter | apps/web/src/components/Insights/TechnicalSection.tsx · packages/statistics/src/__tests__/skill-radar.test.ts · packages/statistics/src/technical.ts |
| 2026-09-02 | [`a78b97b`](https://github.com/Doritozz05/Cubeforge/commit/a78b97b) | fix | fix(build): pin stable packageManager pnpm@10.5.2 to resolve Vercel deployment error | package.json |
| 2026-09-02 | [`4dfe3ab`](https://github.com/Doritozz05/Cubeforge/commit/4dfe3ab) | sin clasificar | Update TechnicalSection.tsx | apps/web/src/components/Insights/TechnicalSection.tsx |
| 2026-09-02 | [`2739e3c`](https://github.com/Doritozz05/Cubeforge/commit/2739e3c) | sin clasificar | Update TechnicalSection.tsx | apps/web/src/components/Insights/TechnicalSection.tsx |
| 2026-09-02 | [`b81dae8`](https://github.com/Doritozz05/Cubeforge/commit/b81dae8) | feat | feat(settings): redesign changelog with clean flat accordion and exact dates | apps/web/package.json · apps/web/src/components/Settings/SettingsDialog.tsx · apps/web/src/components/Settings/sections/ChangelogSection.tsx · apps/web/src/components/Settings/settings.constants.ts · … (11 en total) |
| 2026-09-02 | [`80dc181`](https://github.com/Doritozz05/Cubeforge/commit/80dc181) | feat | feat(settings): refine procedural changelog accordion, dynamic credits version and v0.9.1 semver sync | apps/web/package.json · apps/web/src/components/Settings/sections/ChangelogSection.tsx · apps/web/src/components/Settings/sections/CreditsSection.tsx · apps/web/src/data/changelog/changelog.json · … (8 en total) |
| 2026-09-02 | [`4a19eff`](https://github.com/Doritozz05/Cubeforge/commit/4a19eff) | feat | feat(timer): support looping video and animated GIF backgrounds synced with inspection and solving | apps/web/src/components/Layout/AppShell.tsx · apps/web/src/components/Layout/BackgroundLayer.tsx · apps/web/src/components/Settings/components/CustomBackgroundSetting.tsx · apps/web/src/data/changelog/changelog.json · … (14 en total) |
| 2026-09-02 | [`3c0c18e`](https://github.com/Doritozz05/Cubeforge/commit/3c0c18e) | feat | feat(settings): add experimental setting to display background across all views | apps/web/src/components/Layout/BackgroundLayer.tsx · apps/web/src/components/Settings/components/CustomBackgroundSetting.tsx · apps/web/src/data/changelog/changelog.json · apps/web/src/i18n/locales/en.json · … (9 en total) |

---

### v0.9.2 — Theme Studio Avance: Temas, Tipografía, Scramble, Liquid Glass & UI Polish / Theme Studio: Themes, Typography, Scramble, Liquid Glass & UI Polish — 2026-09-02 → 2026-09-09 — 30 commits

**Resumen:** Avanza el Theme Studio con 4 temas nuevos (Tokyo Night, Gruvbox Dark, Dracula, Cyberpunk Neon), selector expandible "Explorar más temas", 3 modos de aplicación de fuente de dígitos, panel de scramble y timer como tarjetas, selector de layout de scramble en timer y cubo virtual, motor Liquid Glass completado (scrollbars, navbar, opacity slider, blur personalizado), tab General con toggles de paneles, perfeccionamiento de dock, widgets, profile, header, audio, scramble y theme-studio. El feature de bordes Hyprland (accent/gradient) se intentó y se reverteó al no funcionar correctamente con el motor Liquid Glass; los temas nuevos y el selector expandible se mantienen.

**Destacados:**
- 4 temas nuevos en "Explorar más temas": Tokyo Night (Neovim), Gruvbox Dark (retro UNIX), Dracula (gótico), Cyberpunk Neon (neón futurista).
- 3 modos de aplicación de fuente de dígitos: timer-only (solo timer), hybrid (numéricos mono, texto sans), composite (unicode-range dinámico universal).
- Timer y scramble como tarjetas contenedor (rounded-2xl border border-line bg-surface p-6 shadow-2xs) con paneles visibles en stage y preview.
- Selector de layout de scramble integrado en TimerContainer y cubo virtual (default/compact-right/compact-down).
- Liquid Glass completado: scrollbars glass con backdrop-filter, adopción en navbar, slider de opacidad 15-95%, blur personalizado 0-24px.
- Tab General en Theme Studio: toggles de scramble panel y timer panel, selector de layout de scramble, olas de UI polish en dock (random puzzle lever animation, context menu fixes), widgets (layout presets, metronome contrast), profile (glass chips en tabs, full-glass treatment activo), header (autohide lock fix), audio (cubeTurnSounds default false).
- Se reverteó el feature de bordes Hyprland (accent/gradient) por conflicto con el motor Liquid Glass; los temas nuevos y selector expandible se mantienen.

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-09-09 | [`d61fdb7`](https://github.com/Doritozz05/Cubeforge/commit/d61fdb7) | fix | Revert Hyprland border feature, keep new theme presets only | apps/web/src/components/Settings/theme-studio/ScaledTimerPreview.tsx · apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Settings/theme-studio/preview/PreviewTimer.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/index.css · packages/state/src/store.ts |
| 2026-09-08 | [`b9307a0`](https://github.com/Doritozz05/Cubeforge/commit/b9307a0) | feat | Add Hyprland active border style selector for timer panels | apps/web/src/components/Settings/theme-studio/ScaledTimerPreview.tsx · apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Settings/theme-studio/preview/PreviewTimer.tsx · apps/web/src/components/Stage/TimerStage.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/i18n/locales/en.json · apps/web/src/i18n/locales/es.json · apps/web/src/theme/themePresetIcons.ts · apps/web/src/theme/themePresets.ts · packages/state/src/store.ts |
| 2026-09-08 | [`22818ba`](https://github.com/Doritozz05/Cubeforge/commit/22818ba) | fix | Fix Hyprland border styles to work with Liquid Glass engine | apps/web/src/index.css |
| 2026-09-07 | [`17ca327`](https://github.com/Doritozz05/Cubeforge/commit/17ca327) | fix | fix(theme-studio): prevent individual color reset button from overflowing card text | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx |
| 2026-09-07 | [`402b300`](https://github.com/Doritozz05/Cubeforge/commit/402b300) | fix | fix(audio): set default cubeTurnSoundsEnabled to false | packages/state/src/store.ts |
| 2026-09-07 | [`0fe4262`](https://github.com/Doritozz05/Cubeforge/commit/0fe4262) | fix | fix(scramble): place ready icon next to scramble with padding without displacing tokens in compact-down | apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Scramble/ScrambleToken.tsx |
| 2026-09-07 | [`193d42a`](https://github.com/Doritozz05/Cubeforge/commit/193d42a) | fix | fix(scramble): keep scramble centered without displacement in compact modes | apps/web/src/components/Scramble/ScrambleDisplay.tsx |
| 2026-09-07 | [`62a78ca`](https://github.com/Doritozz05/Cubeforge/commit/62a78ca) | refactor | refactor(theme-studio): separate panels card and scramble layout selector, update compact ready indicator | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx |
| 2026-09-07 | [`652c8fb`](https://github.com/Doritozz05/Cubeforge/commit/652c8fb) | feat | feat(scramble): add scramble layout mode selector and panel support to virtual cube | apps/web/src/components/Cube3D/Cube3DPanel.tsx · apps/web/src/components/Scramble/ScrambleDisplay.tsx · apps/web/src/components/Timer/TimerContainer.tsx · apps/web/src/components/Stage/TimerStage.tsx · packages/state/src/store.ts |
| 2026-09-06 | [`d588b0d`](https://github.com/Doritozz05/Cubeforge/commit/d588b0d) | chore | Update ThemeStudioModal.tsx | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx |
| 2026-09-06 | [`a80e976`](https://github.com/Doritozz05/Cubeforge/commit/a80e976) | fix | fix(dock): handle top window exit and tooltip dismiss; feat(theme): individual color reset | apps/web/src/components/Dock/Dock.tsx · apps/web/src/components/Dock/DockPiece.tsx · apps/web/src/components/Settings/theme-studio/ThemeColorSection.tsx · apps/web/src/theme/themePresets.ts |
| 2026-09-06 | [`a924a1d`](https://github.com/Doritozz05/Cubeforge/commit/a924a1d) | style | style(profile): glass chip on all content tabs and stronger full-glass treatment on the active one | apps/web/src/components/Profile/ProfileView.tsx · apps/web/src/index.css |
| 2026-09-06 | [`86e5cf6`](https://github.com/Doritozz05/Cubeforge/commit/86e5cf6) | fix | fix(profile): active content tab reads as solid surface without liquid glass and as full frosted glass with it | apps/web/src/components/Profile/ProfileView.tsx · apps/web/src/index.css |
| 2026-09-06 | [`2176e6d`](https://github.com/Doritozz05/Cubeforge/commit/2176e6d) | fix | fix(header): restrict anyPopoverOpen to header poppers to fix autohide lock | apps/web/src/components/Layout/Header.tsx |
| 2026-09-06 | [`06bd43c`](https://github.com/Doritozz05/Cubeforge/commit/06bd43c) | fix | fix(theme-studio): fix wheel scroll on tabs strip inside Radix Dialog Portal | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx |
| 2026-09-06 | [`0a6eea1`](https://github.com/Doritozz05/Cubeforge/commit/0a6eea1) | feat | feat: fix notifications toast suppression, default fontDigitMode to timer-only, restyle digit mode as switch rows in typography tab | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Settings/theme-studio/TypographySection.tsx · packages/state/src/store.ts |
| 2026-09-06 | [`5bceaa6`](https://github.com/Doritozz05/Cubeforge/commit/5bceaa6) | feat | feat(appearance): add General tab with scramble and timer panel toggles and fix tab scroll | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Settings/theme-studio/PanelsSection.tsx · apps/web/src/index.css |
| 2026-09-06 | [`204b656`](https://github.com/Doritozz05/Cubeforge/commit/204b656) | feat | feat(typography): add 3 font application modes and tab scroll controls | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Settings/theme-studio/TypographySection.tsx · apps/web/src/theme/fonts.ts · packages/state/src/store.ts |
| 2026-09-06 | [`1fcfa57`](https://github.com/Doritozz05/Cubeforge/commit/1fcfa57) | fix | fix(theme-studio): horizontal wheel scroll for tabs, ColorPicker Done button style, and unified font catalog | apps/web/src/components/Settings/theme-studio/ThemeStudioModal.tsx · apps/web/src/components/Settings/theme-studio/ColorPicker.tsx · apps/web/src/theme/fonts.ts |
| 2026-09-05 | [`a214f77`](https://github.com/Doritozz05/Cubeforge/commit/a214f77) | feat | Add randomized move-order to 2×2 IDA* search to remove deterministic scramble bias | packages/solver-engine/src/idaStar.ts · packages/solver-engine/src/moveGen.rs |
| 2026-09-05 | [`85b2ffd`](https://github.com/Doritozz05/Cubeforge/commit/85b2ffd) | feat | Feature/theme studio (#32) | apps/web/src/components/Settings/theme-studio/ · apps/web/src/theme/ · packages/state/src/store.ts · apps/web/src/i18n/locales/ · apps/web/src/index.css |
| 2026-09-05 | [`fbc2711`](https://github.com/Doritozz05/Cubeforge/commit/fbc2711) | fix | fix(layout): center sidebar nav icons horizontally within selector pill | apps/web/src/components/Layout/SidebarNav.tsx · apps/web/src/index.css |
| 2026-09-05 | [`fa2f6c2`](https://github.com/Doritozz05/Cubeforge/commit/fa2f6c2) | fix | fix(widgets): simplify layout presets, remove cascade, and ensure scramble text clearance | apps/web/src/components/Widgets/WidgetDock.tsx · apps/web/src/components/Widgets/WidgetLayoutPresets.tsx |
| 2026-09-05 | [`a7e5156`](https://github.com/Doritozz05/Cubeforge/commit/a7e5156) | fix | fix(widgets): optimize layout presets, smooth velocity-gated drag, and metronome contrast | apps/web/src/components/Widgets/WidgetDock.tsx · apps/web/src/components/Widgets/WidgetMetronome.tsx · apps/web/src/index.css |
| 2026-09-05 | [`6bacd3b`](https://github.com/Doritozz05/Cubeforge/commit/6bacd3b) | fix | fix(ui): use standard ui Toaster to sync notifications with dark mode | apps/web/src/components/ui/Toaster.tsx · apps/web/src/components/Notifications/NotificationToast.tsx |
| 2026-09-05 | [`d418c1b`](https://github.com/Doritozz05/Cubeforge/commit/d418c1b) | fix | fix(web): restore default liquid glass opacity to 65% | apps/web/src/index.css |
| 2026-09-05 | [`7347282`](https://github.com/Doritozz05/Cubeforge/commit/7347282) | fix | fix(ui): order -webkit-backdrop-filter before standard backdrop-filter | apps/web/src/index.css |
| 2026-09-05 | [`8a30b0b`](https://github.com/Doritozz05/Cubeforge/commit/8a30b0b) | fix | fix(web): default liquid glass opacity to 90% | apps/web/src/index.css |
| 2026-09-05 | [`7264b78`](https://github.com/Doritozz05/Cubeforge/commit/7264b78) | fix | fix(csp): allow blob and data media for custom background uploads | apps/web/src/components/Settings/components/CustomBackgroundSetting.tsx · apps/web/index.html |
| 2026-09-02 | [`2b288d4`](https://github.com/Doritozz05/Cubeforge/commit/2b288d4) | feat | Feat/UI standardization (#31) | apps/web/src/ · apps/web/package.json |

---

> Regenerar con `node scripts/generate-changelog.cjs` (edita `scripts/changelog.config.json` para ajustar bandas, resúmenes o moralejas).
