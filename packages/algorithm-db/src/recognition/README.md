# Case Detection (reconocimiento modular de casos)

Detector profesional y modular de casos algorítmicos. Hoy reconoce
**Basic F2L (41 casos) + Advanced F2L (BirdF2L, 19 firmas nuevas)** en
reconstrucciones 3×3 CFOP y en el trainer infinite-f2l, y está diseñado
desde el principio para expandirse a *cualquier* método, subset o puzzle:
OLL, PLL, COLL, 2×2 (Ortega…), Pyraminx, etc.

## Arquitectura

```
packages/algorithm-db/src/recognition/
├── types.ts            — interfaces puzzle-/method-/subset-agnostic
├── pairSignature.ts    — firma RELACIONAL del par (colores, no orientaciones)
├── slotResolver.ts     — crossFace + slot → piezas por COLOR + rotación frame→ancla D
├── crossFaceAdapter.ts — rotaciones D↔crossFace (solo build del catálogo) + recolor
├── caseCatalog.ts      — catálogo indexado: "crossFace|firma" → CatalogEntry
├── caseDetector.ts     — motor: estado @corte → piezas por color → firma → lookup (O(1))
├── loaders/
│   ├── basicF2L.ts     — wiring de Basic F2L (41 casos)
│   └── advancedF2L.ts  — wiring de Advanced F2L (126 patrones BirdF2L) + createF2LDetector (ambos)
└── __tests__/          — unit tests (firma, catálogo 41×6×4, matriz de slots, loader avanzado)
```

### El modelo (validado empíricamente)

La detección es **relacional y agnóstica de slot y de piezas** — exactamente
lo que se ve sobre el cubo: dos piezas del par se identifican **por sus
colores**, estén donde estén, y el caso se decide por la **relación de
colores entre esquina y arista**, no por posiciones ni por bits de
orientación relativos a la pieza.

1. **Piezas por color** (`resolveSlotPiecesByColor`): el slot define un
   trío de colores — `{colorDeCross, sideA, sideB}` para la esquina y
   `{sideA, sideB}` para la arista (leídos de las caras del slot en el
   estado recoloreado). La esquina y la arista con esas etiquetas se
   buscan **en cualquier posición del estado**. Una esquina aparcada en
   un slot vecino (el caso 2388: par BR con su esquina en DBL/DFR)
   sigue resolviendo a SU par. Funciona para cualquier color de cross:
   'D' (D-cross), 'U' (U-cross), 'R' (R-cross)…
2. **Firma relacional** (`pairSignature`): `posCorner|crossFace+sides|
   posEdge|labels`, donde `labels` registra qué sticker de la esquina
   casa con cada sticker de la arista (por igualdad de color). Es
   simétrica bajo el intercambio de los colores laterales: el espejo del
   Pb (la esquina aparcada con twist contrario) colapsa en Pb por
   construcción. La distinción Pb/Pi sale de la propia firma (los
   frontales coinciden ⟺ no conecta tras el up move ⟺ Pb), sin lógica
   posterior. Minimizada sobre las **16 rotaciones** `{id,y,y2,y'} ×
   {id,U,U2,U'}` → invariante a slot y a AUF. **41 firmas distintas, 0
   colisiones** (validado en `__tests__/pairSignature.test.ts`).
3. **Las 6 caras de cross**: la rotación slot→ancla es la composición de
   la rotación de frame al D-cross (`CROSS_TO_D`) con el offset de slot.
   La firma ya minimiza sobre y × AUF, así que cada frame necesita una
   única rotación canónica: D → `''`; U → `x2` (los slots de U mapean
   biyectivamente a los de D); F → `x'`; B → `x`; R → `z`; L → `z'`.
   Tras la rotación, la cara de cross queda SIEMPRE en la posición 'D'
   del ancla, y la firma registra el sticker de cross por su **posición**
   (cara), no por su letra de color — por eso un cross rojo (R-cross,
   scheme identidad) y un cross blanco (D-cross) con el mismo arreglo
   relativo producen la misma firma. Validado: 41 casos × 6 caras × 4
   slots (984 combinaciones) + la matriz 1664 de slots/D-rotaciones.
4. **El par manda**: la comparación contra el estado completo falla
   (otros pares sin resolver ensucian la firma); la firma del par
   sobrevive (validado en los POC).

### Integración en el pipeline

`analyzeSolveText` (analysis-engine) añade `detectedCase` a cada
`F2LPairResult`:

```
segmentF2LPairs → por cada par: estado @ corte (índice completionIndex - len + 1)
  → recolor con el scheme del solver → detector.detect(state, crossFace, slot)
  → piezas por color → rotación frame→ancla → firma → lookup O(1)
  → { caseNumber, caseName, confidence }
```

- Se detectan los pares con slot real de **cualquier cross face**
  (`FR/BR/BL/FL` para D/U, `UR/UL/DR/DL` para F/B, `UF/UB/DF/DB` para
  R/L).
- El pipeline de análisis usa el catálogo Básico (41): pares fuera de él
  (configuraciones avanzadas) devuelven `detectedCase: undefined` — la
  firma no casa con ninguna clave. El trainer infinite-f2l usa el detector
  combinado (`createF2LDetector`), que cubre el 100% del espacio de
  configuraciones de par (ver sección Advanced F2L).
- La detección **nunca rompe la reconstrucción** (try/catch defensivo).
- UI: `OurDetectionPanel` muestra `caseName` + `caseNumber` en la
  columna "Case" de cada par.

### El contrato anclado por piezas (seis frames + AUF)

El motor reconoce el caso del CUBO, no del frame: la firma relacional sola
no es invariante bajo la rotación física de la cámara (x2 no pertenece a la
órbita interna y×U — sus conjugados aterrizan como giros-D en el ancla, y
barrer esa órbita destruye la discriminación: colisiones medidas como
`F2L 5+U ≡ F2L 21`). La verificación anclada por piezas cierra el hueco con
un contrato explícito (`detectWith`):

- `pieces` — las piezas físicas del par (la instancia ancla 4/8 en el
  catálogo D-cross; cualquier consumidor que inyecte/rastree su par pasa las
  suyas). La firma se calcula sobre ESAS piezas, sin resolución por color.
- `auf` — el AUF del solver en su notación ('U'/'U2'/"U'"); el probe lo
  deshace conjugado en el espacio de letras antes de firmar.

Con piezas+auf el detector es 984/984 (41 casos × 6 frames × 4 AUF,
validado en `__tests__/pieceAnchorMatrix.test.ts`) y 246/246 canónico.
Sin piezas, el camino de frame (resolución por color, producción) se
ejecuta primero — cero cambios de comportamiento para entradas
scheme-consistentes (pipeline con recolor) — y el fallback ancla
(`anchorSignature`, la lectura de la instancia ancla tras normalizar al
D-cross) rescata los casos que el camino de frame no resuelve.

**El fallback ancla solo se ejecuta SIN `pieces`**: cuando el caller pasa
las piezas del par (el trainer inyecta por pieza ID), el camino de frame
ya es la lectura del par, y la instancia ancla es OTRO conjunto de piezas
(las 4/8 del slot FR D-cross) — caer en ella respondería sobre el par
equivocado. Medido: un par FL spawnado fuera del catálogo se etiquetaba
con el caso de las piezas FR (F2L 28) en vez de `undefined`. Con el guard,
la anotación del motor es determinista por configuración del par (paridad
reproducible desde `startFacelets`). Los F/B/R/L con AUF sin piezas+auf
quedan en el límite informativo (los giros-D en el ancla son casos D-cross
distintos): la única vía limpia es el contrato, no el barrido.

## Cómo añadir un subset nuevo (OLL, PLL, Advanced F2L…)

El patrón es siempre el mismo — **cero cambios en el motor**:

1. Crea un loader nuevo en `loaders/` (copia `basicF2L.ts`):
   - un `SubsetManifest` con `methodId`, `subsetId`, `label`,
     `crossFaces` (ej. `['D', 'U']`);
   - un `loadCases(subsetId, crossFace) → CaseSeedData[]` que devuelva
     `{ caseNumber, caseName, setupScramble }` del seed correspondiente.
2. Crea el detector con `CaseDetector.create([manifest], loadCases)`,
   o compón varios manifests: `CaseDetector.create([f2l, oll, pll], loadAll)`.

El catálogo es subset-agnóstico: `buildCatalog` genera el estado de cada
setup con `CaseStateGenerator` (siempre D-cross, color de cross 'D'),
computa la firma del par (4, 8) y lo indexa bajo `"crossFace|firma"`.

### Advanced F2L (loader + cobertura completa)

`loaders/advancedF2L.ts` sigue el patrón de `basicF2L.ts`: un manifest
(6 cross faces, mismo probe `f2l-slot`) + `loadAdvancedF2LCases` sobre los
126 patrones BirdF2L del seed. `createF2LDetector()` compone ambos subsets
con **Basic primero**: `buildCatalog` conserva la primera entrada por
`(crossFace, firma)`, así que los 17 patrones BirdF2L cuya firma relacional
colapsa sobre un caso básico conservan su etiqueta canónica "F2L n" y solo
las 19 firmas genuinamente nuevas amplían el catálogo (medido: 41 + 19 =
60 firmas por cara de cross; ver `loaders/__tests__/advancedF2L.test.ts`).

La firma relacional (minimizada sobre y × AUF) convierte las 126 setups
(24 pares de posiciones esquina/arista × 6 orientaciones) en 36 firmas
únicas — los espejos/inversos de BirdF2L colapsan por diseño. Y el
resultado clave, validado de forma exhaustiva en
`apps/web/.../f2lDetectionCoverage.test.ts`: **las 60 firmas cubren el
100% del espacio de configuraciones de un par** (383 configuraciones
posición×orientación × 6 colores de cross = 2298/2298 detectadas, 0
undefined). Antes del loader, ~20% de los spawns aleatorios del trainer
quedaban sin etiqueta; ahora ninguno — cada par inyectado responde un caso
(exacto), con paridad reproducible desde `startFacelets`.
### Notas por puzzle

- **2×2**: el concepto de "par" no aplica — se detectará sobre el estado
  completo (o sobre el subset correspondiente) con el mismo motor:
  `detect(state, crossFace, '')` + firma del estado en vez del par.
  `slotToFRRotation` devolvería `''` (identity).
- **Pyraminx / otros**: añadir tablas de resolución de piezas en
  `slotResolver.ts` (o su equivalente) y manifests propios. Los tipos
  (`types.ts`) ya son puzzle-agnostic.

## Verificación

```bash
cd packages/algorithm-db
pnpm vitest run src/recognition   # firma + catálogo + detector (41×6×4)

cd packages/analysis-engine
pnpm vitest run src/__tests__/case-detection.test.ts  # end-to-end en solves reales
```

Solves reales cubiertos por los tests de integración:
- **2388 (cross D, con pop)**: BR → **Pb**, BL → **Ki**, FR → **Pb**,
  FL → **Pb**. El bug original: los pares 1 y 4 (esquina aparcada en
  slot ajeno) salían Pi con la firma posicional; la firma relacional los
  lee como Pb (los frontales coinciden).
- **2510 (cross U)**: BL → **Pj**, FR → **Jm**, BR → **Jb**, FL →
  **Ci** — los cuatro coinciden con las anotaciones humanas (antes solo
  se detectaba el primero, y mal: Jj en vez de Pj, porque la rotación
  `y2` no mapeaba el frame U-cross al catálogo D-cross; el mapeo
  correcto es `x2`).
- **8521 (cross R, cross rojo)**: UF → **Jb**, UB → **Mb**, DB →
  **Ji** — verificados contra el arreglo completo de stickers de los 41
  seeds bajo rotaciones que preservan la cara de cross. Antes salían
  Mm/Jb/Mc por artefactos de la firma posicional.
