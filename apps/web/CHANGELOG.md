# web

## 0.9.1

### Minor Changes

- **Infinite F2L** — Modo de entrenamiento continuo Infinite F2L con historial de pares y reconocimiento avanzado (PR #29).
- **Skill Radar** — Radar universal de habilidades en 6 ejes (tps, lookahead, economy, ergonomics, recognition, consistency) con benchmarks profesionales.
- **Mobile Method Navigator** — Navegador móvil de métodos con drawer flotante, auto-prompt de sugerencias y placeholders esqueleto.
- **Changelog** — Acordeón de changelog interactivo con fechas exactas y links a commits.
- **Backgrounds** — Video y GIF animados en loop (<10s) con persistencia IndexedDB, sincronizados con inspection y solve.
- **Background settings** — Setting experimental "fondo en todas las vistas" y toggle "always animate" para video/GIF.

### Patch Changes

- **Build** — pnpm@10.5.2 fijado como packageManager estable para resolver deploy error.
- **Statistics** — Calibración de ergonomía smart-cube y reward progression en session consistency.
- **Statistics** — Sorteo cronológico de solves para trendline y curvas de consistencia.
- **Insights** — Orden cronológico estricto por timestamp independiente del filtro UI.
- **Algorithms** — CLL single-subset method aplanado, EG nesting redundante eliminado.
- **Algorithms** — Vista móvil por defecto sin preselección y auto-prompt navigator.
- **Algorithms** — Placeholders esqueleto del tamaño del caso en estado vacío móvil.
- **DB** — sessions.puzzle_type legacy column eliminada (end-to-end).

---

## 0.8.5

### Patch Changes

- **Reconstructions** — Rediseño de detalle de reconstrucción y layout vertical.

---

## 0.8.4

### Minor Changes

- **Floating Stickers** — Stickers flotantes en replay 3D para ver todas las capas simultáneamente.
- **Replay Seek** — Salto directo en replay (direct replay seek).

---

## 0.8.3

### Minor Changes

- **Recognition Engine** — Motor de reconocimiento 100% color-neutral.

---

## 0.8.2

### Minor Changes

- **Case Analysis** — Arquitectura unificada de análisis CFOP (unified CFOP case analysis architecture).

---

## 0.8.1

### Minor Changes

- **Mini 3D Case Cubes** — Mini-cubos 3D con colores reales de sticker para cases.

---

## 0.8.0

### Major Changes

- **Relational Signatures** — Slot-agnostic relational signatures para análisis de casos independiente del slot.

---

## 0.7.9

### Patch Changes

- **BirdF2L** — Insignias de notación BirdF2L.
- **Profile** — Orden de países en perfil.

---

## 0.7.8

### Patch Changes

- **F2L** — Vistas de slot F2L avanzado y geometría de par fija.

---

## 0.7.7

### Patch Changes

- **SoundManager** — SoundManager de latencia cero.

---

## 0.7.6

### Patch Changes

- **Profile** — Sub-X milestone badges y 5 pestañas de rendimiento (5 performance tabs).

---

## 0.7.5

### Minor Changes

- **Profile View** — Vista de perfil y heatmap de actividad de 52 semanas.

---

## 0.7.4

### Patch Changes

- **Solves** — Selección múltiple de solves y acciones en bloque (bulk operations).

---

## 0.7.3

### Minor Changes

- **Crash Diagnostics** — Diagnósticos de caídas y pie SHA en ajustes.
- **OPFS** — Worker de almacenamiento OPFS y fallbacks.

---

## 0.7.2

### Minor Changes

- **Cloud Sync** — Servicio de sync offline-first con OPFS.

---

## 0.7.1

### Minor Changes

- **User Accounts** — Cuentas de usuario y autenticación Supabase.

---

## 0.7.0

### Minor Changes

- **Authentication** — Supabase user accounts & authentication.

---

## 0.6.9

### Patch Changes

- **2x2 Virtual** — Cubo virtual 2x2 y filtro anticlic iOS.

---

## 0.6.8

### Patch Changes

- **WCA Events** — Registro de eventos WCA y superficies sólidas UI.

---

## 0.6.7

### Patch Changes

- **Camera** — Cámara trackball y layout para tablet.

---

## 0.6.6

### Minor Changes

- **Top Bar** — Dock auto-hide y barra tri-estado (always/hidden/autohide).

---

## 0.6.5

### Patch Changes

- **Bottom Layout** — Plantillas modulares de layout inferior.

---

## 0.6.4

### Minor Changes

- **Dock Edit** — Modo edición del dock e insignias de borrado.

---

## 0.6.3

### Patch Changes

- **Dock Explorer** — Catálogo DockExplorer y tag de solve virtual.

---

## 0.6.2

### Minor Changes

- **Dock Architecture** — Arquitectura de piezas modulares del dock.

---

## 0.6.1

### Patch Changes

- **Turn Sounds** — Sonidos mecánicos Web Audio para giro de capas.

---

## 0.6.0

### Minor Changes

- **Virtual Cube** — Simulador de cubo virtual estilo csTimer.

---

## 0.5.9

### Patch Changes

- **i18n** — Barrido completo de traducción tipada (complete typed translation sweep).

---

## 0.5.8

### Minor Changes

- **Credits** — Atribución de créditos a creadores de algoritmos.

---

## 0.5.7

### Minor Changes

- **Scrambler** — Mezclador color-neutral y desviación estándar.

---

## 0.5.6

### Patch Changes

- **Replay** — Cronología de replay y transiciones de agarre (move grip smooth timeline).

---

## 0.5.5

### Minor Changes

- **Re-analysis** — Pipeline de reanálisis de solves.

---

## 0.5.4

### Minor Changes

- **Verification** — Pipeline automatizado de verificación de casos.

---

## 0.5.3

### Patch Changes

- **BirdF2L** — Códigos de notación avanzada BirdF2L.

---

## 0.5.2

### Minor Changes

- **SCDB** — Integración SCDB y algoritmos COLL/WV.

---

## 0.5.1

### Patch Changes

- **Preferences** — Precisión configurable y preferencias de timer.

---

## 0.5.0

### Minor Changes

- **i18n** — Infraestructura i18n tipada y soporte bilingüe (typed i18n foundation & bilingual support).

---

## 0.4.9

### Patch Changes

- **Focus Mode** — Modo foco manual y diálogos de confirmación de borrado.

---

## 0.4.8

### Minor Changes

- **PWA** — Despliegue PWA y cabeceras COOP/COEP.

---

## 0.4.7

### Minor Changes

- **Skill Tree** — Detalle de skill node y editor de algoritmos personalizados.

---

## 0.4.6

### Minor Changes

- **PB Progression** — Evolución de PB y proyecciones BPA/WPA.

---

## 0.4.5

### Patch Changes

- **2x2** — Base de algoritmos 2x2 e histograma de tiempos.

---

## 0.4.4

### Minor Changes

- **Layout Organizer** — Organizador de layouts y snap-to-grid.

---

## 0.4.3

### Patch Changes

- **2x2 Engine** — Motor matemático de cubo 2x2.

---

## 0.4.2

### Patch Changes

- **Manual Entry** — Parser de entrada manual estilo csTimer.

---

## 0.4.1

### Patch Changes

- **Metronome** — Metrónomo y bloc de notas (scratchpad notes).

---

## 0.4.0

### Minor Changes

- **Dock** — Dock arrastrable y arquitectura flotante.

---

## 0.3.9

### Patch Changes

- **F2L** — Modelado de los 41 casos F2L y full solve.

---

## 0.3.8

### Minor Changes

- **SRS** — Motor de repetición espaciada (spaced repetition engine).

---

## 0.3.7

### Patch Changes

- **Skill Tree** — Lienzo del árbol de habilidades (skill tree graph canvas).

---

## 0.3.6

### Patch Changes

- **Practice** — Calendario de práctica y tracker de hábitos.

---

## 0.3.5

### Minor Changes

- **Drills** — Drills de algoritmos y flash recall.

---

## 0.3.4

### Patch Changes

- **Training** — Arquitectura del motor de entrenamiento.

---

## 0.3.3

### Minor Changes

- **Cross Trainer** — Entrenador de cruz y solver óptimo.

---

## 0.3.2

### Minor Changes

- **Algorithm DB** — Modelado de base de datos de algoritmos.

---

## 0.3.1

### Patch Changes

- **3D Diagrams** — Generador de diagramas 3D.

---

## 0.3.0

### Major Changes

- **Cube Skins** — Skins de cubo y estudio de texturas (texture studio).

---

## 0.2.9

### Patch Changes

- **Stats** — Historial de solves y panel de stats rápidos.

---

## 0.2.8

### Minor Changes

- **Gyro Replay** — Replay giroscópico 3D.

---

## 0.2.7

### Minor Changes

- **2D Scramble** — Red 2D de mezcla y verificación.

---

## 0.2.6

### Patch Changes

- **PB Milestones** — Hitos de PB y session bests.

---

## 0.2.5

### Patch Changes

- **Color Neutrality** — Neutralidad de color y face mapping.

---

## 0.2.4

### Minor Changes

- **CFOP Solver** — Motor de resolución CFOP y phase split.

---

## 0.2.3

### Patch Changes

- **Calibration** — Auto-calibración de orientación.

---

## 0.2.2

### Minor Changes

- **Gyroscope** — Telemetría de giroscopio y quaternion tracking.

---

## 0.2.1

### Minor Changes

- **Smart Cube** — Smart Cube Web Bluetooth (GAN/GoCube).

---

## 0.2.0

### Minor Changes

- **Timer Stage** — Timer stage y pantalla adaptativa responsive.

---

## 0.1.3

### Patch Changes

- **Design Tokens** — Tokens de diseño y layout adaptativo.

---

## 0.1.2

### Minor Changes

- **WCA Timer** — Máquina de estados de timer WCA y penalizaciones.

---

## 0.1.1

### Patch Changes

- **Render Worker** — Offscreen Canvas y worker de render 3D.

---

## 0.1.0

### Major Changes

- **Monorepo** — Arquitectura del monorepo y motor central (core engine architecture).

| Fecha | Hash | Categoría | Mensaje original | Archivos |
|---|---|---|---|---|
| 2026-07-12 | [`e4925de`](https://github.com/Doritozz05/Cubeforge/commit/e4925de) | other | Initial commit | .gitattributes · LICENSE · README.md |
| 2026-07-12 | [`cc153db`](https://github.com/Doritozz05/Cubeforge/commit/cc153db) | docs | Create PRD.md | PRD.md |
| 2026-07-12 | [`3d1dc7c`](https://github.com/Doritozz05/Cubeforge/commit/3d1dc7c) | docs | Update PRD.md | PRD.md |
| 2026-07-12 | [`2bd4aca`](https://github.com/Doritozz05/Cubeforge/commit/2bd4aca) | docs | roadmap | PRD.md · roadmap.md |
| 2026-07-12 | [`94b656b`](https://github.com/Doritozz05/Cubeforge/commit/94b656b) | other | Reorganize and standardize docs | .codegraph/.gitignore · PRD.md · docs/00-product/PRD.md · docs/01-roadmap/Master_Roadmap.md · … (10 en total) |
| 2026-07-12 | [`6bda61f`](https://github.com/Doritozz05/Cubeforge/commit/6bda61f) | docs | Add docs, issue/PR templates and governance | .github/ISSUE_TEMPLATE/bug_report.md · .github/ISSUE_TEMPLATE/feature_request.md · .github/pull_request_template.md · CODE_OF_CONDUCT.md · … (22 en total) |
| 2026-07-12 | [`9a25e80`](https://github.com/Doritozz05/Cubeforge/commit/9a25e80) | docs | Add initial architecture research report | docs/02-architecture/research/Intial_Architecture_Research_Report.md · docs/README.md |
| 2026-07-12 | [`16b15af`](https://github.com/Doritozz05/Cubeforge/commit/16b15af) | other | Organize architecture docs and indexes | docs/00-product/domain/README.md · docs/02-architecture/Architecture_Index.md · docs/02-architecture/Architecture_Lifecycle.md · docs/02-architecture/README.md · … (8 en total) |
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
| 2026-07-12 | [`74cdabb`](https://github.com/Doritozz05/Cubeforge/commit/74cdabb) | other | Add monorepo web scaffold and ADR updates | .gitignore · apps/web/.gitignore · apps/web/.oxlintrc.json · apps/web/README.md · … (43 en total) |
| 2026-07-12 | [`50d5ea9`](https://github.com/Doritozz05/Cubeforge/commit/50d5ea9) | chore | Add workspace package manifests | apps/api/package.json · packages/ai-core/package.json · packages/analysis-engine/package.json · packages/database/package.json · … (8 en total) |
| 2026-07-12 | [`bd6a8ae`](https://github.com/Doritozz05/Cubeforge/commit/bd6a8ae) | other | Set up UI package with shadcn and Tailwind | packages/ui/components.json · packages/ui/package.json · packages/ui/src/components/ui/button.tsx · packages/ui/src/lib/utils.ts · … (8 en total) |
| 2026-07-12 | [`58874f0`](https://github.com/Doritozz05/Cubeforge/commit/58874f0) | chore | Add three new monorepo packages | packages/3d-engine/package.json · packages/statistics/package.json · packages/timer-engine/package.json · pnpm-lock.yaml |
| 2026-07-12 | [`4b34b98`](https://github.com/Doritozz05/Cubeforge/commit/4b34b98) | other | Add CI, release, formatter, ESLint & TS configs | .github/workflows/ci.yml · .github/workflows/release.yml · .prettierrc · apps/web/eslint.config.js · … (14 en total) |
| 2026-07-12 | [`5b7ff75`](https://github.com/Doritozz05/Cubeforge/commit/5b7ff75) | other | Add database and state management packages | packages/database/eslint.config.js · packages/database/package.json · packages/database/src/__tests__/db.test.ts · packages/database/src/client.ts · … (15 en total) |
| 2026-07-12 | [`6314422`](https://github.com/Doritozz05/Cubeforge/commit/6314422) | other | Add @cubeforge/models package with Zod schemas | .changeset/README.md · .changeset/config.json · packages/models/eslint.config.js · packages/models/package.json · … (10 en total) |
| 2026-07-12 | [`165914d`](https://github.com/Doritozz05/Cubeforge/commit/165914d) | chore | Update package.json | package.json |
| 2026-07-12 | [`28202d8`](https://github.com/Doritozz05/Cubeforge/commit/28202d8) | other | Add timer engine package | packages/timer-engine/package.json · packages/timer-engine/src/TimerEngine.ts · packages/timer-engine/src/TimerState.ts · packages/timer-engine/src/WcaRules.ts · … (10 en total) |
| 2026-07-12 | [`8c47a63`](https://github.com/Doritozz05/Cubeforge/commit/8c47a63) | other | Add core TDD docs and models unit test | docs/05-tdd/core/0001-monorepo-cicd.md · docs/05-tdd/core/0002-global-state-architecture.md · docs/05-tdd/core/0003-data-models.md · docs/05-tdd/core/0004-timer-engine.md · … (5 en total) |
| 2026-07-12 | [`fa2bc23`](https://github.com/Doritozz05/Cubeforge/commit/fa2bc23) | other | Add advanced WCA timer states | docs/05-tdd/core/0004-timer-engine.md · packages/timer-engine/src/TimerEngine.ts · packages/timer-engine/src/TimerState.ts · packages/timer-engine/src/events.ts · … (5 en total) |
| 2026-07-12 | [`a493062`](https://github.com/Doritozz05/Cubeforge/commit/a493062) | docs | Expand HAL roadmap for timers and cubes | docs/01-roadmap/Master_Roadmap.md · docs/05-tdd/core/0005-hardware-hal.md |
| 2026-07-12 | [`47c62ac`](https://github.com/Doritozz05/Cubeforge/commit/47c62ac) | docs | Update 0005-hardware-hal.md | docs/05-tdd/core/0005-hardware-hal.md |
| 2026-07-12 | [`fa06eb5`](https://github.com/Doritozz05/Cubeforge/commit/fa06eb5) | other | Add gan-protocol and hardware-hal packages | packages/gan-protocol/package.json · packages/gan-protocol/src/gan-cube-definitions.ts · packages/gan-protocol/src/gan-cube-encrypter.ts · packages/gan-protocol/src/gan-cube-protocol.ts · … (23 en total) |
| 2026-07-12 | [`cb03f0a`](https://github.com/Doritozz05/Cubeforge/commit/cb03f0a) | other | fixes | .github/workflows/ci.yml · .github/workflows/release.yml |
| 2026-07-12 | [`db6a454`](https://github.com/Doritozz05/Cubeforge/commit/db6a454) | other | fixes | packages/hardware-hal/package.json · packages/hardware-hal/tsconfig.json · pnpm-lock.yaml |
| 2026-07-12 | [`2130639`](https://github.com/Doritozz05/Cubeforge/commit/2130639) | other | Implement Stackmat processor and improve adapter error handling | packages/hardware-hal/src/audio/StackmatProcessor.ts · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts · packages/hardware-hal/src/bluetooth/GanTimerAdapter.ts · packages/hardware-hal/tests/stackmat-test.ts |
| 2026-07-12 | [`f88c3f7`](https://github.com/Doritozz05/Cubeforge/commit/f88c3f7) | other | Improve GAN cube connection fallback | packages/gan-protocol/src/gan-smart-cube.ts · packages/hardware-hal/demo.ts · packages/hardware-hal/index.html · packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-12 | [`bcf3c07`](https://github.com/Doritozz05/Cubeforge/commit/bcf3c07) | other | Update GanCubeAdapter.ts | packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts |
| 2026-07-12 | [`cef956a`](https://github.com/Doritozz05/Cubeforge/commit/cef956a) | other | Create LICENSE | packages/gan-protocol/LICENSE |
| 2026-07-12 | [`48ea895`](https://github.com/Doritozz05/Cubeforge/commit/48ea895) | docs | Create TDD-0006-3D-Engine.md | docs/05-tdd/TDD-0006-3D-Engine.md |
| 2026-07-12 | [`b61d673`](https://github.com/Doritozz05/Cubeforge/commit/b61d673) | other | Integrate 3D cube engine with Web Workers and improve Bluetooth UX | apps/web/package.json · apps/web/src/App.tsx · packages/cube-3d-engine/package.json · packages/cube-3d-engine/src/animation/RotationEngine.ts · … (15 en total) |
