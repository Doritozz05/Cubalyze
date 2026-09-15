---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-08-12"
version: "1.0.0"
related_rfc: "Ninguno (decisión registrada retroactivamente el 2026-08-12)"
supersedes: "None"
superseded_by: "None"
tags: "training, spaced-repetition, fsrs, srs, offline-first"
document_type: "ADR"
---

# ADR-024 — Sistema de Entrenamiento con Repetición Espaciada (FSRS)

> **Nota de registro:** este ADR documenta una decisión que ya estaba implementada
> (vista Training, `apps/web/src/views/Training/` + paquete `@cubalyze/training`).
> Se creó retroactivamente en la auditoría de Fase 0 (2026-08-12) porque la decisión
> nunca se había registrado.

## Context and Problem Statement

Cubalyze necesita un sistema de entrenamiento integrado que vaya más allá de
"hacer solves": práctica deliberada por método (CFOP, Roux, ZZ, Petrus, 2x2…) y
fase (Cross, F2L, OLL, PLL, LSE, EO…), con seguimiento de progreso por caso de
algoritmo y un mecanismo que **programe cuándo repasar cada caso** para maximizar
la retención. Los requisitos no negociables:

- **Offline-first**: todo el entrenamiento y su historial deben vivir en el
  dispositivo (SQLite), sin backend (ADR-013, ADR-019 pendiente).
- **Dos señales de dominio**: los speedcubers necesitan tanto *reconocimiento*
  (identificar el caso) como *ejecución* (velocidad + eficiencia de movimientos).
  Un sistema de memoria solo con "correcto/incorrecto" pierde la mitad del valor.
- **Basado en el catálogo real**: los métodos, fases y casos ya viven en
  `@cubalyze/algorithm-db`; el entrenamiento debe consumirlos, no duplicarlos.
- **Retención con base científica**: no basta un contador de rachas; se necesita
  un modelo de memoria con intervalos crecientes validado empíricamente.

## Decision Drivers

- **Retención a largo plazo** de algoritmos (los cubers memorizan cientos de casos).
- **Simplicidad y cero dependencias** en el núcleo de programación (corre en
  cualquier backend de almacenamiento, incluido el worker de SQLite).
- **Doble métrica** reconocimiento vs. ejecución, y maestría calculable por caso,
  fase y método.
- **Integración total con el catálogo** de `@cubalyze/algorithm-db` (métodos,
  subsets, casos, scrambles).
- **Experiencia dirigida**: cola diaria priorizada (qué repasar hoy) sin que el
  usuario tenga que decidir.

## Considered Options

- **SM-2 (Anki clásico)**: ease factor único fijo por tarjeta. Simple, pero no
  modela la dificultad intrínseca del caso ni adapta la retención por tarjeta.
- **Cajas de Leitner**: muy simple de entender, pero sin base temporal real
  (intervalos fijos por caja) y sin priorización cuantitativa.
- **FSRS-4 (Free Spaced Repetition Scheduler)**: modelo con dos cantidades
  ocultas — *estabilidad* S (duración de la memoria en días) y *dificultad* D
  (1-10) — de las que se deriva la *retrievabilidad* R(t). Es el algoritmo de
  Anki 23.10+ (Ye et al., 2022) y programa el repaso justo cuando R cae a la
  retención objetivo (0.9), produciendo el efecto de espaciamiento validado
  (Cepeda et al., 2006).

## Decision Outcome

Chosen option: **FSRS-4, implementación propia en TypeScript puro** dentro de
`@cubalyze/training` (`src/progress/fsrs.ts`), sin dependencias, conectada al
almacenamiento vía la interfaz de repositorio (`ITrainingProgressRepo`). El
`ProgressTracker` orquesta el ciclo: `recordAttempt` (métricas de
reconocimiento/ejecución) → `recordReview` (calificación Again/Hard/Good/Easy que
avanza la máquina de estados FSRS new/learning/review/relearning) → `getTodayQueue`
(colas diarias). El estado FSRS persiste en `algorithm_progress` (columnas
`srs_*`).

### Positive Consequences

- **Retención con base científica** y priorización cuantitativa de la cola diaria
  (retrievabilidad + overdue + debilidad + interferencia contextual por
  round-robin de subsets — Shea & Morgan, 1979).
- **Doble señal de dominio**: recognition y execution se registran por separado
  y alimentan métricas y maestría (`computeMastery` con pesos).
- **Cero dependencias** en el núcleo; la lógica es pura y testeable
  (`progress/__tests__/fsrs.test.ts`, `scheduler.test.ts`, etc.).
- **Offline-first** real: todo persiste en SQLite vía el worker (ADR-013/016).

### Negative Consequences

- **Complejidad de estado**: el modelo FSRS tiene más piezas que SM-2
  (estabilidad, dificultad, lapses, estados) — requiere cuidado en las
  migraciones de BD (ver `migrations.ts` 015_add_fsrs_fields).
- **La cola excluye casos nuevos por defecto**: el usuario debe practicar un caso
  al menos una vez para que entre en el repaso (decisión deliberada para no
  inundar de tarjetas nuevas, configurable con `newPerDay`).
- **Sesgo de auto-reporte**: en ejecución manual el veredicto lo marca el usuario;
  con smart cube (`useDrillSmartCube`) se valida automáticamente, pero esa
  validación solo existe donde hay hardware.

## Pros and Cons of the Options

### FSRS-4 (elegido)
* **Good, because:** programa el repaso en el punto óptimo de olvido (R = 0.9),
  con intervalos que crecen al ritmo de cada caso.
* **Good, because:** la dificultad D se adapta por caso (un caso que falla se
  vuelve "más difícil" en el modelo).
* **Bad, because:** más parámetros y estado que SM-2; la UI debe ocultar esa
  complejidad (y lo hace: la sesión de review expone solo 4 botones).

### SM-2
* **Good, because:** simple y conocido por la comunidad Anki.
* **Bad, because:** ease factor fijo ignora la dificultad del caso y no hay
  retrievabilidad calculable para priorizar la cola.

### Leitner
* **Good, because:** extremadamente simple de implementar y explicar.
* **Bad, because:** intervalos arbitrarios por caja, sin base temporal empírica
  ni priorización cuantitativa.

## Unresolved Questions

- ¿Debería la cola incluir casos *no practicados* de forma limitada por defecto
  (`newPerDay`) en lugar de excluirlos, para on-boarding de algoritmos nuevos?
  (Actualmente excluidos; la vista Algorithms cubre el descubrimiento.)
- ¿Se sincronizará el progreso de entrenamiento a la nube cuando exista el
  backend (ADR-019)? El esquema actual lo permite (tablas locales), pero la
  resolución de conflictos de estado FSRS entre dispositivos no está diseñada.
