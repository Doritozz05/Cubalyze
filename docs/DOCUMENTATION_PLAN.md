# Plan de Documentación Completa — CubeForge

> Documento de trabajo que guía la documentación integral del proyecto.
> Se ejecuta por fases; cada fase termina con un resumen y un checkpoint con el usuario.
> **Regla de oro: si algo no está claro, se pregunta al usuario. Nunca se inventa.**

---

## 1. Objetivo

Dejar el sistema `docs/` completo, verificado contra el código real y sin archivos
desactualizados. Cubrir:

- Cada **vista/tab** de la web (funcionalidad real, flujos, componentes implicados).
- Cada **paquete** del monorepo (qué hace, cómo se usa, dependencias).
- Cada **parte de la web**: widgets, componentes, servicios, stores, hooks, i18n, boot.
- Los **ADRs**: verificar que los 23 existentes reflejan el código real y crear los
  que falten (decisiones tomadas después de ADR-023).
- Las **secciones vacías** del índice (06 → 17) que solo tienen README placeholder.
- La **API reference** generada desde el JSDoc existente (TypeDoc).
- El **changelog/releases** (changesets).

## 2. Estado actual (auditoría de partida — 2026-08-12)

### Lo que ya está hecho (no tocar sin necesidad)
- `docs/00-product/`: PRD, Auditoria de producto (4 md).
- `docs/02-architecture/`: 13 md — incluye `System_Architecture_Overview.md`,
  `Architecture_Decision_Register.md`, investigación (Bluetooth, PWA storage, legal).
- `docs/03-adr/`: **24 archivos** — ADR-001 → ADR-023 + README. Con frontmatter,
  estado y relación RFC. (Posibles ADRs incompletos o desactualizados: revisar.)
- `docs/04-rfc/`: 24 archivos — RFC-001 → RFC-023 + README.
- `docs/05-tdd/`: 9 md. `docs/08-standards/`: 12 md.

### Lo que falta o está vacío
- READMEs placeholder en `docs/02-architecture/diagrams/`, `overview/`, `validation/`.
- Secciones con solo README: `06-api`, `07-database`, `09-testing`, `10-security`,
  `11-devops`, `12-sdk`, `13-plugins`, `14-ai`, `16-user`, `17-releases`, `18-archive`.
- No hay API reference (TypeDoc no instalado). No hay CHANGELOG.md (changesets
  configurado pero sin uso). No hay tags git → nunca ha habido release.

### Posibles desactualizados (candidatos a archivar, confirmar con usuario)
- `docs/plan_*` (8 carpetas): analysis_unification, cube_simulator, i18n, mobile,
  onboarding, profile, reconstruction, training + `REFACTOR_PLAN.md`,
  `TRAINING_SYSTEM_v2.md`. Son planes pre-ejecución; los features ya están
  implementados (el código tiene las vistas Training, Cube, i18n, etc.).
  **Decisión propuesta: mover a `docs/18-archive/` (nunca borrar).**
- `docs/wca.md`, `docs/00-product/Auditoria_Producto_2026-08.md` (fechado — revisar).

### Mapa del código (lo que hay que documentar)
- **apps/web** (PWA, ~707 archivos TS/TSX):
  - Vistas (tabs): `Training` (25), `Algorithms` (11), `SkillTree` (5),
    `Reconstructions` (4), `Cube` (1), `Profile` (1).
  - Widgets: `dock`, `explorer`, 10 implementaciones (algorithm-db, cube-button,
    layout-organizer, metronome, notes, pb-progression, phase-balance, scramble-2d,
    solve-timeline, time-distribution).
  - Componentes: Layout, Timer, Stats, Settings, Scramble, Stage, Insights,
    Hardware, Identity, Onboarding, Cube3D, ContextMenu.
  - Más: services, stores, hooks, i18n (varios locales), boot, lib/keybinds.
- **apps/desktop** (Tauri): adapters GanCube/GanTimer, database-override,
  hardware-hal-override.
- **apps/api**: vacío (placeholder — documentar la decisión de no tener API aún).
- **19 paquetes**:
  - Core: `math-core` (64), `solver-engine` (21), `algorithm-db` (32), `models` (6), `types` (4).
  - 3D: `cube-3d-engine` (39).
  - Datos/estado: `database` (27), `state` (8), `sync-engine` (0 — placeholder).
  - Hardware: `hardware-hal` (13), `gan-protocol` (9), `timer-engine` (9).
  - IA/análisis: `analysis-engine` (63), `statistics` (3), `training` (27),
    `ai-core` (0 — placeholder).
  - UI/utilidades: `ui` (4), `identicon` (8), `config-eslint`, `config-typescript`.
- **Plombería**: turbo.json, vercel.json, .github/workflows (ci.yml,
  quality-gates.yml), commitlint, husky, changesets.

## 3. Principios de trabajo

1. **La documentación se deriva del código real, no de la memoria ni de los commits.**
   El historial antiguo tiene muchos commits "fix" sin valor; el código es la verdad.
2. **Los ADRs se congelan.** Solo se actualizan cuando una decisión cambia
   (`superseded_by`). No se escriben ADRs por commit.
3. **Archivar, nunca borrar.** Todo lo desactualizado va a `docs/18-archive/`
   con una nota de por qué se archivó y cuándo.
4. **Preguntar ante la duda.** Decisiones de negocio, "por qué" no deducible del
   código, features planeados vs. reales → pregunta al usuario. Nunca inventar.
5. **El JSDoc que ya existe es la materia prima** para la API reference (TypeDoc),
   no para reescribir docs a mano.
6. **Cada fase produce docs verificables**, no páginas bonitas: lo escrito debe
   poder comprobarse contra el código (nombres de archivos, flujos, stores reales).

## 4. Metodología por unidad de trabajo (vista / paquete / parte)

Para cada unidad:

1. **Leer** el código de la zona (archivos, stores, servicios, tipos) y su
   `git log` reciente para entender qué se ha construido (el historial reciente sí
   tiene conventional commits útiles, p.ej. `feat(i18n)`, `Feat/cube simulator`).
2. **Comparar** con los docs existentes: ¿qué ADR/RFC/README ya lo cubre? ¿está al día?
3. **Escribir/actualizar** los docs de destino (ver tabla por fase).
4. **Dudas** → lista de preguntas para el usuario al cierre de la fase
   (nunca en medio: se acumulan y se resuelven juntas).
5. **Cerrar** la unidad marcándola en este plan con fecha.

## 5. Fases

### Fase 0 — Cimientos y limpieza
**Objetivo:** dejar el terreno listo antes de documentar nada.

- [x] Auditar los 23 ADRs contra el código real → informe
      `docs/02-architecture/validation/ADR_Drift_Audit_2026-08-12.md`; ADRs
      012/015/017/018 actualizados a la implementación real; notas de estado en
      004/005/006/007/011/019/022/023; registro actualizado (2026-08-12).
- [x] Archivar los 8 `plan_*` + `REFACTOR_PLAN.md` + `TRAINING_SYSTEM_v2.md` en
      `docs/18-archive/` con inventario (2026-08-12).
- [x] Rellenar los 3 READMEs placeholder de `docs/02-architecture/`
      (diagrams, overview, validation) con su propósito real.
- [ ] Revisar `docs/06-api`, `docs/07-database`, `docs/16-user`…: decidir qué se
      documenta ahí y qué se deja para más adelante (no todo tiene que quedar lleno
      si el contenido aún no existe, p.ej. `12-sdk`, `13-plugins`).
- [ ] Reconstruir la línea de tiempo de features desde git log (reciente) y
      `docs/01-roadmap/Master_Roadmap.md`: qué está hecho, qué está planeado.

**Criterio de cierre:** ADRs auditados, archivos a archivar aprobados por el usuario,
placeholders resueltos.

### Fase 1 — apps/web: vistas (las "tabs")
**Objetivo:** documentar cada tab de la app como la ve el usuario, verificando
contra el código real.

Para cada vista: **Training (25) → Algorithms (11) → SkillTree (5) →
Reconstructions (4) → Cube (1) → Profile (1)**:

- [x] **Training** (2026-08-12) → `docs/16-user/Training_View.md` (con inventario
      archivo por archivo de las 25 archivos + sub-vistas y componentes) +
      **ADR-024** (sistema Training/SRS FSRS) + **TDD-0001**
      (`docs/05-tdd/training/0001-srs-training-system.md`) + DEC-25 en el registro.
- [x] **Algorithms** (2026-08-12) → `docs/16-user/Algorithms_View.md` (inventario
      por archivo; sin ADR/TDD nuevos: el catálogo está cubierto por ADR-003/017).
- [x] **SkillTree** (2026-08-12) → `docs/16-user/SkillTree_View.md` (dataset +
      layout determinista + persistencia skill_progress).
- [x] **Reconstructions** (2026-08-12) → `docs/16-user/Reconstructions_View.md`
      (análisis headless diferido a Fase 4 del paquete analysis-engine).
- [x] **Cube** (2026-08-12) → `docs/16-user/Cube_View.md` (simulador 3×3; motor ya
      tiene TDD-0006).
- [x] **Profile** (2026-08-12) → `docs/16-user/Profile_View.md` (identidad + datos
      reales de Stats/Training/Algorithms/Skills).
- [x] **ADR-025** (i18n, 2026-08-12): estrategia de internacionalización registrada
      retroactivamente (transversal a todas las vistas); DEC-26 en el registro.

- [ ] Leer la vista completa (componentes, stores, servicios que usa).
- [ ] Documentar en `docs/16-user/` (o sección correspondiente): qué hace la tab,
      flujo principal, ajustes/estado que guarda, atajos de teclado si tiene.
- [ ] Verificar ADR relacionados (p.ej. Training → ADR-015 solver, ADR-020 accesibilidad).
- [ ] Anotar en `docs/02-architecture/overview/` las dependencias con packages.

**Criterio de cierre:** 6 docs de vistas (una por tab), verificables contra el código. ✅ Completado 2026-08-12.

### Fase 2 — Widgets
**Objetivo:** documentar el sistema de widgets (dock + explorer) y las 10
implementaciones.

- [x] Documentar la **arquitectura del sistema** (2026-08-12) →
      `docs/02-architecture/Widgets_System.md`: SDK (WidgetPlugin/HostAPI),
      ciclo de vida, registry lazy, store (persist v8, banda z-25..49, layouts),
      dock (áreas + pieces + running indicators), explorer/host.
      **ADR-026** (Widget SDK & Host Architecture, 2026-08-12): SDK host-aislado,
      estado único, banda z, política built-in-only — registrado retroactivamente.
      **TDD-0002** (`docs/05-tdd/frontend/0001-widget-sdk-dock-system.md`): diseño
      concreto (contrato, lifecycle, registry lazy, store v8, dock, explorer).
      DEC-27 en el registro.
- [x] Fichas de las **11 implementaciones** (2026-08-12, incluye `times-log` que
      faltaba en el plan) → `docs/02-architecture/widgets/*.md` (README índice
      + 11 fichas con props/estado y dónde se usa).

**Criterio de cierre:** doc de arquitectura de widgets + 11 fichas de implementación. ✅ Completado 2026-08-12.

### Fase 3 — Componentes, hooks, servicios y stores (web)
**Objetivo:** cubrir el resto de la app web.

- [ ] Componentes: Layout, Timer, Stats, Settings, Scramble, Stage, Insights,
      Hardware, Identity, Onboarding, Cube3D, ContextMenu → ficha por componente
      en `docs/02-architecture/` o `docs/16-user/` según corresponda.
- [ ] Services (p.ej. persistencia, sincronización) y stores (estado global):
      qué guardan, cómo fluye el estado → actualizar/crear doc en `docs/02-architecture/`.
- [ ] Hooks y utils (incl. keybinds).
- [ ] i18n: estructura de locales, sistema de "tandas" (ya documentado en parte por
      los commits — formalizar en `docs/16-user/` o `docs/08-standards/`).

**Criterio de cierre:** fichas de componentes/servicios/stores y doc de i18n.

### Fase 4 — Paquetes (en 6 sub-fases)
**Objetivo:** documentar cada paquete: propósito, API pública, dependencias,
cómo se consume desde la web/desktop. Destino: `docs/06-api/` + notas de arquitectura.

- [ ] **4.1 Core**: math-core, solver-engine, algorithm-db, models, types.
- [ ] **4.2 3D**: cube-3d-engine.
- [ ] **4.3 Datos/estado**: database, state, sync-engine (placeholder → documentar
      como planeado).
- [ ] **4.4 Hardware**: hardware-hal, gan-protocol, timer-engine (+ adapters desktop).
- [ ] **4.5 IA/análisis**: analysis-engine, statistics, training, ai-core (placeholder).
- [ ] **4.6 UI/utilidades**: ui, identicon, config-eslint, config-typescript.

**Criterio de cierre:** una página por paquete con API y dependencias reales;
placeholders marcados como "planeado".

### Fase 5 — apps/desktop y apps/api
- [ ] apps/desktop (Tauri): adapters GanCube/GanTimer, database-override,
      hardware-hal-override → doc en `docs/02-architecture/` (diferencia desktop vs web).
- [ ] apps/api: vacío → documentar la decisión (¿por qué no hay API aún? preguntar
      al usuario / reflejar en ADR si existe la decisión).

### Fase 6 — Integración y plombería
- [ ] turbo.json (monorepo), vercel.json (deploy), CI (`ci.yml`, `quality-gates.yml`),
      commitlint/husky/changesets → doc en `docs/11-devops/`.
- [ ] PWA/boot, build, scripts de raíz.
- [ ] Actualizar `docs/02-architecture/overview/System_Architecture_Overview.md`
      con todo lo aprendido (diagrama de dependencias real).

### Fase 7 — API reference (TypeDoc)
- [ ] Instalar/Configurar TypeDoc + script `docs:api`.
- [ ] Generar la API reference desde el JSDoc existente (~2.600 bloques en 454
      archivos) → `docs/api/` (ignorada en git, se regenera).
- [ ] Auditar calidad del JSDoc (genéricos, sin `@param`/`@returns`) y proponer
      mejoras puntuales donde valga la pena.

### Fase 8 — Changelog y releases (changesets)
- [ ] Configurar changesets para generar `CHANGELOG.md`.
- [ ] Crear `docs/17-releases/` con el proceso de release.
- [ ] Decidir con el usuario el primer release (versionado 0.0.0 hoy, sin tags).

### Fase 9 — Cierre y validación
- [ ] Revisión cruzada: cada sección del índice `docs/` con contenido verificado.
- [ ] Diagrama de arquitectura actualizado (`docs/02-architecture/diagrams/`).
- [ ] Actualizar el `Architecture_Decision_Register.md` (ADR-023+ si se crearon).
- [ ] Lista final de preguntas pendientes al usuario + resumen de lo documentado.
- [ ] Marcar fases completadas en este plan con fecha.

## 6. Orden de ejecución y checkpoints

1. **Fase 0 primero** (cimientos) → checkpoint con usuario (archivar/auditar ADRs).
2. Fases 1–3 (web) → una sesión por vista/widget/grupo de componentes,
   checkpoint al final de cada fase.
3. Fase 4 (paquetes) → 6 sub-fases, cada una con su propio cierre.
4. Fases 5–6 (desktop/api/plombería).
5. Fases 7–8 (TypeDoc, changelog) — se pueden adelantar si el usuario lo pide.
6. Fase 9 (cierre).

**Durante toda la ejecución:** las dudas se acumulan y se resuelven con el usuario
al cierre de cada fase. Nunca se asume una decisión de negocio ni un "por qué"
que no sea deducible del código.
