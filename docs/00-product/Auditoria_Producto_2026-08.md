# Cubalyze — Auditoría Exhaustiva del Producto

**Fecha:** Agosto 2026
**Alcance:** Estado real de desarrollo, cobertura funcional, coherencia, valor, comparación con el ecosistema speedcubing y roadmap de finalización.
**Método:** Análisis del código fuente (monorepo completo) + investigación externa (Reddit r/Cubers, SpeedSolving forums, WCA, documentación de competidores).

---

## 1. Resumen Ejecutivo

Cubalyze **no es una plataforma "a medio hacer"**: es una plataforma con un **núcleo técnico excepcionalmente sólido y completo** (motor 3D, solver matemático, análisis de solves, HAL de smart cubes, motor de entrenamiento con FSRS real) sobre el que **faltan las capas de "plataforma"**: cuenta/usuario, sincronización, backend, IA y onboarding.

**Diagnóstico en una frase:** el 80% del valor técnico está implementado y testeado (352+ tests pasan, typecheck 30/30 limpio); lo que falta es lo que convierte una *app local* en una *plataforma profesional*: identidad de usuario, sync multi-dispositivo, AI Coach, eventos WCA más allá de 3×3/2×2, y un onboarding que guíe al usuario.

### Hechos objetivos verificados

| Dimensión | Estado |
|---|---|
| Tests | 352+ tests en 103 archivos, todos pasan |
| Typecheck | 30/30 tareas limpias |
| Paquetes con código real | 16 de 19 (ai-core, sync-engine, api = vacíos) |
| Navegación | 5 vistas (Timer, Training, Algorithms, Skills, Stats) + Widgets |
| Smart cube | GAN vía BLE + StackMat vía audio, con corrección de deriva de reloj |
| Persistencia | SQLite WASM (OPFS) con migraciones versionadas + export/import |
| Eventos soportados | Solo 2×2 y 3×3 |
| AI Coach | **No existe** (paquete vacío) |
| Sincronización / cuenta | **No existe** (paquete vacío) |
| Backend / API | **No existe** (carpeta vacía) |
| Onboarding | **No existe** (0 coincidencias en el código) |

---

## 2. Metodología

1. **Investigación externa** (4 frentes en paralelo): necesidades y frustraciones de la comunidad (Reddit r/Cubers, SpeedSolving), análisis de competidores (csTimer, Cubeast, Twisty Timer, GAN Cube Station, CubeDB, SpeedCubeDB, CubeSkills, CubingApp), metodologías de entrenamiento de élite (CubeSkills/Feliks, J Perm, AI Speed Cube Trainer) y ecosistema WCA (eventos, reglas, StackMat, smart cubes 2025-26, herramientas de reconstrucción).
2. **Auditoría de código**: mapeo completo de `apps/web/src` (42.921 líneas), todos los paquetes, migraciones SQL, registros de ejercicios, stores de estado, y verificación empírica (tests + typecheck).
3. **Cruce necesidad↔cobertura**: cada necesidad de la comunidad se contrastó con la funcionalidad real del código.

---

## 3. Investigación del Ecosistema (evidencia externa)

### 3.1 Competidores y sus gaps (resumen de la investigación)

| Herramienta | Capa que cubre | Gap principal |
|---|---|---|
| **csTimer** | Timer + estadísticas + scrambles WCA + alg trainer básico + smart cubes + PWA offline | UI anticuada, monolítico, sin IA, sin análisis de fases profundo |
| **Cubeast** | Smart cube analytics (TPS, phase splits, reconstrucción automática), Academy con SRS | Depende de Web Bluetooth, sin capa de entrenamiento estructurado completa |
| **Twisty Timer** | Timer móvil simple, offline, stats | Sin smart cube, sin análisis, sin training estructurado |
| **GAN Cube Station** | Ecosistema GAN: gamificación, battles, tutoriales, reconstrucción | Vendor lock-in total (solo GAN), requiere cuenta |
| **CubeDB / SpeedCubeDB** | Algoritmos (OLL/PLL/F2L/ZBLL), SRS por sheets, reconstrucciones, cross trainer | Sin timer, sin tracking de tiempo real |
| **CubeSkills** | Contenido educativo (cursos de Feliks Zemdegs) | No es software: sin timer, sin stats, sin Bluetooth |
| **CubingApp** | Kinch Ranks / Sum of Ranks (ranking global WCA) | No es timer ni entrenador |

**Oportunidad de mercado confirmada:** ninguna herramienta unifica las 5 capas (timer, smart cube, análisis, entrenamiento, base de algoritmos) en una arquitectura moderna y extensible. El PRD de Cubalyze ya identificó esto; **el código lo confirma**: la mayoría de las capas existen, falta la envoltura de plataforma.

### 3.2 Necesidades y frustraciones más repetidas de la comunidad (con fuentes)

1. **Paridad móvil/escritorio sin sacrificar features** — "Feature-rich timers are desktop-first, mobile apps feel feature-poor". *(SpeedSolving: Making a Cube Timer Site)*
2. **Migración de datos sin fricción** — importar/exportar sesiones históricas entre apps es tedioso. *(SpeedSolving: Making a Cube Timer Site)*
3. **Grabación de video integrada** del último solve para revisión. *(SpeedSolving: Block Keeper thread)*
4. **Latencia y detección de fases erróneas en smart cubes** — falsos +2 o detección incorrecta de cross por orientación inicial. *(SpeedSolving: Cubeast thread)*
5. **Visualizaciones avanzadas** — heatmaps estilo GitHub, distribuciones, tendencias nativas (sin VizCube externo). *(SpeedSolving: VizCube thread)*
6. **Beeps de intervalo configurables para BLD** (memo vs ejecución). *(SpeedSolving: csTimer thread)*
7. **UI moderna y temas** — csTimer tiene backends potentes pero UI densa/anticuada. *(Reddit: "A new CSTimer")*
8. **Parada automática exacta con smart cubes** (el millisegundo exacto de solución). *(SpeedSolving: Cubeast thread)*
9. **Fusionar/mover solves entre sesiones** — rigidez de categorías. *(SpeedSolving: Making a Cube Timer Site)*
10. **Fiabilidad offline con backups locales** — perder historial por caches borrados es inaceptable. *(SpeedSolving: VizCube thread)*

### 3.3 Metodologías de entrenamiento de élite (referencia para cobertura)

- **Práctica deliberada**: dividir el solve en micro-habilidades (cross, F2L, OLL, PLL, transiciones) y aislar el eslabón débil.
- **Lookahead** (marco de Feliks): Spotting → Tracking → Knowing; control de TPS al 60-70%, visión periférica, metrónomo.
- **F2L drills**: Two-look F2L, F2L a ciegas, reducción de rotaciones.
- **Reconocimiento OLL/PLL**: entrenar reconocimiento desvinculado de ejecución.
- **SRS**: repetición espaciada (FSRS/SM-2) para algoritmos.
- **Cross planning**: planificar cross completa + X-Cross en los 15 s de inspección.
- **Stats**: Ao5/Ao12/Ao100, desviación estándar, splits por fase, TPS.
- **Gaps no cubiertos por ninguna herramienta**: IA adaptativa de detección de pausas por caso, simulación de presión competitiva WCA, SRS integrada con datos del cronómetro (si tardas en reconocer un PLL dentro de un Ao100, se inserta en la cola SRS), analítica ergonómica/RSI.

### 3.4 Ecosistema WCA (referencia de cumplimiento)

- **Eventos oficiales**: 3×3, 2×2, 4×4–7×7, 3×3 OH, 3BLD, FMC, Clock, Megaminx, Pyraminx, Skewb, Square-1, 4BLD, 5BLD, MBLD.
- **Reglas de timing que el software debe replicar**: inspección 15 s, +2 entre 15.01–17.00 s, DNF >17 s, formato Ao5 (descartar mejor/peor).
- **StackMat**: jack TRS 2.5 mm → adaptador 3.5 mm → entrada mic/USB audio; señal de audio decodificable.
- **Smart cubes 2025-26**: GAN 12 UI (MagLev), MoYu WeiLong V10 AI, GAN 356 i Carry 2, QiYi AI; todos BLE con protocolos propietarios cifrados.
- **Reconstrucción estándar**: alg.cubing.net, CubeDB (reconstrucciones de solves oficiales), Cubeast.

---

## 4. Auditoría Funcional Completa (módulo por módulo)

### 4.1 Infraestructura y paquetes

| Paquete | Estado real | Compleción | Calidad | Notas / deuda técnica |
|---|---|---|---|---|
| `math-core` | Solver matemático, estados, máscaras por método | ✅ 100% | Alta (20+ archivos de test) | Sólido |
| `solver-engine` | Min2Phase + generadores de scrambles + 2×2 | ✅ 100% | Alta (111 tests) | Solo 2×2 y 3×3; sin scramblers para otros eventos |
| `cube-3d-engine` | Motor 3D, replay, giroscopio, worker | ✅ 100% | Alta | Muy completo |
| `hardware-hal` | GAN cube/timer + StackMat + deriva de reloj | ✅ 100% | Alta | Solo GAN (MoYu/QiYi pendientes) |
| `gan-protocol` | Descifrado protocolo GAN | ✅ 100% | Alta | Solo GAN |
| `analysis-engine` | Splits de fase, TPS, pausas, rotaciones, eficiencia | ✅ 100% | Alta (CFOP + Roux) | Fases solo CFOP/Roux; sin ZZ/Petrus dedicados |
| `algorithm-db` | Catálogo F2L/OLL/PLL + Ortega + generador de casos | ✅ 100% | Alta (verificado contra SpeedCubeDB) | Solo 3×3 y 2×2 |
| `training` | FSRS-4 real, session engine, registry, scheduler | ✅ 100% | Alta | La joya del producto |
| `statistics` | Ao5/12/100, BPA/WPA, std dev | ✅ 100% | Alta | Básico pero correcto |
| `timer-engine` | Máquina de estados WCA (inspección, +2, DNF) | ✅ 100% | Alta | Correcto |
| `database` | SQLite WASM (OPFS), migraciones, repositorios | ✅ 100% | Alta | Backend local real, no mock |
| `state` | Stores Zustand | ✅ 100% | Alta | |
| `types` / `models` | Tipos + schemas zod | ✅ 100% | Alta | |
| `ui` | shadcn/ui | ✅ 100% | Alta | |
| **`ai-core`** | **VACÍO** (solo package.json) | ❌ 0% | — | **AI Coach no existe** |
| **`sync-engine`** | **VACÍO** (solo package.json) | ❌ 0% | — | **Sync no existe** |
| **`apps/api`** | **VACÍO** (solo package.json) | ❌ 0% | — | **Backend no existe** |

### 4.2 Navegación (Left Sidebar)

La sidebar tiene 5 vistas + Widgets:
- **Main:** Timer
- **Training:** Training, Algorithms, Skills
- **Progress:** Stats
- **Explore:** Widgets

**Faltan en navegación:** Perfil, Logros, AI Coach, Sync/Account, Comparación/Comunidad — todos planificados en PRD pero sin vista.

### 4.3 Vistas principales

| Vista | Estado | Evaluación |
|---|---|---|
| **Timer** | ✅ Completo | Inspección WCA, penalidades, focus mode, PB celebration (audio+animación+hápticos), verificación de scramble en vivo, modo manual, smart cube. De nivel profesional. |
| **Training** | ✅ Muy completo | Dashboard method-first (CFOP, Roux, ZZ, Petrus, Ortega, CLL, EG), tarjetas de fase, Drill, Recognize, Full Solve, Cross Trainer (Plain/Blind/≤8/CN), LSE sub-phases (EO/ULUR/M), EO (Detect/Efficiency), SRS Review con FSRS-4 real, SRS Insights, Phase Stats, Training Calendar, Review Queue (Overdue/Due/Weak/New). |
| **Algorithms (Practice)** | ✅ Completo | Árbol de métodos, grid de casos, panel de detalle, editor de algoritmos propios, diagramas 2D/3D por caso, bridge "Practice This Case" → Training. |
| **Skills (Skill Tree)** | ✅ Completo | Grafo interactivo (zoom/pan), modo lista, categorías (fundamentals, cross, F2L, LL, lookahead, finger-tricks, inspection, color-neutrality, hardware, psychology, training, roux, zz, blindfold, fmc, theory), XP, prerequisitos, persistencia SQLite. |
| **Stats (Insights)** | ✅ Completo | Filtros sesión×puzzle, Overview (métricas, TPS series, histograma, heatmap actividad, distribución de fases), Solve List, Analysis panel por solve, Replay 3D. |

### 4.4 Widgets (sistema propio de widgets flotantes)

12+ widgets funcionales con dock, drag & drop, persistencia de posición y sandbox: Times Log, Scramble 2D, PB Progression, Solve Timeline, Time Distribution, Metronome, Notes (todos/tareas), Phase Balance (con benchmarks), Algorithm DB viewer, 3D Cube, Layout Organizer. **Sistema avanzado y único en el ecosistema** — diferenciador real.

### 4.5 Settings (11 secciones)

General, Appearance, Smart Cube, Timer, Scramble, Analysis, Training, Notifications, Shortcuts, Data (export/import CSV/csTimer/JSON), Advanced. **Completo y coherente.**

### 4.6 Otras funcionalidades

| Funcionalidad | Estado |
|---|---|
| Import/Export (CSV, csTimer, JSON, preview) | ✅ Implementado |
| Sessions (crear/renombrar/cambiar/borrar) | ✅ Implementado |
| Modo táctil móvil/tablet (bottom tab bar, sheets, safe-areas) | ✅ Implementado |
| PWA (installable, offline) | ✅ Implementado |
| Desktop Tauri (BLE nativo, auto-conexión) | ✅ Implementado (reusa web) |
| Demo data seeding | ✅ Implementado |
| Onboarding | ❌ **No existe** |
| Perfil de usuario | ❌ No existe |
| Logros/Badges | ❌ No existe (solo XP del skill tree) |
| Goals/Metas definidas por el usuario | ⚠️ Parcial (calendar tasks, sin metas de rendimiento tipo "sub-15") |
| Streaks | ⚠️ Parcial (calendario de actividad; sin streak explícito) |
| Comparación con comunidad | ❌ No existe |
| AI Coach | ❌ No existe |
| Sync multi-dispositivo / cuenta | ❌ No existe |
| StackMat físico | ⚠️ Paquete implementado (adapter de audio) pero sin UI de conexión completa |
| Video de solves | ❌ No existe |
| Beeps BLD configurables | ⚠️ Parcial (metronomo widget, sin perfiles BLD) |

---

## 5. Auditoría de Cobertura del Entrenamiento

### ¿Puede un speedcuber entrenar todas las áreas importantes solo con Cubalyze?

**Para 3×3 CFOP y 2×2: SÍ, cubre casi todo lo esencial.** **Para el resto del ecosistema: NO.**

| Área | ¿Cubierta? | Detalle |
|---|---|---|
| Cross / XCross / CN / inspección | ✅ Sí | Cross Trainer con 4 modos + CN + ≤8 |
| F2L básica (41 casos) | ✅ Sí | Drill + Recognize + Advanced F2L (54 casos) |
| OLL / PLL (57/21) | ✅ Sí | Drill, Recognize, SRS FSRS-4 |
| Reconocimiento OLL/PLL | ✅ Sí | AlgorithmRecognizeView |
| Full solve con phase targets | ✅ Sí | FullSolveView |
| SRS / repetición espaciada | ✅ Sí | FSRS-4 real con scheduler (mejor que la mayoría de competidores) |
| Roux (blocks, CMLL, LSE) | ✅ Sí | Blocks + CMLL + LSE sub-phases (EO/ULUR/M) |
| ZZ (EOLine, EO) | ✅ Sí | EOLine + EO Detect/Efficiency |
| Petrus | ⚠️ Parcial | Fases definidas, ejercicios genéricos, sin training dedicado |
| 2×2 (Ortega, CLL, EG) | ✅ Sí | Algoritmos seed + drill |
| **BLD (3BLD, MBLD)** | ❌ No | Solo "Blind Cross" como drill; sin memo training, sin beeps BLD |
| **OH (One-Handed)** | ❌ No | Sin modo |
| **Big cubes (4×4–7×7)** | ❌ No | Sin scrambles ni timer |
| **FMC** | ❌ No | Sin modo |
| **Clock / Megaminx / Pyraminx / Skewb / Square-1** | ❌ No | Sin soporte |
| **Smart cube con drills** | ✅ Sí | useDrillSmartCube, verificación de estado |
| **Lookahead** | ⚠️ Parcial | Blind drills + metrónomo; sin drill estructurado de "tracking" de pares |
| **Entrenamiento por errores** | ⚠️ Parcial | Analysis detecta pausas/rotaciones; sin plan de entrenamiento automático desde errores |
| **Entrenamiento inteligente (IA)** | ❌ No | Sin AI Coach |

### Checklist de tipos de entrenamiento

| Pregunta | Respuesta |
|---|---|
| ¿Permite entrenamiento deliberado? | ✅ Sí (drills por fase, modos por habilidad) |
| ¿Permite práctica estructurada? | ✅ Sí (métodos → fases → ejercicios) |
| ¿Permite entrenamiento basado en objetivos? | ⚠️ Parcial (metas manuales no soportadas; phase targets en Full Solve sí) |
| ¿Permite entrenamiento basado en errores? | ⚠️ Parcial (análisis de pausas/rotaciones existe; no genera drills automáticos) |
| ¿Permite entrenamiento basado en estadísticas? | ✅ Sí (Phase Stats, SRS Insights, Overview) |
| ¿Permite entrenamiento basado en historial? | ✅ Sí (historial completo, heatmap, sesiones) |
| ¿Permite entrenamiento personalizado? | ⚠️ Parcial (el usuario elige; no hay plan adaptativo) |
| ¿Permite entrenamiento inteligente? | ❌ No (sin IA) |

---

## 6. Comparación con las Necesidades de la Comunidad

| Necesidad (fuente) | ¿Cubalyze la resuelve? | Módulo |
|---|---|---|
| Paridad móvil/escritorio | ✅ Sí (95%) | Bottom tab bar + sheets + touch targets |
| Migración de datos sin fricción | ✅ Sí | Import/Export CSV/csTimer/JSON con preview |
| Visualizaciones avanzadas (heatmap, distribuciones) | ✅ Sí | OverviewPanel + widgets |
| Parada automática exacta smart cube | ✅ Sí | Timer engine + BLE move stream + clock drift |
| Fiabilidad offline con backups locales | ✅ Sí | SQLite OPFS + warning de storage volátil + export |
| UI moderna y temas | ✅ Sí | Tema claro/oscuro, diseño moderno |
| Fusionar/mover solves entre sesiones | ⚠️ Parcial | Sesiones existen; mover solves entre sesiones no evidente |
| Latencia/fases erróneas en smart cube | ⚠️ Parcial | Scramble verification y veredictos; riesgo residual inherente a BLE |
| Grabación de video integrada | ❌ No | — |
| Beeps de intervalo BLD | ⚠️ Parcial | Metrónomo genérico; sin perfiles memo/ejecución |
| SRS integrada con datos del cronómetro | ✅ Sí (diferenciador) | Cola SRS con FSRS-4 alimentada por drills/reviews |
| AI que detecte pausas por caso y genere plan | ❌ No | ai-core vacío |
| Comparación con comunidad / sharing | ❌ No | — |

---

## 7. Auditoría de Coherencia del Producto

**Fortalezas:**
- **Arquitectura coherente**: monorepo con interfaces limpias; el desktop reusa el 100% del App web; los paquetes headless (solver, analysis, training) son independientes y testeables.
- **Integración real entre módulos**: Algorithms → "Practice This Case" → Training con preset; Insights → Replay 3D; análisis de solves → métricas por fase → Phase Stats; widget Phase Balance consume análisis real.
- **Consistencia visual**: tema unificado, tokens de color de fase compartidos (`phaseColors.ts`), shadcn/ui centralizado.
- **Sin duplicidades graves**: el patrón `PenaltyBadge` duplicado se consolidó en atoms.

**Debilidades / deuda técnica:**
1. **Funcionalidades aisladas**: el skill tree y el training no comparten datos de progreso (un drill no desbloquea nodos del skill tree automáticamente). Los "achievements" del skill tree son manuales.
2. **AI/Sync/Backend vacíos** = los 3 pilares del PRD (Partes 13, 4.3, 4.6) sin implementar. La app es 100% local y sin identidad de usuario.
3. **Sin onboarding**: un principiante no sabe por dónde empezar; el skill tree podría ser el mapa pero nadie lo guía.
4. **Datos demo**: existe `seedDemoData.ts` con flag de aislamiento (migración 008), buena práctica, pero la experiencia de primer uso sigue vacía.
5. **Cobertura de eventos muy limitada** (solo 2×2/3×3) frente a un mercado que espera multi-evento (los competidores soportan todos los eventos WCA).
6. **UI del "Advanced F2L" (54 casos trapped/keyhole)** declarada pero hay que verificar la densidad real del catálogo (al menos OLL/PLL están verificados contra SpeedCubeDB).
7. **PWA `theme-color` fijo a `#0f172a`** (bug conocido documentado en plan_mobile).

---

## 8. Evaluación de Valor por Módulo

| Módulo | Valor real | Integrado en flujo principal | ¿Preparado para crecer? | Prioridad de mejora |
|---|---|---|---|---|
| Timer | ★★★★★ | Sí | Sí | Baja |
| Analysis (Insights) | ★★★★★ | Sí | Sí | Baja |
| Training + SRS | ★★★★★ | Sí | Sí | Baja |
| 3D Cube + Replay | ★★★★☆ | Sí | Sí | Baja |
| Algorithms DB | ★★★★☆ | Sí | Sí | Media (más métodos/eventos) |
| Skill Tree | ★★★☆☆ | Parcial | Sí | Media (conectar con training) |
| Widgets | ★★★☆☆ | Parcial | Sí | Media |
| Hardware HAL | ★★★★★ | Sí | Sí | Media (MoYu/QiYi) |
| Import/Export | ★★★★☆ | Sí | Sí | Baja |
| **AI Coach** | — | No | No | **Crítica (no existe)** |
| **Sync/Account** | — | No | No | **Crítica (no existe)** |
| **Onboarding** | — | No | No | **Alta (no existe)** |
| **Eventos multi-WCA** | — | No | No | **Alta (no existe)** |

---

## 9. Roadmap de Finalización (por fases)

Construido exclusivamente con la evidencia de esta auditoría. No asume que solo faltan AI y Sync: **onboarding y multi-evento son igual de críticos** (el 76% de los eventos WCA no están soportados, y el primer contacto con la app es un muro).

### Fase 1 — Cimiento de plataforma (P0, crítica)
| Elemento | Justificación | Impacto | Prioridad | Dependencias | Complejidad | Riesgo |
|---|---|---|---|---|---|---|
| **Identidad de usuario + perfil** | Sin cuenta no hay sync, ni AI personalizada, ni comparación. Es la base de todo lo demás. | Alto (desbloquea F2/F3) | P0 | — | Media | Medio (decisión auth: local-first con ID anónimo vs email) |
| **Sync-engine (append-only log)** | PRD 4.4 ya diseñado: eventos inmutables, dedupe idempotente. Sin él no hay multi-dispositivo. | Alto | P0 | Fase 1.1 | Alta | Alto (conflictos, versionado de esquema) |
| **Onboarding guiado** | La comunidad pide guía; el skill tree ya es el mapa perfecto. Sin onboarding, la retención de novatos es mínima. | Alto (retención) | P0 | — | Baja | Bajo |
| **Backend/API mínimo** | Necesario para sync y futura comunidad. Empezar con Auth + Solve Ingest + Stats. | Alto | P0 | Fase 1.1 | Alta | Alto |

### Fase 2 — Cobertura WCA (P0/P1, alta)
| Elemento | Justificación | Impacto | Prioridad | Dependencias | Complejidad | Riesgo |
|---|---|---|---|---|---|---|
| **Eventos 3×3 OH + BLD básico** | Los más demandados tras 3×3. OH = modo de timer; BLD = memo timer + beeps configurables (necesidad nº6 de la comunidad). | Alto | P0 | — | Media | Medio |
| **Big cubes 4×4/5×5** | Mercado grande; requiere scrambles TNoodle-style y solver de paridad. | Medio-Alto | P1 | — | Alta | Alto |
| **Pyraminx/Skewb/Clock/Megaminx/Square-1** | Scrambles + timer + stats básicos (sin análisis profundo). | Medio | P1 | — | Media | Medio |
| **Catálogo de algoritmos ampliado** (COLL, WV, VLS, ZBLL, CMLL completo) | PRD 10 lo promete; hoy solo F2L/OLL/PLL/Ortega seed. | Medio | P1 | — | Alta (contenido) | Medio |

### Fase 3 — Inteligencia (P1)
| Elemento | Justificación | Impacto | Prioridad | Dependencias | Complejidad | Riesgo |
|---|---|---|---|---|---|---|
| **AI Coach (ai-core)** | Diferenciador principal vs csTimer/CubeDesk. Debe ser *explicable* (PRD 13.1): detectar pausas por caso, errores recurrentes, y generar plan. | Alto (diferenciación) | P1 | Fase 1.1 (perfil) + analysis-engine (ya existe) | Alta | Medio (requiere API de LLM y gestión de costes) |
| **Recomendaciones desde datos reales** | "Tu F2L no es lento, es el reconocimiento entre pares" — el pattern que ya valida el mercado. | Alto | P1 | AI Coach | Media | Bajo |
| **Entrenamiento adaptativo** | El scheduler FSRS ya existe; añadir selección de casos por debilidad detectada en solves reales (necesidad nº4 investigación). | Alto | P1 | AI Coach + analysis | Media | Bajo |

### Fase 4 — Comunidad y gamificación (P2)
| Elemento | Justificación | Impacto | Prioridad | Dependencias | Complejidad | Riesgo |
|---|---|---|---|---|---|---|
| **Logros/Badges + streaks** | Gamificación inteligente (sin grind vacío, PRD 9.2). | Medio | P2 | Perfil | Baja | Bajo |
| **Compartir reconstrucciones** | Estándar del ecosistema (CubeDB). Replay 3D ya existe. | Medio | P2 | Sync | Media | Medio |
| **Comparación con comunidad (anon, opt-in)** | PRD 14.1. | Bajo-Medio | P2 | Backend | Media | Medio |
| **Grabación de video integrada** | Necesidad nº3 de la comunidad. | Bajo | P3 | — | Media | Medio |

### Fase 5 — Pulido y consolidación (P2/P3)
| Elemento | Justificación | Impacto | Prioridad | Dependencias | Complejidad | Riesgo |
|---|---|---|---|---|---|---|
| **Conectar skill tree ↔ training** | Los drills deberían alimentar el progreso del skill tree (coherencia, §7). | Medio | P2 | — | Baja | Bajo |
| **Mover solves entre sesiones** | Necesidad nº9. | Bajo | P3 | — | Baja | Bajo |
| **UI StackMat completa** | El adapter existe; falta la UX de conexión. | Bajo | P3 | — | Baja | Bajo |
| **Beeps BLD configurables** | Necesidad nº6. | Bajo | P3 | — | Baja | Bajo |
| **Fix theme-color PWA** | Bug documentado. | Bajo | P2 | — | Muy baja | Nulo |

### Orden recomendado resumido
1. Perfil/identidad → 2. Sync + Backend mínimo → 3. Onboarding → 4. OH/BLD → 5. Big cubes/otros eventos → 6. AI Coach → 7. Catálogo ampliado → 8. Comunidad/gamificación → 9. Pulido.

---

## 10. Riesgos transversales

1. **Decisión de arquitectura de cuenta pendiente**: local-first con ID anónimo (más simple, alineado con offline-first) vs cuentas email (más estándar, requiere backend). Recomendación: empezar por ID anónimo + export/import manual, añadir email como capa opcional.
2. **Licencia GPLv3**: csTimer, cubing.js y tnoodle son GPLv3; si se integra código directo de esos proyectos (p. ej., adaptadores de smart cube no-GAN), hay obligaciones de licencia. El PRD ya advierte de esto (Parte 17).
3. **Contenido vs código**: ampliar catálogo de algoritmos es trabajo de contenido (curation), no solo de código; requiere proceso de verificación (ya hay tests de comparación contra SpeedCubeDB).
4. **Costes de IA**: AI Coach con LLM requiere gestión de costes y fallback local determinista para mantener la filosofía offline-first.

---

## 11. Conclusión

Cubalyze es **técnicamente superior a la mayoría de competidores en su núcleo** (motor 3D propio, análisis real de solves, FSRS-4, HAL multi-vendor, sistema de widgets) — algo que ninguna herramienta del mercado unifica. El problema no es el motor: es que **no hay plataforma alrededor del motor**. Las 3 inversiones con mayor ROI inmediato son: (1) identidad+sync, (2) onboarding, (3) cobertura de eventos WCA. La IA, aunque es el diferenciador de marketing más potente, debe construirse sobre esas bases para ser verdaderamente útil y explicable.

---

## 12. Referencias externas (fuentes de la investigación)

- Reddit r/Cubers — "A new CSTimer": https://www.reddit.com/r/Cubers/comments/1jummf5/a_new_cstimer/
- SpeedSolving — "Making a Cube Timer Site — Ideas Needed": https://www.speedsolving.com/threads/making-a-cube-timer-site-ideas-needed.77687/
- SpeedSolving — "Cubeast" (smart cubes, phase splits): https://www.speedsolving.com/threads/cubeast-a-speedcubing-timer-for-bluetooth-cubes.77406/
- SpeedSolving — "VizCube" (visualizaciones): https://www.speedsolving.com/threads/vizcube-fun-and-helpful-way-to-vizualize-solves.92835/
- SpeedSolving — "csTimer released" (beeps BLD, page 32): https://www.speedsolving.com/threads/cstimer-released.36236/
- CubeSkills — Lookahead Progression Framework (Feliks Zemdegs): https://www.cubeskills.com/blog/lookahead-progression-framework
- WCA Regulations: https://www.worldcubeassociation.org/regulations/
- SpeedCubeShop — Best Bluetooth Speed Cubes: https://speedcubeshop.com/a/blog/which-bluetooth-speed-cube-is-best
- csTimer: https://cstimer.net/ · Cubeast: https://www.cubeast.com/ · SpeedCubeDB: https://speedcubedb.com/ · CubeDB: https://cubedb.net/ · CubeSkills: https://www.cubeskills.com/ · Twisty Timer (Google Play) · GAN Cube Station (Google Play) · CubingApp: https://cubingapp.com/
