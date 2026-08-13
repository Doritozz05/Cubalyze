# Estudio avanzado — Pipeline de análisis F2L/frame y plan de mejora

**Fecha:** Agosto 2026
**Contexto:** diagnóstico de un solve BLE real (26.42s, CFOP, 87 movimientos compactados) y comparación entre lo que el pipeline calcula, lo que la UI muestra en la ruta smart-cube y lo que la ruta de reconstrucción por texto ya muestra.
**Método:** lectura del código + replicación empírica del solve ejecutando `analyzeSolve` sobre los 94 movimientos BLE.

---

## 1. Hallazgo principal: el problema de este solve no es F2L, es el frame/orientación

La evidencia del solve es contundente:

| Señal | Valor | Interpretación |
|---|---|---|
| Movimientos en cara D | **39/94 (41%)** | Un solve CFOP real concentra movimientos en R/U/L/F; D solo en la cruz y algún regrip. 41% en D es imposible sin una rotación de frame. |
| Rotaciones | **21 (x:11, y:7, z:3), ~6.3s estimadas** | 11 rotaciones en el eje x (volteos) y 24% del tiempo "rotando" no es un solve normal. |
| Cruz | **13–15 movimientos, `crossColor: U`, `plain`** | El detector encontró una cruz de 13+ movimientos en la cara U. Una cruz competente son ≤8 movimientos en ~2s. |
| Cross efficiency | 0.62 (8/13) | Directamente inflada por el punto anterior. |
| Confianza | `high`, `warnings: []` | **El sistema no detecta que el frame es sospechoso** y presenta la cruz/timing como si fueran correctos. |

**Conclusión profesional (regla "garbage in, garbage out"):** antes de añadir reconocimiento por par o sub-segmentar la timeline, hay que validar el **frame**. La pipeline ya corre completa y produce datos estructuralmente correctos *dado el frame que tiene*; el problema es que el frame está rotado ~90° respecto al del solver (posiblemente por deriva/ruido del giroscopio del GAN o por la recuperación P2). Todo lo que deriva de ahí — cross de 15 movimientos, TPS por fase, eficiencia de cruz — queda distorsionado y **sin advertencia**.

### Hipótesis a verificar (en orden de probabilidad)

1. **Ruido/deriva del giroscopio del cubo** (el GAN entrega orientación IMU; si se descalibra, cada giro se lee como rotación x/y/z). Coherente con `x:11`.
2. **Recuperación P2** eligiendo una orientación canónica distinta de la del solver (el solve está en un frame distinto al scramble).
3. El usuario realmente girando mucho (improbable: 21 rotaciones).

**Acción recomendada:** diagnóstico dedicado que compare la orientación reportada por el giroscopio con la orientación inferida de los movimientos (conjugación) y añada un **"frame sanity check"** que degrade la confianza a `low/medium` y muestre una advertencia cuando: rotaciones > umbral (p.ej. 15), una cara domina >~30% de los movimientos, o la cruz sale con >8 movimientos. Igual que ya se hace con `non-monotonic-timestamps`, hay que tratar el frame sospechoso como un *warning* explícito.

---

## 2. Qué calcula ya el pipeline y qué no se muestra (el gap real)

Replicando el solve se confirma que la ruta smart-cube **sí ejecuta el pipeline completo** (no es que "no se aproveche" a nivel de datos):

| Dato | ¿Se calcula? | ¿Se muestra en la UI smart? |
|---|---|---|
| Fases Cross/F2L/OLL/PLL | ✅ | ✅ (bloques) |
| `crossType` / `xcrossPairs` / skips | ✅ | 🟡 badge solo si ≠ plain; sin detalle de qué par va en el cross |
| 4 pares F2L (slot, colors, moves, auf, timeMs, tps, `pauseBeforeMs`) | ✅ | 🟡 lista separada; la timeline no los dibuja |
| OLL/PLL recognition + execution | ✅ | ✅ |
| Eficiencia vs óptimo (Min2Phase) | ✅ | ✅ (`Efficiency 4.14 · opt=21m`) |
| Rotaciones, redundancias, lookahead | ✅ | ✅ |

El gap es **de presentación y de consistencia**, no de cálculo:

1. **La timeline dibuja F2L como un único bloque verde.** La segmentación por pares existe (`segmentF2LPairs` da `startIndex`/`endIndex` por par) pero `deriveTimeline` agrupa por fase, no por par. Es exactamente lo que intuyes: hay que **subdividir el bloque verde de F2L en 4 sub-segmentos** (manteniendo el matiz F2L, con tonos por par) y dibujar los huecos de reconocimiento entre pares, igual que la tabla de reconstrucción por texto ya hace por filas.

2. **Numeración de pares inconsistente con xcross.** En la ruta smart, `pairNumber = pairs.length + 1` (siempre 1-based sobre los pares *detectados*). En la ruta de texto, `OurDetectionPanel` usa `crossPairCount + i + 1`. Resultado: con un XCross la ruta smart diría "Pair 1,2,3" cuando en realidad son los pares 2,3,4; con un XXXCross saldría un único "Pair 1" (el 4º). **Bug real de coherencia entre rutas** — el comentario del propio `OurDetectionPanel` documenta el comportamiento correcto que la smart route no replica.

3. **No hay split reconocimiento/ejecución por par.** `pauseBeforeMs` es prácticamente el reconocimiento del par (hueco entre el último movimiento del par anterior y el primero de este), pero (a) se muestra como "+0.44" sin etiqueta, (b) no resta el tiempo de ejecución del turno de borde (~100ms, como ya hace `PauseDetector`), y (c) el par 1 se fuerza a 0. Los datos necesarios ya existen.

4. **La cruz de >8 movimientos no dispara ninguna señal.** `crossEfficiency` la muestra (0.62) pero no hay diagnóstico ("cruz de 13 movimientos: plan de inspección o frame incorrecto").

---

## 3. Propuesta de mejora (por prioridad)

### P0 — Validar el frame antes de creer al análisis

- `PhaseDetectionWarning` nuevo: `suspicious-frame` (o `excessive-rotations`) cuando `rotation.count > 15` o una cara supera ~30% de los movimientos. Degrada `confidence` a `low` y muestra un banner "orientación no fiable — verifica el giroscopio/regrip".
- Advertir cruz ineficiente: `cross moves > 8` → aviso contextual en la tarjeta Cross ("13 movimientos; óptimo ≤8 — revisa plan de inspección o frame").
- (Investigación) calibrar/filtrar la orientación IMU (bias de giroscopio, como ya se hace con el clock drift) y auditar la recuperación P2 frente a giros reales.

### P1 — Aprovechar los datos de pares que ya existen

- **Split rec/exec por par:** `recognition(pair N) = max(0, pauseBeforeMs − TURN_EXECUTION_MS)`; `execution = timeMs`. Par 1: usar `crossToF2LTransitionMs` como reconocimiento. Mostrar en la tarjeta de cada par: `recog X · exec Y · Z tps`.
- **Subdividir la timeline de F2L en 4 sub-segmentos** usando `startIndex`/`endIndex` de `segmentF2LPairs`, con los huecos de reconocimiento entre pares en color de pausa. Reutilizar la misma paleta de fases (tonos dentro del matiz F2L).
- **Corregir la numeración de pares** con xcross (`crossPairCount + i + 1`) y mostrar en la cabecera "XCross: slot FR ya resuelto en la cruz".

### P2 — Coherencia total entre rutas

- Unificar la *fuente de verdad* de pares y xcross entre `SolveAnalysisPanel` (smart) y `OurDetectionPanel` (texto) para que dejen de divergir en numeración, colores de slot y presentación de xcross/skips.

---

## 4. Réplica del solve (evidencia)

Ejecutado con el pipeline real sobre los 94 movimientos y el scramble `B D' R' F2 D2 U B2 U B2 L2 B2 D2 B2 R2 F L' R F' D' L' U'`:

```
faces:        { R:17, F:2, U:4, L:20, D:39, B:12 }   ← 39 D (41%)
phases:       Cross(15m) → F2L(34m) → OLL(20m) → PLL(25m)
crossType:    plain | crossColor: U | xcrossPairs: none | skips: []
pairs:        FR(6m) · BL(11m) · FL(8m) · BR(9m)
efficiency:   4.476 (94/21) | optimal: 21
ollRecog/Exec: 0.28 / 5.03s · pllRecog/Exec: 0.28 / 6.43s  (timestamps sintéticos → solo ilustrativo)
```

Nota: los timestamps de la réplica son sintéticos (no teníamos los `dt_prev_ms` reales), por lo que **los tiempos/recognition son ilustrativos**; los hechos *estructurales* (fases, cruz, pares, slots, eficiencia, dominancia de D) son deterministas por estado y sí son la réplica real. La diferencia Cross 15m vs 13m con tu log de 87 movimientos son exactamente los 7 duplicados BLE que se eliminan en compactación.

---

## 5. Qué recomiendo hacer ya

1. **Antes de nada, el frame sanity check + advertencia de rotaciones/cruz** (P0): es lo que más valor tiene para este solve concreto y evita "mentir" con un cross de 13 movimientos presentado como válido.
2. **Después, el trío de pares** (rec/exec, sub-segmentos de timeline, numeración xcross) — son cambios de presentación sobre datos ya calculados, bajo riesgo, alto valor percibido.
3. **Dejar para después** el reconocimiento del *caso* F2L (mapear slot+estado al catálogo y comparar con el alg canónico): es el salto diferencial, pero depende de que el frame sea fiable (P0), o el mapeo de caso será erróneo.
