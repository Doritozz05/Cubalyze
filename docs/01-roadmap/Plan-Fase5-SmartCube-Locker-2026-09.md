# Plan — Fase 5: el cubo se identifica solo

> Estado: **plan, sin implementar** (2026-09-12). Rama `feat/cube-collection`.
> Continúa [Plan-Locker-Cubo-Metodo-2026-09.md](./Plan-Locker-Cubo-Metodo-2026-09.md)
> (fases 1–4, hechas y pusheadas) y desarrolla el punto 7.1 de ese documento.
> Alcance: **Fase 5 y solo Fase 5**. No incluye sincronizar el Locker (fase 6),
> la bitácora de setups (fase 7) ni el estante público (fase 8).
>
> Decisiones cerradas con el usuario (2026-09-12): **D1** el vínculo vive en una
> columna nueva `gear_items.smart_id`; **D2** al conectar con una elección
> distinta gana el hardware, con aviso y «deshacer»; **D5** al conectar por
> primera vez el cubo **se da de alta solo** en el Locker y las siguientes
> conexiones autoseleccionan ese cubo (§5.3). Abiertas **D3** (`use3x3As2x2`) y
> **D4** (reconexión automática, §12). Ver §11.
>
> **Actualización (2026-09-12): §12 documenta la investigación sobre reconectar
> sin gesto tras recargar.** Veredicto: en la web **no es viable hoy** (la API
> está detrás de un flag de Chromium); en el escritorio ya ocurre y la Fase 5
> puede volverlo determinista.

---

## 0. Resumen: qué es y qué aporta

Hoy la atribución de un solve a un cubo depende de **un clic tuyo en la pieza
del dock**: si te sientas con el GAN 12 y el dock dice Valk 3, todos los solves
de esa sesión se guardan —con toda la confianza— en el cubo equivocado. Las
stats por cubo de la Fase 4 existen, pero se alimentan de un dato que hay que
recordar cambiar a mano.

La Fase 5 cierra ese agujero usando algo que el hardware **ya dice** en cada
conexión: quién es (nombre de modelo), cuál es (MAC) y qué firmware lleva.
Con eso:

1. **Al conectar, la app sabe qué cubo físico tienes.** Pasas de "elige un cubo
   en un desplegable" a "conecta el cubo y ya está".
2. **El Locker pasa a ser el registro de identidad de tu hardware** (nombre
   comercial, MAC, firmware, batería), no solo un catálogo de fotos. Es lo que
   hace que el armario y el cronómetro sean la misma app y no dos pantallas.
3. **Las stats por cubo se llenan solas**, y con ellas el terreno para la Fase 7
   ("¿mejoré después del cambio de muelle?") queda listo: esa pregunta solo
   tiene sentido si se sabe **que** cubo físico resolvió cada solve.

**Por qué es barata:** el 80 % del trabajo es *exponer* datos que ya están
llegando por BLE y hoy se tiran a la basura. No hay esquema de nube, no hay
migración de datos, no hay nada que sincronizar.

---

## 1. Lo que ya existe (verificado en código, no supuesto)

| Dato | Dónde llega | ¿Se usa? |
|---|---|---|
| `vendor` (`"GAN"`) | `GanCubeAdapter.vendor` (`packages/hardware-hal/src/bluetooth/GanCubeAdapter.ts:24`) | Solo lo pinta Settings |
| `model` (`hardwareName`, p. ej. `GAN12uiM`, `GAN356i3`) | Evento `HARDWARE` → `this.model` (`GanCubeAdapter.ts:187-190`) | Solo lo pinta Settings |
| **MAC** | `extractMAC()` por `watchAdvertisements()` (`packages/gan-protocol/src/gan-smart-cube.ts:32-63`), o `System ID (0x2A23)` como respaldo (`:78-102`), o **escrito a mano** por el usuario (`CubeConnector.tsx:311`) | Solo se usa para derivar la sal de cifrado (`gan-smart-cube.ts:52`). **Nunca llega a la app** |
| `hardwareVersion`, `softwareVersion`, `productDate` | El mismo evento `HARDWARE` (`gan-cube-protocol.ts:125-137`, `:1099-1103`) | **Se descartan** en el `else if (evt.type === 'HARDWARE')` |
| `gyroSupported` | Mismo evento | Sí (orientationStore) |

Y el otro extremo, el del Locker:

| Pieza | Estado |
|---|---|
| `gear_items.serial TEXT` | **Ya existe** (`migrations.ts:1352`), se escribe (`gear.repository.ts:283,416`), se edita (`ItemEditorDialog.tsx:521`) y se muestra como "Serial" (`ItemDetailPanel.tsx:132`) |
| `connectionStore` | Runtime puro, **no se persiste** (`packages/state/src/connection.store.ts`) |
| `activeCubeStore` | `app_meta.active_cube_<evento>`, **estado del dispositivo, nunca sincronizado** (`apps/web/src/stores/activeCubeStore.ts`) |
| `resolveActiveCube` | Pura, con reglas y tests ya hechos (`views/Collection/activeCube.ts`, 17 tests) |
| `startOrientationTracking` | **El patrón a copiar**: servicio headless que se suscribe al adaptador global y sobrevive a las reconexiones (`services/orientationTracking.ts`) |

### 1.1 Dos defectos reales que esta fase arregla de paso

1. **El modelo que ve la UI puede ser el marcador de posición.** `connected` se
   emite en `connect()` **antes** de que el `HARDWARE` responda
   (`GanCubeAdapter.ts:94-102`: se lanza `requestHardware()` sin esperar y dos
   líneas después se anuncia `'connected'`), y `setConnected(vendor, model)` se
   llama en ese instante (`CubeConnector.tsx:63`) con `model = "SmartCube"` (el
   default, `:25`). Cuando el nombre real llega, `onHardwareInfo` **solo alimenta
   `orientationStore`** (`CubeConnector.tsx:48`): `connectionStore.deviceModel`
   se queda en `"SmartCube"` para siempre. O sea: el campo que la Fase 5 necesita
   es hoy un placeholder que nadie corrige.
2. **El MAC es interno del adaptador.** `GanCubeAdapter.device` es `private`
   (`:65`, se asigna en `:77`) y la interfaz `SmartCubeAdapter`
   (`packages/hardware-hal/src/interfaces/SmartCubeAdapter.ts`, 12 líneas: solo
   `vendor`, `model`, `connect(manualMac?)`, `disconnect()` y los observables)
   no expone identidad. El adaptador de escritorio tiene el mismo problema
   (`apps/desktop/src/adapters/GanCubeAdapterTauri.ts:131,177`).

---

## 2. La decisión de producto: dónde vive la identidad

### 2.1 Campo nuevo, no reutilizar `serial`  *(decidido: D1)*

Un cubo puede tener **las dos cosas**: el número de serie impreso por el
fabricante **y** su MAC. Reutilizar `serial` para la identidad de hardware
pierde una de las dos y, peor, la acción automática de "vincular este cubo"
tendría permiso para **sobrescribir un dato que el usuario escribió a mano**.

Decidido: `gear_items.smart_id TEXT` (nueva migración local `036_gear_smart_id`
+ índice), que guarda la identidad **normalizada** del cubo (ver 2.2). Ventajas:

- Es una columna **de una tabla que todavía no sincroniza** (la 034 nació
  "sync-ready" a propósito): añadirla ahora cuesta una migración local y la
  Fase 6 la espeja sin trabajo extra. Después de la 6 costaría una migración de
  nube y un backfill.
- Permite la regla de unicidad que hace determinista la resolución (§5.1):
  **un `smart_id` pertenece a un solo item**.
- La UI puede distinguir "Serial" (impreso) de "Smart cube ID" (MAC), que es lo
  que son.

Coste: una migración + tocar `GearItem`, el repo, el editor y la ficha (~1
columna y 4 puntos de lectura). Alternativa descartada: `serial` sinónimo de
MAC (cero migración, pero pierde el SN impreso y deja el vínculo automático
poder pisar un campo manual).

### 2.2 Normalización del MAC — el detalle que puede morder

`extractMAC()` construye la cadena **leyendo los bytes del final hacia atrás**
(`gan-smart-cube.ts:38-43`):

```ts
for (let i = 1; i <= 6; i++) mac.push(dataView.getUint8(len - i)...)
```

Es decir, la cadena interna (`device.mac`) es **la MAC con los bytes en orden
inverso** al que se imprime habitualmente. Da igual mientras los dos caminos
automáticos (anuncio BLE y `System ID`) produzcan la misma cadena — y lo hacen,
porque ambos recorren los bytes igual — y de hecho el código la vuelve a
invertir para la sal (`:52`). Pero un MAC **escrito a mano** (el fallback de
`CubeConnector.tsx:311`, o el que te enseña la app de GAN) viene en el orden
habitual: si se compara literal, **el vínculo no coincide**.

Regla: `normalizeSmartId(raw)` → mayúsculas, sin separadores, 12 hex; y la
comparación acepta la forma **normal o su inversión de bytes**, porque es
imposible distinguir ambas de forma fiable sin hardware delante. Queda como
tarea **verificar con un cubo real** cuál emite cada camino y, si se confirma,
estrechar la comparación a una sola forma. Se documenta como riesgo abierto
(§8, R1) en vez de fingir que está resuelto.

### 2.3 Catálogo de modelos

`hardwareName` es el nombre **interno** (`'GAN12uiM'`, `'GAN356i3'`). El nombre
comercial ("GAN 12 ui Maglev") y la generación ya están investigados en
`docs/02-architecture/Dynamic_Notation_Orientation_System.md:158-165`. Se
promueve esa tabla a `cubeModelCatalog.ts` (pura, con `model` ausente →
`unknownModel` honesto) y sirve para prellenar el item nuevo (marca "GAN",
modelo comercial). **No** sirve para deducir el evento: el modelo no dice si
estás resolviendo 3×3 o 2×2 — eso lo dice el item vinculado y su tipo.

---

## 3. La arquitectura en una frase

> La identidad del hardware es **una fuente más para la atribución**, no un
> almacén nuevo: al conectar se traduce a "este item del Locker", y a partir de
> ahí **todo sigue pasando por `activeCubeStore`** — el mismo sitio donde ya
> vive la elección manual.

Consecuencias de haberlo diseñado así:

- **Cero cambios en `solves`, en el sync y en la nube.** Ni una migración de
  Supabase, ni un mapper, ni `sync_apply`. El solve sigue guardando
  `cube_id`/`cube_label` como en la Fase 3.
- **Cero cambios en `resolveActiveCube`.** El hardware escribe la elección; las
  reglas (candidatos del evento, `owned`, Main, último usado) se aplican igual.
- La elección sigue siendo **por dispositivo** (D5 del doc anterior), que es
  exactamente lo correcto: qué cubo tienes en la mano es de este aparato.

Flujo completo, en orden:

```
connect() ──► HARDWARE (nombre, hw/sw, productDate) ──┐
        └───► MAC (anuncio | System ID | manual) ─────┤
                                                       ▼
                              identity = {vendor, model, mac, firmware}
                                                       │
                        ┌──────────────────────────────┴─────────────┐
                        ▼                                            ▼
     cadena de cifrado (lo de hoy, intacto)          hardwareLink: buscar item
                                                        con ese normalizeSmartId
                                                       │
                          ┌────────────────────────────┴───────────────────┐
                          ▼                        ▼                       ▼
                  vinculado y candidato    vinculado pero NO        sin vínculo
                  del evento              candidato (vendido,      (o modelo fuera
                          │               otro evento, borrado)    del catálogo)
                          ▼                        ▼                       ▼
              escribe setActive(evento, item)   avisa, no atribuye    ofrece vincular
                  salvo NO_CUBE explícito       ni sobrescribe         o crear el item
```

---

## 4. Cambios por capa

| Capa | Fichero | Qué cambia |
|---|---|---|
| HAL | `packages/hardware-hal/src/interfaces/SmartCubeAdapter.ts` | `identity$?: Observable<CubeIdentity>` opcional (no rompe el contrato ni el adaptador de escritorio, que lo implementará después) |
| HAL | `.../bluetooth/GanCubeAdapter.ts` | Getter `macAddress` (lee `this.device?.mac`), `identitySubject` con `{vendor, model, mac, hardwareVersion, softwareVersion, productDate, gyroSupported}`, y **conservar** los campos del `HARDWARE` que hoy se tiran. `model` deja de ser `"SmartCube"` en cuanto llega el nombre |
| Protocolo | `packages/gan-protocol` | **Nada.** El evento ya trae todo |
| Estado | `packages/state/src/connection.store.ts` | `setConnected(vendor, model)` → `setConnected(vendor, model, mac?)` y un `setHardware(...)` para la corrección post-handshake (arregla §1.1-1 sin romper llamadas) |
| Web (nuevo) | `apps/web/src/services/cubeIdentity.ts` | Servicio headless, **mismo patrón que `orientationTracking.ts`**: se suscribe a `identity$` y a `connectionStatus$`, resuelve el vínculo contra el Locker y publica el estado. Los subjects del adaptador sobreviven a las reconexiones, así que no hay que re-suscribirse |
| Web (nuevo) | `apps/web/src/stores/hardwareLinkStore.ts` | Estado del vínculo para la UI (`unlinked \| linked \| conflict \| unavailable \| unknown-model`), con la acción de vincular/desvincular. Sin persistencia: es estado derivado de la conexión |
| Web (nuevo) | `apps/web/src/views/Collection/cubeModelCatalog.ts` | `hardwareName → {label, generation, gyro}`; `normalizeSmartId()` vive aquí (junto a la identidad, no en el modelo) |
| Web | `apps/web/src/views/Collection/activeCube.ts` | Función pura nueva `resolveHardwareLink(state, identity)` → `{item, event, reason}`. **Las reglas existentes no se tocan** |
| Web | `apps/web/src/views/Collection/collectionModel.ts` + `GearRepository` + `migrations.ts` | `smart_id`, con normalización al escribir |
| Web | `ItemEditorDialog.tsx` / `ItemDetailPanel.tsx` | Campo "Smart cube ID" (con botón "usar el cubo conectado" cuando lo hay) y, en la ficha, la sección de hardware: modelo, firmware, fecha de producción, batería |
| Web | `widgets/dock/pieces/cube/CubePiece.tsx` | Badge "conectado" en el cubo que corresponde al hardware, y el estado de conflicto con **acción de un clic**. Es donde el usuario ve todo esto |
| Web | `components/Settings/sections/SmartCubeSection.tsx` | Fila "Cubo físico": vinculado a *X* + vincular / crear / desvincular |
| Web | `components/Hardware/CubeConnector.tsx` | `onHardwareInfo` pasa a alimentar también `connectionStore` y el servicio de identidad |

---

## 5. Las reglas, en tabla (§5.1) y el comportamiento del solve (§5.2)

### 5.1 `resolveHardwareLink` — pura y testeable

Entrada: el estado del Locker + la identidad del hardware. Salida: un item, o
un motivo por el que **no** hay item.

| Caso | Resultado | Notas |
|---|---|---|
| No hay conexión | `null` / `reason: "disconnected"` | Comportamiento actual, intacto |
| MAC desconocida (sin `System ID`, que es el camino real hoy — §12.3) | `null` / `"no-identity"` | Se puede vincular a mano escribiendo la MAC (el fallback ya existe), pero **no se crea nada**: sin clave no hay forma de no duplicar (§5.3) |
| `smart_id` no está en ningún item | `null` / `"unlinked"` | Se ofrece vincular o crear |
| El item está `sold` / `lent` | `null` / `"not-owned"` | **Coherente con `cubesForEvent`**: un cubo vendido no está en tu mano |
| El item es de otro evento | `null` / `"other-event"` | Nunca se atribuye un 2×2 a un 3×3 |
| El item es candidato del evento activo | `item` | Se usa |
| **Dos items comparten `smart_id`** | `null` / `"ambiguous"` | Estado imposible por diseño (el vínculo lo impide, §5.3); la resolución es defensiva y avisa |

### 5.2 Qué hace la app con eso

| Situación | Qué pasa |
|---|---|
| **Sin elección previa + hardware vinculado** | El servicio escribe `setActive(evento, item)` al conectar. La pieza del dock ya lo muestra: **no hay acción ninguna, y es visible**, no silencioso. A partir de la primera conexión el vínculo **ya existe** (§5.3), así que este es el caso normal, no el excepcional |
| **Elección previa distinta** (ayer Valk, hoy conectas GAN 12) | **Decidido (D2):** se cambia a la del hardware con un **toast y "deshacer"**. La alternativa —no cambiarla nunca— obliga a un clic manual en el caso más frecuente, y la de no avisar sería una mentira silenciosa. Afecta solo al evento del cubo vinculado |
| **`NO_CUBE` elegido a mano** | **Nunca se sobrescribe.** Es una decisión ("no quiero atribuir"), así que la pieza avisa: "conectado GAN 12 · no estás registrando el cubo" + un clic para cambiarlo |
| **El cubo conectado no es candidato** (vendido / otro evento) | Aviso, y **no** se atribuye. Se prefiere un solve sin cubo a uno con el cubo equivocado |
| **Solve `virtual`** | Sin cubo, igual que hoy. El hardware no altera esa regla |
| **Solve manual / importado / stackmat** | Sin cambios: el hardware solo informa la atribución cuando hay una conexión y un vínculo |
| **Conectado pero resolviendo con otro cubo de la mesa** | **Limitación real y honesta:** la app no puede saberlo. Mitigación: la pieza del dock dice qué cubo está atribuyendo, y la acción de un clic está siempre a mano. No se finge detección |
| **`use3x3As2x2` activo** | Un 2×2 se resuelve con las esquinas de un 3×3: el hardware identifica el cubo como 3×3 y `cubesForEvent("222")` lo rechazaría. Decisión propuesta: **seguir sin atribuir** en esta fase y anotarlo (forzarlo exigiría una excepción en las reglas de evento, y la excepción es la puerta por la que se cuelan las mentiras). Se documenta, no se parchea |

### 5.3 El vínculo: se crea solo, y también a mano  *(decidido: D5)*

Decisión del usuario (2026-09-12): **al conectar por primera vez, el cubo se da
de alta automáticamente en el Locker**, y a partir de ahí cada conexión
autoselecciona ese cubo. Sin diálogos previos. Eso convierte al armario en algo
que se llena solo, que es justo lo que hace que la app se sienta viva.

El orden de decisión al conectar, y las condiciones que lo hacen seguro:

1. **¿Hay un item con ese `smart_id`?** Ese es tu cubo. Se autoselecciona para
   el evento de su tipo y se acabó. (Es el caso de todas las conexiones menos la
   primera.)
2. **¿Hay ya un item que *sea* ese cubo pero sin vincular?** Antes de crear
   nada se busca, entre los cubos del evento, un item **sin `smart_id`** cuya
   marca + modelo coincidan con el catálogo. Si hay **exactamente uno**, se
   vincula (con «deshacer»): es el que creaste a mano la semana pasada. Si hay
   **varios**, se ofrece elegir — **no se adivina**. Evita el duplicado feo que
   tendría "crear siempre".
3. **Si no hay ninguno, se crea.** Y se crea sin inventar nada: nombre del
   catálogo (o el `hardwareName` crudo si el modelo es desconocido), marca
   `GAN`, modelo, `smart_id`, estado `owned`, y una **marca visual de que la
   creó la app** (etiqueta "Smart") para poder distinguirla y editarla. Ni
   precio, ni fotos, ni notas.

**Las tres condiciones sin las cuales no se crea nada:**

- **Identidad firme.** Sin MAC (navegador que no la expone y usuario que no la
  escribe) no hay clave, así que **no se crea**: si no, tendrías un item nuevo
  en cada conexión. Se cae al flujo de proponer (§6, caso 6).
- **Un tipo del evento donde colgarlo.** Si el usuario excluyó 3×3 del Locker,
  no hay tipo al que pertenecer, y un item directo bajo la categoría **no es
  candidato a atribución** (regla 3 de `activeCube.ts`): crearlo ahí daría un
  cubo que no puede recibir solves. En ese caso **no se crea ni se adivina**: se
  propone.
- **Base de datos disponible.** El alta va por el repo del Locker, así que
  requiere el store hidratado (si acaba de arrancar y aún no lo está, se espera
  a la hidratación antes de crear).

**Reversible, como todo lo automático (mismo patrón que D2):** aviso «Añadido a
 tu Locker: GAN 12 ui» con **Deshacer**, que borra el item creado **solo si
 sigue intacto** (si ya lo editaste, deshacer no puede llevarse tus cambios).

Y lo demás sigue disponible a mano, para corregir o para el cubo que no se
puede identificar solo:

- Vincular desde la ficha del item ("usar el cubo conectado"), desde el panel de
  conexión ("vincular a…"), o al crear un item nuevo (prellenado: marca `GAN`,
  modelo del catálogo, `smart_id` de la MAC).
- **Un `smart_id` no puede estar en dos items.** Vincular rechaza robar una
  identidad ya asignada y ofrece reasignarla explícitamente (con confirmación),
  nunca en silencio. Test dedicado.
- **Dos cubos del mismo modelo** (dos GAN 12 ui, MACs distintas) son dos items
  legítimos. Para que el dock y el selector puedan distinguirlos, el nombre
  automático añade un sufijo cuando ya existe uno igual (el usuario lo puede
  renombrar después).
- Desvincular solo borra `smart_id`: no toca `serial`, ni las fotos, ni la
  historia de solves (que está congelada en `cube_label` desde la Fase 3).
- `NO_CUBE` elegido a mano **sigue ganando**: el alta automática no resucita una
  decisión de "no quiero atribuir" (§5.2).

---

## 6. Qué cambia para el usuario (pedido explícitamente)

**Antes** (hoy): conectar el cubo es informativo — sale "GAN · SmartCube" en
Ajustes y ya. La atribución es un desplegable en el dock que hay que recordar.

**Después**, recorrido por recorrido:

1. **Primera conexión.** Al conectar, la app dice "He detectado un GAN 12 ui
   (GAN12uiM, firmware 1.2)" y **lo añade sola a tu Locker**, con su modelo y su
   identidad, y ya queda seleccionado para 3×3. Aviso con «Deshacer» por si no
   quieres tenerlo ahí (§5.3). Si ya tenías un "GAN 12 ui" sin vincular, se
   vincula **ese** en vez de crear otro.
2. **Segunda vez.** Conectas y la pieza del dock ya dice GAN 12. No hay nada
   que elegir. Los solves quedan atribuidos solos.
3. **Dos cubos.** Cambias de cubo en la mano y la app lo sigue. Ya no hay que
   acordarse de tocar el dock.
4. **El armario se vuelve útil de verdad.** La ficha del cubo enseña, además de
   sus fotos: modelo, firmware, fecha de producción, batería y **sus solves**
   (lo de la Fase 4, ahora alimentado sin depender de la memoria del usuario).
5. **Cambio de dispositivo (hoy).** El vínculo vive en la fila del item, y el
   Locker es local hasta la Fase 6: en el otro dispositivo hay que **volver a
   vincular** (misma app, mismo cubo, dos clics). El hardware sigue
   identificándose, lo que no viaja todavía es el vínculo. Es el límite honesto
   y desaparece solo cuando el Locker sincronice.
6. **Un cubo que no es GAN o un modelo sin catalogar.** Nada se rompe: se
   muestra el nombre crudo, se ofrece vincular a mano (escribiendo la MAC, que
   ya se puede) y se dice que el modelo es desconocido. Sin invenciones.
7. **Modo manual (stackmat, solves tecleados).** Ni se entera. Cero cambios.

Lo que **gana** el producto, en una línea: hoy las stats por cubo son
"correctas si te acuerdas de elegir"; a partir de la Fase 5 son correctas
porque el hardware lo dice. Y el Locker deja de ser una vitrina para
convertirse en el registro de identidad de tu hardware, que es lo que ninguna
herramienta del ecosistema tiene (csTimer no tiene armario, Cubeast no tiene
base de gear, Cube Station está atado a GAN).

---

## 7. Lo que esta fase NO hace (límites, explícitos)

- **No reconecta solo tras recargar (en la web).** Web Bluetooth exige un gesto
  para abrir el selector y `navigator.bluetooth.getDevices()` — que es la API
  pensada justo para esto — está hoy detrás de un flag de Chromium, así que no
  sirve para usuarios reales. Al recargar hay que pulsar Conectar **una vez**
  (el selector ya recuerda el cubo); el vínculo, en cambio, sigue ahí.
  Investigado a fondo, con fuentes: **§12**. En el escritorio ese clic no
  existe (BLE nativo) y la Fase 5 puede hacer que además acierte con el cubo
  correcto.
- **No sincroniza el Locker** (fase 6): el vínculo es local por dispositivo.
- **No adivina el evento por el modelo** ni arregla `use3x3As2x2` (§5.2).
- **No cataloga cubos de otras marcas** (MoYu/QiYi): el HAL ya es plugin-first,
  pero la identidad de este plan es la que hoy emite GAN.
- **No persiste la identidad en el solve.** El solve sigue guardando
  `cube_id` + `cube_label`; el firmware no tiene por qué viajar en cada fila.
  Si algún día se quiere ("este PB se hizo con el firmware 1.3"), es una
  columna más y una decisión aparte.
- **No toca la nube**: cero migraciones de Supabase, cero cambios en
  `sync_apply`, cero cambios en los mappers de solves.

---

## 8. Riesgos, con su mitigación

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Orden de bytes del MAC** (§2.2): un MAC tecleado a mano no casa con el leído | Normalizar y comparar aceptando la inversión; verificar con hardware real antes de dar la fase por cerrada. Si no se puede, la vinculación manual siempre funciona |
| R2 | Atribuir solves a un cubo que está conectado pero **no** en la mano | La pieza del dock dice qué atribuye; toast con "deshacer" al cambiar por hardware; nunca se sobrescribe `NO_CUBE` |
| R3 | Vincular el cubo al item equivocado y que la acción automática lo propague | El vínculo es por item y explícito; reasignar pide confirmación; un `smart_id` no puede estar en dos items |
| R4 | El adaptador de escritorio (Tauri) no expone identidad | La interfaz la declara **opcional**; en escritorio la fase degrada al comportamiento de hoy (elección manual) hasta que se porte |
| R5 | Modelo del catálogo desactualizado (nombre interno nuevo) | El estado `unknown-model` es explícito y no rompe nada; la tabla usa `hardwareName` como clave, así que añadir uno es una línea |

---

## 9. Verificación (qué se prueba y con qué)

- `cubeModelCatalog` / `normalizeSmartId` (**nuevo**): ambos órdenes de bytes,
  separadores (`:` `-` espacios), minúsculas, cadena vacía, longitudes malas,
  modelo desconocido, y que **no** se deduce evento del modelo.
- `resolveHardwareLink` (**nuevo**): la tabla entera de §5.1, uno por caso,
  incluido el ambiguo (dos items con la misma identidad) y el vendido.
- **Alta y autoselección automáticas (D5, §5.3)**, que es la parte con más
  formas de salir mal y por eso va con test por regla: conexión con `smart_id`
  ya vinculado → **no crea nada** y autoselecciona; item existente sin vincular
  cuya marca+modelo casan → **se vincula, no se duplica**; varios candidatos →
  **no adivina** (pide elegir); sin candidatos → **crea uno**, con nombre del
  catálogo y etiqueta "Smart"; **sin MAC → no crea**; **sin tipo del evento →
  no crea** (propone); dos altas del mismo modelo → nombres distinguibles;
  «Deshacer» borra solo un item intacto y **no** borra uno editado; `NO_CUBE`
  explícito **no** se pisa; y conectar dos veces seguidas no deja dos items.
- `hardwareLinkStore` / `cubeIdentity` service (**nuevo**): con un adaptador
  falso — conecta → vincula; conecta → `NO_CUBE` no se pisa; reconecta → no
  duplica la escritura; desconecta → la UI deja de decir "conectado"; MAC
  desconocido → estado `no-identity`; y **una sola escritura por conexión**
  (nada de escribir en cada evento de batería).
- `GanCubeAdapter` (**ampliación de los tests existentes**): `identity$` emite
  con vendor/model/mac, el `HARDWARE` actualiza el modelo real (el defecto
  §1.1-1) y conserva firmware y fecha.
- `packages/database` (**nuevo**): la migración `036` contra sqlite-wasm real —
  columna nullable, índice, ida y vuelta por `insert`/`update`/`loadAll`, y que
  **`serial` y `smart_id` son independientes** (escribir uno no toca el otro).
- Invariante de "no toca la nube": un test que falla si aparece una migración
  nueva en `supabase/migrations/` o si las tablas de gear se registran en el
  motor de sync (mismo espíritu que el invariante de la 033).
- i18n `en`/`es` con paridad de claves (el repo ya tiene un test que lo
  comprueba).
- `tsc`, suite completa, lint y build, como en las fases anteriores.

**Lo que no se puede verificar en este entorno:** el handshake real. Los tests
cubren todo lo posterior a la identidad; la lectura de la MAC y del nombre del
modelo exige un GAN delante. Igual que con el render 3D y el tacto, el
visto bueno final es del usuario, con `?orientation_debug=1` como precedente de
diagnóstico ya usado en el repo.

---

## 10. Orden de trabajo y tamaño

**Estado: los ocho pasos están implementados** (2026-09-12). Verificación de
cierre: `tsc` limpio en web y escritorio, ESLint sin errores, **768 tests** en
web + **243** en `database` + **73** en `hardware-hal` + **48** en `state` (y el
resto de paquetes en verde por `turbo run test`), build de la PWA OK, y paridad
de claves `en`/`es` verificada por el test de i18n.

| Paso | Contenido | Depende de | Estado |
|---|---|---|---|
| 1 | `normalizeSmartId` + catálogo + tests puros | — | ✅ |
| 2 | `identity$` en el adaptador (+ test del defecto §1.1-1) | — | ✅ |
| 3 | `smart_id` en la migración, modelo, repo y editor | 1 | ✅ |
| 4 | `resolveHardwareLink` + tests | 1, 3 | ✅ |
| 5 | Servicio `cubeIdentity` + `hardwareLinkStore` + tests, **incluida el alta automática y la autoselección (D5)** | 2, 3, 4 | ✅ |
| 6 | UI: dock, ficha, SmartCubeSection, vínculo/creación | 5 | ✅ |
| 7 | i18n, repaso visual y verificación con hardware | 6 | ✅ (queda la prueba con hardware real) |
| 8 | **Extra del escritorio (§12):** reconexión determinista usando `smart_id` como MAC del `connect_gan_cube` | 3, 5 | ✅ (solo frontend: el parámetro `mac` ya existía) |

Dos hallazgos de implementación, anotados aquí porque no estaban previstos y
explican decisiones del código:

- **Desvincular y deshacer tienen que "despedir" el aviso.** Ambas acciones
escriben en el Locker, y esa escritura hace que el servicio vuelva a resolver de
inmediato: sin marcar la oferta como descartada *antes* de escribir, el item
recién desvinculado parecería "un cubo pendiente de vincular" y se volvería a
vincular al instante (y al deshacer el alta, se crearía otra vez). Por eso
`unlink()` y `undoAutoCreate()` fijan `dismissed` antes del `patchItem`/`removeItem`,
y el usuario puede reactivar la oferta con un clic.
- **La autoselección se aplica una vez por conexión, no en cada recomputación.**
El servicio re-resuelve ante cualquier cambio del Locker, y reafirmar el cubo del
hardware en cada uno desharía una elección manual del dock segundos después de
hacerla. La clave `(item, mac)` garantiza que conectar (o cambiar de cubo
resuelto) selecciona, y que editar el Locker no.

**Tamaño honesto: BAJO** (estimación ~1–2 jornadas de trabajo con tests). El
paso 8 es el único añadido después de la investigación de §12 y es de horas.
El paso 2 es el único que toca un paquete compartido, y es aditivo: interfaz
opcional + un getter. Todo lo demás se apoya en piezas que ya existen
(`serial`/columna nueva, `activeCubeStore`, `resolveActiveCube`, el patrón de
`orientationTracking`).

---

## 11. Decisiones

| # | Decisión | Estado |
|---|---|---|
| D1 | La identidad vive en una columna nueva `gear_items.smart_id` (migración `036`), no en `serial` | **Cerrada** |
| D2 | Con una elección previa distinta gana el cubo conectado, con toast y «deshacer»; `NO_CUBE` nunca se sobrescribe y solo se toca el evento del cubo vinculado | **Cerrada** |
| D3 | `use3x3As2x2`: ¿los 2×2 hechos con las esquinas de tu 3×3 se quedan **sin atribuir** (propuesta) o se atribuyen al 3×3 vinculado? | **Abierta** |
| D4 | Reconexión automática: ¿se escribe ya el camino de la web con detección de capacidad (código dormido hasta que Chrome encienda el flag), o se espera a que lo publique? | **Abierta** (§12) |
| D5 | Al conectar por primera vez, el cubo **se da de alta solo** en el Locker, y las conexiones siguientes **autoseleccionan** ese cubo (con «Deshacer», sin duplicar y solo si la identidad es firme) | **Cerrada** (§5.3) |

D3 no bloquea los pasos 1–6 del plan: es la última rama de `resolveHardwareLink`
y su test. La propuesta es dejarlos sin atribuir —forzar la excepción exige
romper la regla "el cubo es del evento", que es la que impide que un solve se
atribuya a un cubo que no le toca—, pero es una decisión de producto, no
técnica.

Ninguna de las tres primeras cambia la arquitectura; D1 cambia una migración, D2
y D3 cambian reglas de una función pura y sus tests, y D4 es una decisión sobre
cuánto código muerto se acepta a cambio de llegar antes el día que Chrome lo
publique.

---

## 12. Reconexión tras recargar sin volver a pulsar Conectar (investigación)

> Petición explícita: investigar si `navigator.bluetooth.getDevices()` permite
> reconectar el smart cube tras recargar la página, con el producto principal
> en la web y el escritorio ya resolviéndolo de forma nativa. Fecha: 2026-09-12.

### 12.1 Veredicto

**En la web, hoy no es viable con un navegador de fábrica.** No es un problema
nuestro ni de nuestro código: la API que lo permite existe en el estándar, y
Chromium la tiene **detrás de un flag desactivado por defecto**.
**En el escritorio ya ocurre** (BLE nativo, sin gesto) y la Fase 5 puede
además hacerlo *determinista* (que reconecte a **tu** cubo, no al primero que
vea).

### 12.2 Qué permite la API (y dónde está el muro)

| Hecho | Evidencia |
|---|---|
| `getDevices()` **no exige gesto del usuario**. Su algoritmo solo comprueba la *permissions policy* (`bluetooth`) y devuelve `SecurityError` si está bloqueada; nada de activación transitoria | Web Bluetooth spec, algoritmo de `getDevices()` |
| El único sitio del estándar que exige gesto es **`requestDevice()`**: «Check that the algorithm is triggered while its relevant global object has a transient activation, otherwise throw a SecurityError» | Web Bluetooth spec, algoritmo de `requestDevice()` |
| El estándar **quiere** que esto funcione tras recargar: «The ability to retrieve granted devices after a page reload, provided by §4.1 Permission API Integration» | Web Bluetooth spec, §3.2 (consideraciones de seguridad) |
| Y da incluso la receta: un `device` de la lista «may indicate that it is close enough for a connection to be established by calling `event.device.gatt.connect()`» | Web Bluetooth spec, nota bajo `getDevices()` |
| **Pero** en Chromium la pieza que lo habilita está apagada de fábrica: `kWebBluetoothNewPermissionsBackend{"WebBluetoothNewPermissionsBackend", base::FEATURE_DISABLED_BY_DEFAULT}` | `content/public/common/content_features.cc` (varias revisiones) |
| Y el flag que la enciende nombra exactamente nuestras dos APIs: «…as `BluetoothDevice.watchAdvertisements()` and `Bluetooth.getDevices()`» | `chrome/browser/flag_descriptions.cc` |
| El sample oficial lo dice sin rodeos: «Available in Chrome 87+. **You must be using Chrome with the `chrome://flags/#enable-web-bluetooth-new-permissions-backend` flag enabled**» | `googlechrome.github.io/samples/web-bluetooth/get-devices.html` |
| El propio CG lo mantiene anotado: `getDevices()` 🚩 (flag experimental) y *Persistent Device Permissions* 🚩 (`#enable-web-bluetooth-new-permissions-backend`); y `permissions.query()` **sin implementar** en Chrome | `WebBluetoothCG/web-bluetooth` → `implementation-status.md` |
| Safari y Firefox **no implementan Web Bluetooth** en absoluto (y no hay plan) | MDN / BCD (`Bluetooth`: `safari: false`, `firefox: false`) |

Conclusión: **el muro no es el gesto, es la disponibilidad.** El día que
Chromium encienda ese flag por defecto, el mismo código funcionará sin tocar
nada más; hasta entonces, es una función para *power users* y para despliegues
embebidos donde tú controlas los flags (hay proyectos que arrancan Chromium en
modo kiosco con `--enable-features=WebBluetoothNewPermissionsBackend`, p. ej.
el GUI web del Pokit Pro).

### 12.3 Hallazgo colateral: una API nuestra está muerta hace años

`autoRetrieveMacAddress()` (`packages/gan-protocol/src/gan-smart-cube.ts:49-63`)
lee el MAC de los anuncios con `device.watchAdvertisements()`. Esa API **nunca
salió de detrás del flag y ya no se persigue**: desde el 2023-10-31 su función
se integrará en `requestLEScan` con `listenWithGrantedDevices`
(chromestatus, feature 5180688812736512).

Consecuencia real, y buena para este plan: **en un Chrome de fábrica el MAC
llega por el respaldo de `System ID (0x2A23)`** (`gan-smart-cube.ts:78-102`),
que es una lectura GATT corriente — es decir, *también disponible en un flujo
de reconexión*. El guard que ya existe (`typeof device.watchAdvertisements != 'function'`
→ `resolve(null)`, `:53-56`) hace que esto no rompa nada; está escrito sin
`return`, pero es inofensivo porque la promesa ya quedó resuelta y el `throw`
posterior del executor se descarta por especificación. Se deja como está: es
código correcto por accidente y conviene un comentario, no un refactor.

### 12.4 Cómo lo hace hoy el escritorio (verificado en el código)

Es exactamente lo que dice la intuición, con un matiz que importa:

- Al abrir la app, Rust lanza un auto-scan en segundo plano
  (`apps/desktop/src-tauri/src/lib.rs:70-75` → `ble::cube::start_auto_scan`).
- Cuando encuentra un GAN, emite `ble:devices_found` y el frontend **conecta
  solo**: `await globalCubeAdapter.connect()` en
  `apps/desktop/src/main.tsx:54-77`, con un comentario que ya lo dice — «This is
  a desktop-only feature — Web Bluetooth requires user gesture».
- El escritorio **reutiliza la UI de la web** (alias `@` → `../web/src` en
  `apps/desktop/vite.config.ts`, y solo se sustituyen `@cubalyze/hardware-hal`
  y `@cubalyze/database`), así que todo lo de la Fase 5 vale en los dos sitios.

**El matiz:** conecta al **primero** que aparece (`cubes[0]`) y el MAC solo se
recuerda **dentro de la sesión** (`AppState.last_cube_mac` es un `Mutex`
`None` al arrancar, `src-tauri/src/state.rs:15,35`). Con dos cubos GAN encima
de la mesa, puede coger el que no es. Ahí es donde la Fase 5 aporta algo que
hoy no existe en ningún sitio: `connect_gan_cube` **ya acepta un `mac`** y las
dos estrategias de búsqueda lo comparan (`find_cached_gan_cube` / `scan_for_gan_cube`,
`ble/cube.rs:86,129`), pero el frontend nunca le pasa uno guardado. El
`smart_id` del Locker **es** ese MAC.

### 12.5 Qué propongo (y qué no)

- **Sí, y es un paso 8 de la Fase 5 (pequeño, alto valor):** en el escritorio,
  pasar el `smart_id` del cubo vinculado a `connect_gan_cube({ mac })` al
  arrancar, y si el auto-scan encuentra varios cubos, **elegir el nuestro** en
  vez del primero. Es donde «sin clics» es legal hoy.
- **En la web: feature-detect, no implementación a ciegas.** La capacidad se
  detecta con una línea (`typeof navigator.bluetooth?.getDevices === 'function'`).
  La opción honesta es **no escribir** todavía el camino de reconexión, porque
  sería código que no se puede probar ni usar (flag + cubo físico + Chrome) y
  que se pudriría antes de encenderse. Lo que sí se hace: **dejar el gancho
  escrito y documentado** (esta sección) para que el día que Chrome lo publique
  sea una tarde de trabajo, no un rediseño.
- **No** pedir al usuario que active flags, ni depender de ello en el producto.
- **La UX de la web ya es la mínima posible:** un clic para conectar por carga
  de página (el selector de Chrome lista el cubo ya autorizado) y, con la Fase
  5, **todo lo demás automático** — identidad, vínculo e imputación. El clic no
  se puede quitar; lo que sí se puede quitar es tener que *elegir el cubo a
  mano*, que es lo que duele de verdad.

### 12.6 Lo que queda sin verificar (honestidad)

- No puedo probar el flujo real en este entorno: hace falta un cubo físico y un
  Chrome con el flag.
- **Bluefy (iOS)**: es el camino móvil documentado del proyecto, y no hay
  información pública sobre si implementa `getDevices()`. Como el flag de
  Chromium es el cuello de botella en todas partes, la conclusión no cambia,
  pero conviene no afirmar nada sobre Bluefy.
- El orden de bytes del MAC (§2.2, R1) sigue pendiente de comprobar con
  hardware; y con `watchAdvertisements` muerto, la única fuente real es la
  lectura de `System ID`, así que la comprobación es más simple de lo que
  parecía.
