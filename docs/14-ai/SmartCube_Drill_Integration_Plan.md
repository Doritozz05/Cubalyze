# Smart Cube Integration Plan — Drill Mode

## Objetivo

Que el drill mode funcione **exactamente igual que el timer de práctica** cuando hay un smart cube conectado:

1. El usuario ve el setup scramble
2. Ejecuta el setup en el cubo físico
3. El sistema detecta que el cubo está "scrambled" (coincide con el setup)
4. Auto-arma el timer (`READY_FOR_MOVE`)
5. El **primer move** del usuario arranca el timer
6. Cuando el cubo está resuelto (facelets == solved), para el timer
7. **Sin inspección**, incluso si está activada en preferencias

## Diferencias clave vs Practice Timer

| Aspecto | Practice Timer | Drill Smart Cube |
|---------|---------------|-----------------|
| Scramble source | `RandomStateGenerator` | `generateRandomSetup()` (min2phase) |
| Inspección | Según preferencias | **NUNCA** (siempre `false`) |
| Al parar | Guarda solve en DB | Muestra veredicto (correct/incorrect) |
| Al resolver | Genera nuevo scramble | Va al siguiente caso + nuevo setup |
| Modo manual | Space = hold-to-arm | Space = hold-to-arm (ya funciona) |

## Arquitectura

### Lo que YA existe y podemos reutilizar:

1. **`globalCubeAdapter`** (`@/components/Hardware/CubeConnector`)
   - `.moves$` — Observable de movimientos BLE
   - `.facelets$` — Observable de facelets (estado absoluto del cubo)
   - `.isConnected` — Si hay cubo conectado
   - `.connectionStatus$` — Cambios de conexión

2. **`useScrambleValidator`** (`@/hooks/useScrambleValidator`)
   - Toma un scramble string y verifica si los moves del cubo coinciden
   - `validation.isScrambled` → true cuando el cubo físico coincide con el scramble
   - `validation.states` → estado de cada token del scramble
   - Ya se usa en `useSolveSession`

3. **`TimerEngine`** (ya en uso en `useDrillTimer`)
   - `.arm()` → IDLE → READY_FOR_MOVE
   - `.handleSmartCubeStart()` → INSPECTION/READY_FOR_MOVE → RUNNING
   - `.handleSmartCubeStop()` → RUNNING → COOLDOWN → STOPPED
   - `.state$` → observable de cambios de estado

### Lo que hay que crear/modificar:

#### 1. Nuevo hook: `useDrillSmartCube(engine, setupScramble)`

```
apps/web/src/hooks/useDrillSmartCube.ts
```

Este hook se encarga de:
- Suscribirse a `globalCubeAdapter.moves$` y `facelets$`
- Usar `useScrambleValidator(setupScramble)` para verificar el scramble
- Cuando `isScrambled` → llamar `engine.arm()`
- En `READY_FOR_MOVE` + primer move → llamar `engine.handleSmartCubeStart()`
- Facelets solved en RUNNING → llamar `engine.handleSmartCubeStop()`
- Ignorar inspección (ni siquiera arrancar el timer de inspección)

**API propuesta:**

```typescript
interface UseDrillSmartCubeOptions {
  engine: TimerEngine;          // el engine de useDrillTimer
  setupScramble: string;        // el setup generado aleatoriamente
  enabled: boolean;             // solo activo si smartCubeMode === true
}

interface UseDrillSmartCubeResult {
  isScrambled: boolean;
  isVerifying: boolean;
}
```

#### 2. Modificar `useDrillTimer`

Añadir soporte para smart cube:
- Exponer el `engine` (ya se expone en algunos casos)
- El hook no debe arrancar inspección NUNCA

#### 3. Modificar `AlgorithmDrillView`

- Pasar `smartCubeMode` y `currentSetup` al nuevo hook
- Cuando `smartCubeMode === true`:
  - No mostrar "press & hold to start" (el cubo arranca solo)
  - Mostrar estado de verificación: "Execute the setup...", "Ready — make a move!", etc.
- El `hintCtx` debe reflejar el estado real:
  ```ts
  smartCube: smartCubeMode,
  scrambleVerif: smartCubeMode,  // activar verificación en smart cube mode
  inspection: false,              // NUNCA
  isScrambled: validation.isScrambled,
  ```

## Flujo completo (Smart Cube Mode)

```
1. Usuario selecciona caso → generateRandomSetup() → currentSetup = "R U2 F' L..."
2. Usuario hace los moves del setup en el cubo físico
3. useScrambleValidator detecta que el cubo coincide con currentSetup
   → isScrambled = true
4. Efecto: engine.arm() → estado = READY_FOR_MOVE
5. TimerDisplay muestra: "make a move to start"
6. Usuario empieza a ejecutar el algoritmo
   → Primer move BLE detectado
7. Efecto: engine.handleSmartCubeStart() → RUNNING
8. Timer corre mientras usuario ejecuta el algoritmo
9. Facelets del cubo == solved → engine.handleSmartCubeStop()
10. Timer para → showVerdict = true
11. Usuario pulsa Correct/Incorrect → recordAttempt + next case
```

## Plan de implementación (pasos)

### Paso 1: Crear `useDrillSmartCube.ts`

- Suscribirse a `globalCubeAdapter.moves$` y `facelets$`
- Usar `useScrambleValidator` con `currentSetup`
- Lógica de auto-arm + smart start/stop
- Sin inspección (ignorar `inspectionPref`)
- Cleanup al desmontar

### Paso 2: Modificar `useDrillTimer` para smart cube

- Añadir `engine` expuesto al resultado
- Asegurar que `handleDown` NO arranca inspección (ya lo hace con `useInspection: false`)

### Paso 3: Integrar en `AlgorithmDrillView`

- Llamar `useDrillSmartCube` cuando `smartCubeMode === true`
- Actualizar `drillHintCtx` con valores reales de smart cube
- Mostrar feedback visual durante la verificación
- El TimerContainer se comporta igual (recibe phase, press, release)
  - En smart cube mode, el timer arranca/para solo vía BLE
  - El espacio NO debería afectar al timer en smart cube mode

### Paso 4: Manejar edge cases

- **Cubo desconectado durante el drill**: Mostrar toast/aviso, volver a modo manual
- **Setup muy largo**: El validador de scramble puede tardar. Mostrar progreso.
- **Usuario resuelve sin pasar por el caso**: Si facelets == solved pero no se detectó el caso, ignorar
- **Desconexión BLE**: Limpiar suscripciones, mostrar estado "Disconnected"

### Paso 5: Typecheck + test

## Riesgos / Consideraciones

1. **El `useScrambleValidator` actual depende de `scrambleVerificationPref`**: Hay que asegurarse de que funcione aunque la preferencia global esté desactivada.

2. **Race condition**: Entre `isScrambled=true` y `engine.arm()`, puede llegar un move BLE. `useSolveSession` ya maneja esto con `pendingMovesBufferRef`. Habría que replicar esa lógica o abstraerla.

3. **Complejidad**: `useSolveSession` tiene ~1000 líneas de lógica BLE. No conviene duplicar. Idealmente, se debería **abstraer la lógica BLE común** en un hook compartido. Pero para esta iteración, podemos hacer una versión simplificada en `useDrillSmartCube`.

4. **Alternativa más simple**: En lugar de crear `useDrillSmartCube` desde cero, ¿se podría reutilizar `useSolveSession` directamente? El problema es que `useSolveSession` está acoplado a:
   - `preferencesStore` (inspección, scramble verification)
   - `orientationStore`
   - `onSolve` callback (persistencia en DB)
   - Análisis de fases (CFOP metrics)
   
   Para drill mode, no queremos NADA de eso. La opción más limpia es un hook separado y ligero.

## Estimación

~200-300 líneas de código nuevo + ~50 líneas de cambios en archivos existentes.
Tiempo: ~2-3 horas de implementación + testing.
