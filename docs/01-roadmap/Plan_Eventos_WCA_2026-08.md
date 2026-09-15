# Plan: Cobertura de Eventos WCA — Fundación Genérica Primero

**Fecha**: 2026-08-15
**Estado**: Propuesto (pendiente de revisión en el Master Roadmap)
**Owner**: Tech Lead / Principal Architect
**Filosofía**: Este documento es un plan de secuencia (Roadmap), no un diseño técnico (TDD). Las decisiones de tecnología se resuelven en RFC/ADR según el [Documentation Bootstrap Guide](../Documentation_Bootstrap_Guide.md). Sigue el formato de fases del [Master Roadmap](./Master_Roadmap.md).

---

## 1. Contexto (verificado 2026-08)

Estado real del código hoy:

| Área | Ubicación | Estado |
|---|---|---|
| **DB `solves.puzzle_type` / `sessions.puzzle_type`** | `packages/database` (migración 011) | Texto libre con default `'3x3x3'` — **sin registro de eventos, sin validación** |
| **Tipos de puzzle** | `PuzzleTypeKey = '3x3x3' \| '2x2x2'` | **Duplicado en 3 sitios** (`FloatingAlgorithmDbPanel`, `MethodTree`, `MobileMethodNavigator`); no existe en `packages/types` |
| **Scrambles** | `apps/web/src/utils/puzzleUtils.ts` | Reales solo 2×2 (TwoByTwoScrambler) y 3×3 (Min2Phase random-state). **Todo lo demás cae a 3×3** (puzzles fantasma, ver investigación §12.3) |
| **Reglas WCA** | `packages/timer-engine/src/WcaRules.ts` | `getInspectionPenalty` (15s→+2, 17s→DNF), `calculateFinalTime`, `Penalty` — **perfil único centrado en 3×3** |
| **Stats** | `@cubalyze/statistics` | Genéricas y puzzle-agnósticas (`averageOf`, `computeStats`, `computeBpaWpa`, `stdDeviation`) ✅ |
| **Análisis por solve** | `packages/analysis-engine` | Fases CFOP/Roux — **solo 3×3** |
| **Catálogo de algs** | `packages/algorithm-db` | Métodos/subsets con `puzzleType`; **CLL/EG/CMLL/OCLL/ZZLL/ZBLL sin seeds** (investigación §12.4) |

**Referencias:** [Investigación del ecosistema §12.3–12.4](../00-product/Ecosistema_Cubing_Investigacion_2026-08.md), [Auditoría de producto](../00-product/Auditoria_Producto_2026-08.md), [PRD Parte 0.3.3 y 4.2](../00-product/PRD.md).

**Decisión WCA externa (junio 2026):** FTO entra como evento oficial el 2-ene-2027; Clock se elimina tras el World Championship 2027. Ver [anuncio WCA](https://www.worldcubeassociation.org/posts/changes-to-the-wca-s-list-of-official-events-june-2026).

---

## 2. Principio rector

> **La parte genérica primero.** Toda la maquinaria de eventos (modelo de datos, registro de eventos, contrato de scrambles, reglas, estadísticas y selector) se construye como infraestructura puzzle-agnóstica ANTES de tocar ningún puzzle concreto. 3×3 es el primer consumidor que **valida** la fundación; 2×2 es el test de paridad; el resto de eventos son *declaraciones* sobre la fundación, no código nuevo en el core.

Esto cumple el PRD §0.3.3 (no reinventar, reutilizar) y el Master Roadmap §3–4 (DAG de dependencias, entrega incremental con artefactos verificables).

---

## 3. FASE A — Fundación genérica (Event Core)

**Goal**: Un sistema profesional de datos y comportamiento por evento, donde "añadir un evento" = declarar una especificación, nunca tocar el core.

**Motivation**: Hoy `puzzle_type` es un string sin contrato; el selector miente (puzzles fantasma); las reglas WCA son de 3×3; el tipo `PuzzleTypeKey` está duplicado. Sin esta fundación, cada evento nuevo se implementaría como un caso especial — exactamente el anti-patrón que la arquitectura del proyecto prohíbe.

**Dependencies**: `packages/database`, `packages/types`, `packages/timer-engine`, `packages/math-core` (todos existentes).

### Fase A1 — Registro de eventos (Event Registry)
**Scope**:
- Definir `EventSpec`/`PuzzleSpec` declarativo en un paquete headless (candidato: `packages/types` o nuevo `packages/events` — decidir en RFC):
  - `id` WCA canónico y `puzzleType` de persistencia (p. ej. `"333oh"` vs el string libre de hoy)
  - Modelo de estado (capas, caras) y notación de movimientos
  - Provider de scramble (ver A4)
  - Perfil de reglas WCA: inspección (sí/no, umbrales), penaltis aplicables, formato oficial (Ao5/Bo3/Bo1/mo3), límites
  - Análisis aplicable (fases/métodos o ninguno)
  - Estadísticas válidas por evento
- Poblar el registro con los **17 eventos actuales** + FTO (2027) marcado como futuro.
- *Excluye*: implementación de providers; UI.
**Deliverables**: Registry headless con los 17+1 eventos declarados, validado con tests.
**Exit Criteria**: Un test recorre los 17 eventos y comprueba que cada spec es válida (ids únicos, tipos consistentes, formato conocido).
**Risks**: Sobrecargar el spec con campos que no aplican a todos (FMC/MBLD son muy distintos).

### Fase A2 — Modelo de datos profesional (DB)
**Scope**:
- Tabla `events` (o constraint) que **valide** `puzzle_type` en `solves` y `sessions` (CHECK contra el registro o FK lógica).
- Migración de datos existentes: consolidar `3x3x3`/`2x2x2` (ya correctos) y **separar OH** de 3×3 (hoy se guarda como `3x3x3` — bug §12.3/§14.2).
- Mantener defaults seguros (`3x3x3`) y compatibilidad con la migración 011 y restore.
- *Excluye*: sync/backend (fuera de alcance de este epic).
**Deliverables**: Migraciones + repositorios con validación de `puzzle_type`; tests de migración y de restricciones.
**Exit Criteria**: Insertar un solve con `puzzle_type` desconocido falla; los datos existentes migran sin pérdida (verificado por tests de migración).
**Risks**: Datos corruptos previos (solves OH mezclados con 3×3) — necesita política de migración explícita (ver Fase D, OH).

### Fase A3 — Tipos compartidos (SSoT)
**Scope**:
- Elevar `PuzzleTypeKey` y el registro a `packages/types` como única fuente de verdad.
- Eliminar las 3 duplicaciones locales; resolver los usos que hoy castean con `as`.
- Mapa de labels/orden compartido (hoy `PUZZLE_LABELS`/`PUZZLE_ORDER` duplicados en Algorithm UI).
- *Excluye*: UI nueva.
**Deliverables**: Un único `PuzzleTypeKey`/registro importado en web y desktop.
**Exit Criteria**: `grep -r "type PuzzleTypeKey"` devuelve 0 definiciones locales; typecheck pasa.
**Risks**: Mínimo.

### Fase A4 — Contrato de scrambles genérico
**Scope**:
- Interfaz `ScrambleProvider { generate(spec): string; validate(scramble): boolean }` con verificación de estado (después de aplicar el scramble, el cubo NO está resuelto y cumple el mínimo de movimientos WCA).
- Registro de providers: 2×2 y 3×3 (ya existen en `math-core`) como primeros miembros.
- `generateScrambleFor()` deja de tener un `default: 3×3` silencioso — los eventos sin provider devuelven "no disponible" (fin de los puzzles fantasma).
- *Excluye*: nuevos solvers de eventos.
**Deliverables**: Interfaz + providers 2×2/3×3 adaptados + tests de verificación (aplicar scramble y comprobar estado).
**Exit Criteria**: 1.000 scrambles 2×2/3×3 verificados; un evento sin provider no produce scramble de 3×3.
**Risks**: Coste de verificación (resolver estado por scramble); decidir umbral de "no resuelto" por evento.

### Fase A5 — Reglas WCA parametrizadas por evento
**Scope**:
- Refactor de `WcaRules` a un perfil por evento: inspección (15s→+2, 17s→DNF para speed events; sin inspección para FMC/BLD), penaltis (+2/DNF por evento), formato de resultado.
- El timer consume el perfil del evento activo, no un único set global.
- *Excluye*: formatos de ronda complejos (corte WCA) — se documenta como futuro (necesidad nicho §11.8).
**Deliverables**: `WcaRules` perfilado + tests por evento (3×3 hoy; perfiles declarados para el resto).
**Exit Criteria**: Los tests actuales de `WcaRules` siguen pasando sin cambios de comportamiento para 3×3; cada evento declara su perfil.
**Risks**: FMC/MBLD no encajan en el modelo actual (resultados por puntos, límite 1h) — pueden requerir extensión del spec en Fase D.

### Fase A6 — Selector y sesiones data-driven
**Scope**:
- El selector de puzzles se genera desde el registro (solo eventos con provider real o marcados "próximamente"); desaparecen los puzzles fantasma (investigación §12.3).
- Sesiones y stats filtran por `puzzle_type` validado.
- *Excluye*: nuevos eventos.
**Deliverables**: Selector real, sin falsas apariencias.
**Exit Criteria**: Elegir "Pyraminx" ya no cronometra un 3×3 (queda bloqueado/etiquetado); OH separado de 3×3.
**Risks**: Cambio de UX — validar que el selector no pierde eventos que hoy "funcionan" (mentira útil → honestidad).

---

## 4. FASE B — 3×3 como referencia (entender 3×3 a fondo)

**Goal**: Que 3×3 sea el *golden path* completo que valida la fundación genérica y sirve de estándar de comparación para todos los demás eventos.

**Motivation**: El usuario pide explícitamente "un sistema profesional de base de datos entendiendo cómo funciona 3×3". 3×3 es el evento más completo (scramble, reglas, análisis CFOP/Roux, catálogo, stats, import/export) — modelarlo a fondo expone los requisitos reales que la fundación debe cubrir.

**Scope**:
- **B1 — Mapa de cobertura 3×3**: recorrer todo el flujo (timer → scramble → sesión → stats → análisis → catálogo → import/export) y documentar qué piezas dependen del evento. Salida: matriz de dependencias 3×3.
- **B2 — Golden path end-to-end**: un test/instrumentación que valida un solve 3×3 completo (inspección con penaltis, scramble verificado, stats correctas, análisis CFOP) sobre la fundación de la Fase A.
- **B3 — Documentar el modelo mental**: notación, estado (54 stickers/20 piezas), solvers, métodos — como referencia para diseñar specs de otros eventos.

**Deliverables**: Matriz de dependencias, golden-path test, doc de referencia del modelo 3×3.
**Exit Criteria**: El golden-path test pasa sobre la Fase A; la matriz lista cada punto de acoplamiento a evento en el código.
**Risks**: Descubrir acoplamientos ocultos (p. ej. asunciones de 3×3 en stats o widgets).

---

## 5. FASE C — Paridad 2×2

**Goal**: Decidir, con evidencia, si 2×2 está al mismo nivel que 3×3 y cerrar la brecha.

**Motivation**: El usuario pide "repasar si 2×2 está igual o se ha quedado atrás" tras construir la parte genérica.

**Scope**:
- **C1 — Auditoría de paridad 2×2 vs 3×3** (usar la matriz de la investigación §13 como checklist):
  - Igual: scrambles random-state, stats, sesiones, catálogo Ortega ✅
  - Atrás: **análisis por solve** (PhaseSplitter/Metrics son CFOP/Roux de 3×3 — 2×2 no tiene análisis de fases), **reconocimiento de casos desde solves** (no existe para nadie aún, ver Fase D), seeds CLL/EG (vacíos, investigación §12.4), import/export específico, metrónomo/lookahead.
- **C2 — Cerrar la brecha decidida en C1** (ordenar por valor/esfuerzo; candidatos: sembrar CLL/EG, análisis mínimo de 2×2 por capas).
- *Excluye*: convertir 2×2 en un "mini-3×3" con análisis CFOP — 2×2 tiene su propio modelo (capas, métodos Ortega/CLL/EG).

**Deliverables**: Informe de paridad + items cerrados.
**Exit Criteria**: La matriz 2×2 vs 3×3 no tiene ❌ sin un dueño y una fase asignada.
**Risks**: Sobre-invertir en análisis 2×2 cuando el valor percibido es bajo.

---

## 6. FASE D — Estudio e implementación evento a evento (genérico primero)

**Goal**: Incorporar eventos de forma incremental, cada uno como una declaración sobre la fundación, con un estudio individual de su scramble y sus reglas.

**Método por evento (checklist obligatorio antes de implementar):**
1. **Scramble oficial**: ¿cómo genera la WCA el scramble de este evento? (random-state vs random-move, librería de referencia, mínimo de movimientos).
2. **Reglas**: inspección (sí/no), penaltis, formato (Ao5/Bo3/Bo1/mo3), límites (MBLD 1h, FMC 60min).
3. **Análisis aplicable**: ¿tiene sentido el análisis de fases? ¿qué métodos? ¿reconocimiento por caso?
4. **Catálogo**: métodos/subsets a sembrar.
5. **Datos**: `puzzle_type` canónico, migración si hay datos previos.
6. **Tests**: verificación de scramble + reglas + stats.

**Orden propuesto (cada uno desbloquea el siguiente; justificación):**

| # | Evento | Esfuerzo | Notas |
|---|---|---|---|
| D1 | **3×3 OH** | Bajo | Mismo scramble/reglas que 3×3; solo `puzzle_type` propio + filtros. Desbloquea la migración de datos mezclados |
| D2 | **Pyraminx** | Medio | **✅ hecho** — port manual del scrambler oficial (ver `Fase-D2-Pyraminx.md`) |
| D3 | **Skewb** | Medio | Ídem |
| D4 | **Square-1** | Medio | Reglas estándar; scramble random-state más complejo (forma) |
| D5 | **4×4 / 5×5** | Medio-Alto | Random-state vía solver de gran orden (coste de tablas) |
| D6 | **6×6 / 7×7** | Alto | Ídem, mayor coste; candidatos a cambios WCA futuros (ver contexto) |
| D7 | **Megaminx** | Alto | Geometría distinta; scramble random-state |
| D8 | **3BLD / 4BLD / 5BLD** | Medio-Alto | Sin inspección; formato Bo3; análisis limitado; 4/5BLD "quiet events" |
| D9 | **MBLD** | Alto | Reglas especiales (puntos, límite 1h, memo sin límite) — extiende el spec |
| D10 | **FMC** | Alto | Sin inspección; mo3; 60min; sin análisis de tiempo tradicional |
| D11 | **Clock** | Decisión | **Saliendo de WCA en 2027** — decidir si se implementa (riesgo de esfuerzo muerto) |
| D12 | **FTO** | Medio-Alto | Nuevo evento oficial desde 2-ene-2027; primer evento con geometría octaédrica |

**Dependencia global**: D1–D12 dependen de la Fase A (registry + provider + reglas). D2 se resolvió con port manual (estudio en `Fase-D2-Pyraminx.md`); D3/D4 (Skewb, Square-1) son viables igualmente con port manual (estados pequeños). **D5–D7 (4×4–7×7, Megaminx) dependen del RFC de la librería de scrambles** (ver §8): el coste de tablas de gran orden hace inviable el port a mano.

**Definición de Done por evento** (aplica a cada D#):
1. Selector real con el evento (sin falsa apariencia).
2. Scramble correcto verificado contra el estándar (test).
3. Reglas correctas (perfil WCA declarado y testeado).
4. Stats válidas (sesión y medias funcionan).
5. Análisis/catálogo si aplica (según checklist).
6. Tests de migración si hay datos previos.
7. Documentación del evento en el registro actualizada.

---

## 7. Progreso y métricas

- **Fases A1–A6 ✅** (registro, DB validada + ADR-002, tipos SSoT, providers, reglas por evento, selector data-driven).
- **Fase B ✅** (B1 matriz de cobertura en `Fase-B1-Cobertura-3x3.md`; B2 golden path en `apps/web/tests/integration/goldenPath.3x3.test.ts`; B3 modelo mental en `Fase-B3-Modelo-3x3.md`). Conclusión: el único acoplamiento real a 3×3 es el análisis por solve; el resto de la fundación ya es genérica.
- **Fase C1 ✅** (informe de paridad en `Fase-C1-Paridad-2x2-vs-3x3.md`): 2×2 está al nivel de 3×3 en 8/12 dimensiones; brechas con dueño — **G1 seeds CLL/EG (126 casos) → C2**, **G2 análisis 2×2 por capas → C2**, G4 reconocimiento desde solves → Fase D.
- **Decisión de alcance D (2026-08)**: los eventos de la Fase D se implementan **sin análisis ni catálogo por ahora** (requieren investigación) — solo **scramble + playabilidad** (timer, sesiones, stats, import/export). El registro ya lo refleja (`analysis: NONE_ANALYSIS`, sin seeds).
- **Fase D1 ✅ — 3×3 OH usable end-to-end**: scramble real (reusa provider 3×3), selector ✅, solves/sesiones como `'333oh'` (nunca mezclados con 3×3), stats separadas (`byPuzzle`/filtros), import csTimer `'333oh'` → `'333oh'` (bug corregido), label UI "3×3 OH" (SSoT). Tests: `ohEvent.test.ts` + extensión del golden path con insert OH en el motor real.
- **Fase D2 ✅ — Pyraminx jugable con scramble oficial manual**: estudio del paisaje (tnoodle GPL / cubing.js MIT / random-move) en `Fase-D2-Pyraminx.md`; scrambler random-state (933.120 estados, God 11, 11 movs + tips, filtro distancia ≥ 6) en `@cubalyze/solver-engine` con transposition set (1 ms/scramble, peor caso 21 ms); verificado contra la tabla de Jaap (BFS completo) + 1.000 scrambles; provider `pyraminx-random-state` registrado y Pyraminx aparece como **jugable** en el selector (fin del ghost). Bugs reales encontrados y corregidos: RNG default que no escalaba por n, y transposition set para acotar la búsqueda exacta-11. **Licencia: libre de GPL** — la versión inicial (port directo de TNoodle) fue sustituida por una implementación **clean-room** desde la especificación pública (`Fase-D2-Pyraminx-Cleanroom.md`): nomenclatura y estructura propias, factorádico con arrays, sin código derivado de terceros; validada por la misma suite de aceptación.
- **Matriz de cobertura** (investigación §13.6): de 6 ❌ en "Puzzles y eventos" a 0 ❌ para los 17 eventos (y FTO en 2027).
- **Definición de Done por fase** del Master Roadmap §9 (testeado, mergeado, revisado).
- Cada fase genera su **TDD** (docs/05-tdd) antes de implementar, según el ciclo del Master Roadmap §10.

---

## 8. Decisiones pendientes (requieren RFC/ADR)

| Decisión | Opciones | Urgencia |
|---|---|---|
| Ubicación del Event Registry | `packages/types` vs nuevo `packages/events` | Antes de A1 |
| Librería de scrambles por evento | **Port manual** (D2 validó la plantilla para estados pequeños: Pyraminx, Skewb, Square-1) vs **integrar cubing.js (MIT)** para los grandes (4×4–7×7, Megaminx) | **Antes de D5** (D3/D4 no lo necesitan) |
| Política de migración de solves OH mezclados | Separar por sesión/flag vs dejar como está documentado | En A2 |
| Destino de Clock | Implementar, marcar "próximamente", o descartar (sale de WCA 2027) | En D11 |
| FTO | Preparar spec en el registro ya (2-ene-2027) | Al finalizar Fase A |

---

## 9. Fuentes

- [Master Roadmap](./Master_Roadmap.md) — formato y gobernanza de fases.
- [Investigación del ecosistema (2026-08)](../00-product/Ecosistema_Cubing_Investigacion_2026-08.md) — §12.3 puzzles fantasma, §12.4 subsets vacíos, §13 matriz de cobertura.
- [Auditoría de producto (2026-08)](../00-product/Auditoria_Producto_2026-08.md) — checklist de entrenamiento y cobertura.
- [PRD Partes 0.3.3, 4.2, 7, 8](../00-product/PRD.md) — scrambles, solvers, análisis.
- [Decisión WCA junio 2026](https://www.worldcubeassociation.org/posts/changes-to-the-wca-s-list-of-official-events-june-2026) — FTO entra, Clock sale.
