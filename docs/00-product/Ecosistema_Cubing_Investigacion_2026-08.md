# Investigación profunda del ecosistema del cubing y auditoría de necesidades de Cubalyze

**Fecha:** Agosto 2026
**Tipo:** Investigación de comunidad + análisis de competencia + auditoría real del código de la aplicación.
**Aplicación auditada:** Cubalyze (monorepo `cubalyze-monorepo`, rama `main`).
**Idioma:** Español (las citas de usuarios se mantienen en su idioma original y se traducen).

---

## Índice

1. Resumen ejecutivo
2. Metodología, fuentes y honestidad de cobertura
3. El ecosistema del cubing (mapa de capas, usuarios y hardware)
4. Investigación en Reddit (r/Cubers y afines)
5. Foros y otras comunidades
6. Reseñas de aplicaciones
7. Análisis de la competencia (ficha por aplicación)
8. Inventario exhaustivo de necesidades de la comunidad
9. Señal vs. ruido (priorización de la evidencia)
10. Necesidades históricas y recientes (evolución del ecosistema)
11. Necesidades nicho documentadas
12. Auditoría real de Cubalyze (verificación por código)
13. Contraste necesidad ↔ aplicación (matriz completa)
14. Bugs, riesgos y falsas apariencias detectados
15. Revisión final y conclusiones
16. Referencias

---

## 1. Resumen ejecutivo

**Qué quiere la comunidad.** Los cubers no quieren "más funciones": quieren (a) un cronómetro sin fricción, preciso y fiable que no pierda sus datos, (b) análisis que les diga *por qué* son lentos (reconocimiento vs. ejecución, pausas, fase débil), (c) entrenamiento deliberado por micro-habilidad con repetición espaciada, (d) soporte de todos sus puzzles y eventos WCA, (e) poder llevarse sus datos y, cada vez más, (f) sincronización entre dispositivos y comunidad/comparación. La queja histórica transversal es que **ninguna herramienta une las cinco capas** (timer → smart cube → análisis → entrenamiento → base de algoritmos): los usuarios combinan 3-5 apps manualmente.

**Qué resuelve hoy el mercado.** El cronómetro y las estadísticas básicas están *commoditizados* (csTimer, Twisty Timer, CubeDesk, CubeTime…). El análisis de smart cube por fases está resuelto por Cubeast y los ecosistemas de fabricante (GAN Cube Station). El entrenamiento por algoritmos con SRS está resuelto (Cubeast Academy, trainer de csTimer, SpeedCubeDB, Anki, trainers independientes). La reconstrucción/competición social está resuelta por CubeDB. **Lo que nadie resuelve bien:** unificar todo con datos coherentes, análisis explicable a nivel de movimiento, detección automática del eslabón débil, y la capa de plataforma (cuenta + sync + comunidad) sin vendor lock-in.

**Qué es Cubalyze hoy (verificado por código).** Un núcleo técnico notablemente completo y bien testeado **para 3×3 y 2×2 con CFOP/Roux (y estructura para ZZ/Petrus/Ortega/CLL/EG)**: timer WCA, smart cube GAN por BLE + StackMat por audio con corrección de deriva de reloj, motor 3D, análisis de fases con detección de color-neutral/xcross/skips, entrenamiento con FSRS-4 real, base de algoritmos (~500+ casos sembrados), estadísticas, sistema de widgets, perfil local, onboarding guiado (6 pasos), import/export (csTimer, Twisty Timer, CSV, JSON, XLSX) e i18n EN/ES.

**Qué le falta (verificado).** (1) Plataforma: cuenta/identidad de servidor, sincronización multi-dispositivo, backend y AI Coach — los paquetes `ai-core`, `sync-engine` y `apps/api` son **solo `package.json` vacíos**. (2) Cobertura WCA real: **4×4–7×7, Megaminx, Pyraminx, Skewb, Clock, Square-1, 3BLD/MBLD, OH (diferenciado), FMC** — hoy los selectores de 4×4–7×7/Megaminx/Pyraminx/Skewb existen en la UI pero **generan un scramble de 3×3 y guardan el solve como 3×3×3** (falsa apariencia, bug real). (3) Reconocimiento de casos y estadísticas por caso desde solves reales (el diferenciador que Cubeast/csTimer ya venden). (4) Comunidad/compartir reconstrucciones (el Replay 3D ya existe, falta el "compartir"). (5) Video integrado del último solve. (6) Beeps/configuración BLD y modos OH/BLD/FMC.

---

## 2. Metodología, fuentes y honestidad de cobertura

### 2.1 Nota de honestidad sobre el requisito de "1.500 comentarios"

El encargo pide analizar "como mínimo 1.500 comentarios de Reddit". Debo ser transparente sobre lo que esto significa en la práctica con las herramientas disponibles:

- Reddit **bloquea la lectura directa** (login wall / 403) tanto de los hilos como de su API JSON desde este entorno. Los hilos de SpeedSolving sí son legibles y se leyeron en bruto (contenido completo del hilo).
- Para Reddit utilicé **decenas de búsquedas dirigidas** (motor de búsqueda con snippets y answer boxes que devuelven el *texto real de los comentarios*), cubriendo hilos de 2013 a 2026. Cada snippet devuelto es un comentario o fragmento de comentario real de un usuario.
- Por ello **no afirmo haber contado literalmente 1.500 comentarios**: sería fabricar una cifra. Lo que sí afirmo es que la muestra cubre **más de 40 hilos distintos de Reddit** y decenas de discusiones de SpeedSolving/Facebook/YouTube/App Store, con comentarios individuales extraídos y citados, y que la saturación temática fue alcanzada (los mismos temas —sync, BLE lag, UI, migración de datos, BLD, multi-evento— se repetían en todas las fuentes sin aportar necesidades nuevas).

La profundidad, no el recuento, es lo verificable: cada hallazgo relevante va ligado a su fuente.

### 2.2 Fuentes consultadas

**Reddit (r/Cubers, r/GANCUBE_Official, r/logitech), vía snippets de búsqueda:**
- "What's the best alternative to CS Timer?", "Which Timer you use and why?", "What makes CS timer better than Cubedesk?", "CubeDesk vs CStimer", "Better than CS Timer", "A new CSTimer", "Let's be honest, csTimer is bad", "Cstimer SUCKS!!!!", "What's your favorite and least favorite thing about cstimer?", "What are some complaints you have about your speedcubing timer", "Some Features that would be really cool on Cs Timer", "Big issue with tools on Cs timer", "cstimer global sessions", "Did anyone else lose their solves/sessions", "Question about CS Timer and stat tracking", "Import not working!", "Switching apps".
- Smart cubes: "Everyone should own a smart cube", "Questions about smart cubes", "What Smart Cube has the best App?", "Are smart cubes worth it?", "I reverse engineered the QiYi smartcube protocol!", "Gan 12 ui not charging or connecting", "What happened to the Gan 356 i carry 4", "Cs Timer Bluetooth cube issues", "How safe is the CubeStation app".
- Entrenamiento: "Describe your perfect alg trainer", "I made a new kind of alg trainer", "A smart alg trainer?", "Tutorial Learn algs efficiently with Anki", "Flashcards to learn new algs", "New Speedcubing Training Software", "What are/which website has THE best oll and pll algs", "How to improve at cross?", "Does anyone else find practicing f2l to a metronome impossible", "F2L & Cross Practice Techniques", "Metronome Training", "How effective is metronome practice for look-ahead?", "Advice On Breaking 30s".
- BLD: "Android cube timer app features", "Does blindfolded memorization ever get easier?", "Music/audio for blindfold solving?".
- iOS/móvil: "Best timer for ios?", "Best iOS cube timer ?", "We made a new timer for iOS!", "New mobile speedcubing timer".
- Progreso/metas: "How do you track your times?", "What are your cubing goals for 2024?", "My progress after Cubing for 20 months", "What's your biggest cubing achievement so far?".
- Color neutrality: "As people routinely ask about Color Neutrality", "Is color neutrality overrated", "Could be my color neutrality actually slowing down", "Color Neutral - Which cross?".
- Reconstrucción: "Introducing... CubeDB", "new version of cubedb, now supports profiles and socials!", "Automatic Solve Critiques - CubeDB.net".
- FMC: "Is there a FMC app?", "Why does no one take FMC seriously".

**Foros:** SpeedSolving — "Making a Cube Timer Site — Ideas Needed" (leído completo), "Cubeast — a speedcubing timer for Bluetooth cubes" (leído completo), "VizCube — Fun and helpful way to visualize solves" (leído completo), "csTimer released" (changelog histórico completo leído), "the DB in cubedb", "CubeDB.net is back", "What cubing timer should I get for my phone?", "Official GAN 356i discussion / issues report", "Rubik's cube Stop-watch for Windows and Linux".

**Reseñas / stores:** Google Play (Twisty Timer 4.8/10.186, CubeStation 2.5/3.764, Last Cube X 4.7/1.504), App Store (CubeStation NEW, OLL Genius), Softonic (Twisty Timer), sitios web oficiales (csTimer, Cubeast, CubeDesk, CubeDB, SpeedCubeDB).

**Wikis comunitarias:** r/Cubers wiki (timing_programs, smart_cubes, cstimer, how_to_improve, improving_bld, improving_fmc — vía snippets, contenido citado).

**Aplicación auditada:** lectura directa de `apps/web/src`, `packages/*` (algorithm-db, analysis-engine, solver-engine, training, hardware-hal, timer-engine, statistics, math-core, cube-3d-engine), `apps/desktop`, `apps/api`.

### 2.3 Criterio de evidencia

- **Problema recurrente / necesidad ampliamente compartida** = aparece en ≥3 fuentes independientes (hilos, foros, reseñas, changelogs) o en el changelog de un producto líder como respuesta a demanda.
- **Necesidad de nicho** = aparece en pocas fuentes pero con un caso de uso concreto y un usuario identificable.
- **Opinión aislada** = un único comentario sin eco.

---

## 3. El ecosistema del cubing (mapa de capas, usuarios y hardware)

### 3.1 Las cinco capas (y su fragmentación)

El ecosistema se organiza en capas que **rara vez conviven en un solo producto**:

| Capa | Función | Representantes | Estado del mercado |
|---|---|---|---|
| **Cronómetros** | Timing, medias, sesiones, scrambles | csTimer, Twisty Timer, CubeDesk, CubeTime, Cubic Timer, Last Cube X, Timiks, Nexus Timer | Commoditizado; compiten por UX/UI |
| **Analítica de smart cubes** | Captura BLE de movimientos, splits por fase, reconstrucción automática | Cubeast, GAN Cube Station, iStation, csTimer (parcial) | Resuelto por 2-3 actores; dependiente de BLE |
| **Entrenadores de algoritmos** | Repetición espaciada de OLL/PLL/F2L/ZBLL | Cubeast Academy, trainer de csTimer, SpeedCubeDB, CubingApp, Lambro Trainer, Cube Rivals, OLL Genius, Anki | Fragmentado y desconectado del cronómetro |
| **Bases de algoritmos** | Catálogos consultables con variantes | AlgDB, SpeedCubeDB, CubeDB (reconstrucciones) | Muy maduro como contenido |
| **Infraestructura de motor** | Solvers óptimos, generación de scrambles, visualización 3D | Kociemba/min2phase, TNoodle, cubing.js/Twizzle | Maduro, con licencias GPL a vigilar |

**Hallazgo central (confirmado por 3 frentes):** el dolor nº 1 no es la falta de una función, sino la **fragmentación**: el cuber usa csTimer/CubeDesk para cronometrar, Cubeast/CubeStation para analizar el smart cube, SpeedCubeDB/Anki para entrenar algoritmos, CubeDB para reconstruir y Excel/VizCube para graficar. Cada frontera es una exportación manual y una pérdida de contexto.

### 3.2 Perfiles de usuario

| Perfil | Qué necesita | Herramientas típicas | Dolor principal |
|---|---|---|---|
| **Principiante (<60s)** | Guía, método, aprender notación/algoritmos | YouTube, CubeSkills, app del cubo, tutoriales | No sabe *por dónde empezar* ni qué entrenar |
| **Intermedio (sub-30/sub-20)** | Entrenar F2L/OLL/PLL, lookahead, seguir progreso | csTimer, Twisty Timer, trainers | F2L/lookahead estancados; no sabe qué fase es su cuello de botella |
| **Avanzado (sub-12/sub-10)** | Análisis fino (TPS, pausas, splits, reconstrucción) | Cubeast, csTimer smart, CubeDB | Reconocimiento vs ejecución; reconstrucción manual costosa |
| **Competidor WCA** | Formatos oficiales, StackMat, inspección, presión, todos los eventos | StackMat + csTimer | Los smart cubes rompen el hábito de start/stop; falta simulación de presión |
| **Entrenador** | Diagnosticar alumnos, planes | Nada unificado; hojas de cálculo | Sin herramienta de diagnóstico por alumno |
| **Casual / coleccionista** | Puzzles no-WCA, resolver, compartir | apps de fabricante | Contenido disperso |
| **Usuario de smart cube** | Captura fiable, batería, análisis | Cubeast, CubeStation, csTimer | BLE lag, falsos +2, batería, lock-in |
| **Usuario de StackMat** | Precisión de competición vía jack/audio | csTimer (StackMat por mic) | Configuración del jack/mic es frágil |
| **Solo software** | Timer + stats sin hardware | csTimer, CubeDesk, Twisty Timer | Migración de datos, sync |

### 3.3 Hardware relevante

- **Smart cubes BLE (3×3):** GAN 356 i Carry/i3, GAN 12 UI (MagLev), GAN 356 i Carry 2/4, MoYu WeiLong V10 AI, QiYi Smart Cube, GoCube, Giiker. Cada fabricante tiene **protocolo BLE propietario** (algunos cifrados con AES). Problemas documentados: batería degradada (GAN 12 UI de ~15h a ~3h), "bricking" si la batería se agota por completo, pérdida de movimientos, lag variable.
- **Timers físicos:** SpeedStacks/StackMat (jack TRS 2.5mm → adaptador 3.5mm → mic), QIYI Smart Timer (BLE), MoYu Timer. El StackMat sigue siendo el estándar de competición y muchos puristas lo prefieren ("whats the best timer? stackmat.").
- **Web Bluetooth:** disponible en Chrome/Edge/Opera; **ausente en Safari/iOS** → en iOS los smart cubes exigen app nativa. Esta es una de las razones del hueco de apps iOS para smart cubes.

---

## 4. Investigación en Reddit (r/Cubers y afines)

> Los comentarios citados son verbatim (o paráfrasis marcadas) extraídos de los snippets de búsqueda sobre los hilos listados en §2.2. Fecha del hilo entre paréntesis.

### 4.1 Cronómetros: qué valoran y qué odian

- **csTimer es el estándar de facto por su motor, no por su UI.** Citas: "the functionality of csTimer is awesome but aesthetically it's mediocre" (2016); "CSTimer asks to save some things in persistent storage…" y la queja recurrente de settings "cluttered when you're trying to find specific settings"; "When drilling sets you can't select…" (2026).
- **La apariencia repele a nuevos usuarios:** "CS Timer looks terrible imo so I was wondering if anyone knew any good ones" (2023). Este es el hueco que llenan CubeDesk y Cubalyze.
- **csTimer en móvil es pobre:** "CS kinda sucks on mobile" (2024). El PWA ayuda pero la densidad de la UI no se adapta.
- **Falta sincronización/backup:** "Really the only thing I feel is missing is automatic live sync/backup of your solves and config" (2022). El backup de csTimer es manual (Google Drive / cuenta WCA) y hay historial de pérdidas masivas: "FML, I wiped all my history and cache stuff" (2019, hilo "What happened to csTimer??!"); "Did anyone else lose their solves/sessions on cstimer" (2017).
- **Miedo a perder datos es la razón nº 1 para no cambiar de app:** "do these stats just stay on the browser?" (2025).
- **Migración entre apps es dolorosa:** "Export your Cube Timer file as a .txt and upload it to this website… You have to modify the exported file to match" (2016); "You can try exporting data from Twisty Timer, then ask AI to use the Twisty Timer data format as a reference and convert the Last Cube X CSV" (2026). Los usuarios **improvisan conversores con IA** porque los formatos no son interoperables.
- **CubeDesk borró cuentas:** "I just switched away from cubedesk because it decided to erase my account with ~30k solves" (2023). Esto alimenta la desconfianza en soluciones solo-nube.
- **CubeTime (iOS) limitado:** "only allows 2 decimals for typed times, inability to edit times, and is quite buggy" (2024).
- **Precisión del timer:** crítica antigua a los timers que no paran al soltar: "the timer doesn't stop until you release the spacebar" (2013, sobre cubetimer.com).

### 4.2 Peticiones de funciones concretas (verbatim representativas)

- **Categorías/puzzles personalizados y splits por fase:** "the ability to add custom cube (3x3, OH, BLD, Curvy Copter, etc.) categories and custom splits for times (like timing cross, f2l, OLL, and PLL in CFOP separately in the same solve), maybe some custom scrambles such as OLL/PLL/L5EOP/WVLS practice" (2015).
- **Multi-fase y documentar el color del cross (color neutrality):** "Multi-phase timing (like in CSTimer). A way to document cross colour, so it's easy to train colour neutrality and determine your weakest colour" (2020).
- **Timer + biblioteca de algoritmos en una app:** "A timer app that also has a library of algorithms for different methods" (2026).
- **BLD con fases memo/ejecución:** "My ideal timer would literally just be PlusTimer but with BLD mode (separate timing for memo and execution) being optional during BLD sessions" (2015).
- **Recons pegados al solve (TPS):** "the ability to add recons directly to solve info. This would give TPS stats" (SpeedSolving).
- **Merge/mover solves entre sesiones:** "Top priority would be full merges, but a little transfer thing in solve info for individual solves" (SpeedSolving).
- **Estadísticas personalizables (AoN arbitrario):** "I was talking about whatever mo/bo/ao # you wanted (like Ao30)" (SpeedSolving).

### 4.3 Entrenadores de algoritmos

- **Anki/SRS es el patrón de oro aceptado:** "This learning technique is called spaced repetition and is not only used by cubers to learn new alg sets" (2024); "The CubingApp Trainer is much like Anki, but for cubing algorithms… the fastest trainer in the world" (2023).
- **Lo que falta en los trainers existentes:** "One of its biggest features was seeing the number of times you correctly recalled" (Anki, 2024); "a full revision tool for PLL with 2-sided recognition" (2021); recap mode ("run through all the OLLs you know once in a random order", 2026).
- **Auto-diagnóstico por algoritmo:** "it's an alg trainer that lets you actually say why you suck at a particular alg and then decides if you've learned that algorithm" (2021).
- **Trainer que aprende de solves reales (nicho emergente):** "It extracts the case data also from solves and knows your recognition times and execution times as well" (2024).

### 4.4 Smart cubes

- **Valor real:** "If you haven't tried a smart cube yet, I highly recommend it. It adds a whole new dimension" (2024).
- **Rompen el hábito de competición:** "if you compete, using a smart cube will f*ck with your timer start/stop habits" (2024). Cubeast confirma ~0.75s de pickup/putdown que hace incomparables los tiempos de cubo vs teclado/StackMat.
- **Fiabilidad:** batería degradada y bricking ("you cannot let the battery run out or else they'll never work again", 2025); problemas de conexión en CubeStation ("I can't get it to verify the cube… any time I take the cube out of the case it disconnects"); csTimer BLE "connecting does nothing… turning the cube does nothing" (2026).
- **Cubeast vs csTimer vs CubeDesk para smart cubes:** "Cubeast is another option, but it is less customizable but easier to understand for noobs… CubeDesk is not targeted to smart cubes" (2024).
- **Motivación social:** "the ability to compete with other people online would definitely motivate" (2025, buscando smart cube con mejor app).

### 4.5 iOS y móvil

- "Best timer for ios? … I've heard of twisty timer but in the app store all I saw was something…" (2024) — Twisty Timer es solo Android; iOS carece de un equivalente maduro.
- "Cs timer is fine but it's cluttered with ads" (2025) — los ads de csTimer en móvil molestan.
- Los timers iOS relevantes son CubeTime, Cubic Timer, Last Cube X y apps de nicho; ninguno domina.

### 4.6 Metas, progreso y motivación

- Las metas se comparten como texto, no se trackean en la app: "Mine are: Be sub 15 on 3x3, Be sub 1 minute on 4x4, Learn to solve the 3x3 bld by heart, Learn all oll and PLL…" (2024). **Ninguna app rastrea metas de rendimiento tipo "sub-X".**
- Análisis manual de pausas fuera de la app: "Record a solve. Then pop it into video editing software and edit out all the parts where you've stopped turning" (2026) — workflow manual que un análisis automático sustituiría.
- Comunidad pide "critique" de solves: "I recommend reconstructing your solves when you want them critiqued, or at the very least post the scrambles" (2026).

---

## 5. Foros y otras comunidades

### 5.1 SpeedSolving — "Making a Cube Timer Site — Ideas Needed" (leído completo)

Peticiones directas de usuarios a un desarrollador que construía un timer:
- **Merge/split de sesiones y mover tiempos individuales** entre sesiones (prioridad "full merges" + "a little transfer thing in solve info for individual solves").
- **Estadísticas custom** (AoN arbitrario, solves/día, media de solves/día).
- **Reconstrucciones adjuntas al solve** para obtener TPS.
- **Migración de datos sin fricción** entre apps.
- **Video del último solve** para revisión.

### 5.2 SpeedSolving — "Cubeast" (leído completo; conversación desarrollador↔usuarios)

Problemas reales de la analítica de smart cubes, todos relevantes para Cubalyze:
- **Falsos +2 por lag BLE:** "I have been getting a ton of +2s when I didn't actually get one… the cube on the screen is like .1 seconds behind". El desarrollador reconoce que el lag BLE cambia en el tiempo y que el reloj interno del GAN mitiga (→ corrección de deriva, ya implementada en Cubalyze).
- **Detección de fase errónea con color neutrality:** el sistema creyó "red face down" porque el usuario completó la cruz roja antes que la amarilla; el desarrollador propone marcar solves "out of order / non-CFOP" y excluirlos de stats. (Cubalyze implementa detección color-neutral de la cruz — ventaja directa.)
- **Auto-stop exacto:** "The timer should auto-stop on completion of the solve" — pedido explícito; Cubeast lo añadió después.
- **Incomparabilidad de fuentes de timing:** pickup/putdown ~0.75s hace que cubo vs teclado/StackMat no sean comparables (implicación: etiquetar la fuente del solve).

### 5.3 SpeedSolving — "VizCube" (leído completo)

- VizCube existe **solo porque csTimer/Twisty Timer no visualizan bien**: importa solves de ambos, heatmap estilo GitHub, distribución de medias, día/hora más activos, SQLite expuesto para consultas avanzadas. **Demanda de visualizaciones nativas sin herramienta externa.**
- "Fiabilidad offline con backups locales — perder historial por caches borrados es inaceptable" (conclusión del auditor anterior, consistente con el hilo).

### 5.4 SpeedSolving — "csTimer released" (changelog histórico completo leído)

El changelog de csTimer (2017→2025) es la mejor fuente de **necesidades ya validadas por el mercado** (ver §10 para la evolución histórica y §7 para el inventario).

### 5.5 Facebook (grupos de cubing) y YouTube

- Conexión GAN/CubeStation problemática, "Does the cubestation app from GAN work offline?", "Twisty Timer vs Cubic Timer", "Is the Twisty Timer app reliable…?".
- La comparativa "Is CubeDesk better than csTimer?" (vídeos de 2021) cristaliza la discusión: CubeDesk gana en UX, csTimer gana en profundidad de scrambles.

---

## 6. Reseñas de aplicaciones

### 6.1 Twisty Timer — Google Play 4.8★ (10.186 reseñas)

- **Gusta:** "There are NO paid features in this app… I've been using it for years"; simplicidad, TNoodle scrambles, offline, ad-free.
- **Molesta / falta:** "when using the oll or pll [trainer]…" (queja incompleta en el snippet, sobre el entrenador); sin smart cube, sin análisis, sin sync, solo Android.

### 6.2 GAN Cube Station — Google Play 2.5★ (3.764 reseñas)

- Rating bajo para una app oficial. Quejas (Play + Reddit + YouTube): conexión que se pierde al sacar el cubo del estuche, verificación del cubo que falla, requiere cuenta, tracker/permissions, problemas tras updates ("cube station app won't open after last update"), batería del cubo drenada.
- Lo bueno (cuando funciona): battles online, tutoriales, reconstrucción, integración con su hardware.
- **Lección:** el lock-in de fabricante + cuenta obligatoria + calidad móvil irregular deja un hueco enorme para una app neutral y fiable.

### 6.3 CubeStation NEW — App Store

- "No problems logging in, everything connects good and I'm crushing my averages!" vs. críticas implícitas a la versión antigua; la dualidad "antigua vs nueva" confunde.

### 6.4 Last Cube X — Google Play 4.7★ (1.504 reseñas)

- Posicionado explícitamente como "New Rubik's Cube timer like Twisty Timer" con Material You, soporte NxNxN/Pyraminx/Megaminx/Square-1/Skewb/Clock e imagen de scramble. **La competencia móvil ya cubre multi-evento**; Cubalyze aún no.

### 6.5 OLL Genius — App Store 4.3★

- "Intelligent Spaced Repetition" como argumento de venta → confirma que **SRS es el estándar esperado** en un entrenador de algoritmos moderno.

### 6.6 Patrones transversales de las reseñas

1. **SRS** es tabla de entrada en entrenadores.
2. **Multi-evento** es tabla de entrada en timers móviles.
3. **Fricción de conexión** (BLE/StackMat) es la queja de hardware nº 1.
4. **Cuenta obligatoria / lock-in** se percibe como negativo salvo que aporte sync/battles.
5. **Ads** se toleran mal incluso en el estándar csTimer.

---

## 7. Análisis de la competencia (ficha por aplicación)

### 7.1 csTimer (web/PWA, GPLv3) — el estándar

- **Qué ofrece:** scrambles para *todos* los eventos WCA + decenas de puzzles no-WCA; entrenamiento por sub-paso (EO cross, easy cross/xcross con rangos, VLS, Mehta, ZBLL, TTLL, L4E, SQ1 CSP, 2×2 TCLL…); BLD helper (encoder + scrambler, orden de encoding, orientación aleatoria); multi-fase; sesiones con merge/split/group; estadísticas custom (mo/bo/ao N arbitrario, WPA/BPA, target time, distribución acumulada, tendencia con zoom, métricas por caso); smart cubes multi-fabricante; virtual cube para todos los puzzles WCA; reconstrucción (CFOP/Roux, por caso, scatter de pausas); battles online (hasta 6); playback y compartir por link; backup por Google Drive / cuenta WCA (manual); export/import de otros timers.
- **Para quién:** el cuber de potencia que quiere *todo*.
- **Qué hace bien:** profundidad de scrambles y entrenamiento; es el "súper-set" de referencia.
- **Qué hace mal:** UI densa/anticuada, móvil pobre, monolítico (un archivo JS gigante), sin análisis explicable de IA, sin reconocimiento automático de casos desde solves (lo tiene *parcial* vía virtual/BLE), sync manual y propenso a pérdida de datos.
- **Por qué se queda la gente / por qué se va:** se queda quien valora el motor; se va quien no soporta la UI o el móvil.
- **Críticas:** ver §4.1.

### 7.2 Cubeast (web) — la referencia en analítica de smart cubes

- **Qué ofrece:** soporta *todos* los smart cubes 3×3; grabación/almacenamiento/análisis de todos los solves; splits con reconocimiento/ejecución por fase, inspección, pickup/putdown; estadísticas (TPS por modelo de cubo, % de XCross, tiempo medio de reconocimiento de PLL); timers externos (StackMat); compartir solves por link; Academy (aprender algs, reconocimiento, XCross).
- **Qué hace bien:** el diagnóstico "reconocimiento vs ejecución" que el PRD de Cubalyze cita como validado; foco y UX clara.
- **Qué hace mal / no hace:** menos customizable, dependiente de Web Bluetooth (sin app nativa iOS), capa de entrenamiento estructurado limitada frente a csTimer, sin multi-evento real (foco 3×3), cuenta/sync limitados.
- **Críticas:** falsos +2 por lag (mitigado con reloj interno), detección de fase errónea en solves no-CFOP.

### 7.3 CubeDesk (desktop + web)

- **Qué ofrece:** timer multi-evento (3×3, 2×2, 4×4, 5×5, Skewb…), trainer de algoritmos, 1v1, leaderboards, mini-juegos; UX moderna.
- **Qué hace bien:** UX pulida y social (1v1, leaderboards).
- **Qué hace mal:** requiere cuenta, análisis avanzado limitado, sin smart cube como foco; **incidente de borrado de cuentas (~30k solves)**; menos scrambles que csTimer.

### 7.4 Twisty Timer (Android, open source)

- **Qué ofrece:** timer offline, TNoodle scrambles para todos los eventos WCA, sesiones, stats básicas, personalización material; sin smart cube ni análisis.
- **Qué hace bien:** simplicidad, fiabilidad, offline.
- **Qué hace mal:** sin smart cube/análisis/training estructurado; solo Android.

### 7.5 GAN Cube Station / iStation

- **Qué ofrece:** ecosistema GAN: captura, splits en tiempo real, battles, tutoriales, gamificación, reconstrucción.
- **Qué hace bien:** integración con su hardware; motivación social (battles).
- **Qué hace mal:** vendor lock-in total (solo GAN), cuenta obligatoria, calidad/estabilidad irregular (2.5★), no exportable.

### 7.6 CubeDB / SpeedCubeDB / AlgDB (contenido)

- **CubeDB:** reconstrucciones con autocompletado de algs, comentarios por fase, playback, perfiles/social (follow/like), AI critique. **El estándar de "compartir reconstrucción".**
- **SpeedCubeDB:** algoritmos + reconstrucciones para 2×2–6×6, SQ1, Pyraminx, Megaminx; SRS por hojas; cross trainer.
- **AlgDB:** catálogo consultable.
- **Qué no hacen:** timer, tracking de tiempo real, integración con solves del usuario.

### 7.7 Infraestructura: cubing.js / Twizzle, TNoodle, min2phase

- **cubing.js/Twizzle:** render/playback web component, explorer de reconstrucciones, módulo BLE, sticker editor, VR, pattern solver (aspirante a reemplazar TNoodle). GPL en ramas.
- **TNoodle:** único generador de scrambles oficial WCA (referencia de interoperabilidad, no dependencia).
- **min2phase:** solver Kociemba de referencia (~2.3ms/solve, ≤21 movimientos).

### 7.8 Otras herramientas que usa la comunidad

- **VizCube / csGrapher:** visualización de datos de csTimer/Twisty Timer (heatmap GitHub-like, distribuciones, SQL expuesto) — nacen para tapar el hueco de visualización.
- **Anki / CubingApp / Lambro Trainer / Cube Rivals / OLL Genius / bestsiteever:** entrenadores SRS de algoritmos con reconocimiento 2-sided y recap.
- **Timiks, Cubic Timer, CubeTime, Nexus Timer, Last Cube X:** timers móviles/alternativos.
- **Rubik's Trainer:** drills de cross/F2L.

### 7.9 Qué está commoditizado vs. qué sigue abierto

- **Commoditizado:** cronómetro + stats básicas + sesiones + scrambles WCA + SRS de algoritmos + reconstrucción/playback.
- **Abierto (oportunidad):** unificación de las 5 capas con un solo modelo de datos; análisis explicable a nivel de movimiento; detección automática del eslabón débil y generación de plan; SRS *alimentada por datos del cronómetro*; plataforma sin lock-in con sync y comunidad; cobertura multi-evento con análisis (no solo scrambles).

---

## 8. Inventario exhaustivo de necesidades de la comunidad

Cada necesidad lleva [fuente] y (tipo: E=explícita, I=implícita). La matriz de contraste (§13) cruza cada una con Cubalyze.

### 8.1 Timing y precisión

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 1 | Timer accesible en un toque/tecla, sin fricción | r/Cubers, PRD | E |
| 2 | Precisión de ms; parada al soltar (no al clic) | r/Cubers (cubetimer) | E |
| 3 | Modo inspección WCA (15s → +2, 17s → DNF) | WCA, csTimer | E |
| 4 | Multi-fase (splits) con tick sonoro por split | r/Cubers, csTimer | E |
| 5 | Parada automática exacta con smart cube (auto-stop) | SpeedSolving Cubeast | E |
| 6 | Start/stop por StackMat (audio) y timers BLE (QIYI/MoYu) | csTimer changelog, SpeedSolving | E |
| 7 | Gestos táctiles para OK/+2/DNF y prev/next scramble | csTimer | E |
| 8 | Elegir qué teclas inician/paran (any key / Ctrl+Ctrl) | csTimer | E |
| 9 | No confundir fuentes de timing (cubo vs teclado vs StackMat difieren ~0.75s) | Cubeast | I |
| 10 | Etiquetar y distinguir el origen del solve (smart/manual/stackmat) | Cubeast | I |

### 8.2 Organización y datos

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 11 | Sesiones ilimitadas, renombrar, reordenar | r/Cubers, csTimer | E |
| 12 | Merge/split de sesiones y **mover solves individuales** entre sesiones | SpeedSolving | E |
| 13 | Backup automático / sync en la nube (no manual) | r/Cubers (csTimer) | E |
| 14 | Import/export interoperable (csTimer, Twisty Timer, otros) sin perder datos | r/Cubers, csTimer | E |
| 15 | Aviso/auto-backup cada N solves | csTimer | E |
| 16 | Notas y comentarios por solve (y números en el comentario como métrica, p.ej. MBLD) | csTimer | E |
| 17 | Fecha/hora exacta por solve para análisis | csTimer | E |
| 18 | Multi-dispositivo con el mismo histórico (desktop+móvil) | r/Cubers "Which Timer" | E |

### 8.3 Estadísticas

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 19 | Ao5/Ao12/Ao100 y AoN arbitrario (mo3, ao30, ao42…) | csTimer, SpeedSolving | E |
| 20 | WPA/BPA (best/worst possible average) | csTimer | E |
| 21 | Target time: qué tiempo rompe el PB de la sesión | csTimer | E |
| 22 | Desviación estándar y consistencia | estándar | E |
| 23 | Historial filtrable (sesión, evento, método, rango de fechas) | PRD, csTimer | E |
| 24 | Distribución de tiempos, histograma, tendencia con zoom | VizCube, csTimer | E |
| 25 | Heatmap estilo GitHub de actividad | VizCube | E |
| 26 | Estadísticas cross-session | csTimer | E |
| 27 | Destacar PBs en la lista de tiempos | csTimer | E |
| 28 | Métricas por caso (ocurrencias, mejor/media de reconocimiento/ejecución por OLL/PLL…) | csTimer, Cubeast | E |
| 29 | Objetivos/metas de rendimiento trackeados ("sub-15") | r/Cubers goals | I |
| 30 | Rachas (streaks) de práctica | PRD | I |

### 8.4 Análisis de solves

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 31 | Splits por fase CFOP/Roux (y otros métodos) | Cubeast, csTimer | E |
| 32 | Reconocimiento vs ejecución por fase | Cubeast | E |
| 33 | TPS global y por fase | Cubeast, csTimer | E |
| 34 | Detección de pausas y su localización (reconocimiento vs lookahead) | Cubeast, VizCube | E |
| 35 | Conteo de rotaciones y coste en tiempo/movimientos | PRD, Cubeast | E |
| 36 | XCross/XXCross y skips detectados | Cubeast, csTimer | E |
| 37 | Detección color-neutral de la cruz (cualquier color) | SpeedSolving Cubeast | E |
| 38 | Comparación con la solución óptima del scramble | PRD | E |
| 39 | Reconstrucción automática a partir de los movimientos | Cubeast, CubeDB | E |
| 40 | Reconstrucción manual con comentarios por fase (y autocompletar algs) | CubeDB | E |
| 41 | Compartir el solve/replay por link | Cubeast, csTimer, CubeDB | E |
| 42 | Replay 3D con cámara libre, velocidad 0.25–4x, scrubbing | PRD, CubeDB | E |
| 43 | Comparar dos solves lado a lado | PRD | E |
| 44 | Video del último solve para revisar pausas | SpeedSolving, r/Cubers | E |
| 45 | Detectar el eslabón débil automáticamente y explicar por qué | acubemy, r/Cubers | I |

### 8.5 Entrenamiento

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 46 | Drill por caso (OLL/PLL/F2L/CMLL/EG…) | estándar | E |
| 47 | Reconocimiento por caso (quiz), incl. 2-sided PLL | r/Cubers | E |
| 48 | SRS/repetición espaciada (Anki-like) con estado por algoritmo | r/Cubers, Cubeast | E |
| 49 | Cross trainer (≤N movimientos, blind, color-neutral) | csTimer, r/Cubers | E |
| 50 | Entrenar reconocimiento desvinculado de ejecución | Cubeast, r/Cubers | E |
| 51 | Lookahead: metrónomo, blind drills, tracking de pares | r/Cubers metronome | E |
| 52 | BLD: timing memo vs ejecución, beeps de intervalo, encoder/helper | r/Cubers, csTimer | E |
| 53 | OH: modo/evento diferenciado | r/Cubers (categorías) | E |
| 54 | FMC: intento de 1h, notación, verificación | r/Cubers FMC | E |
| 55 | Entrenamiento por sub-paso avanzado (WVLS, ZBLL, COLL, LSE, EO, VLS…) | csTimer, PRD | E |
| 56 | Scrambles de entrenamiento filtrados por caso (incl. color-neutral) | csTimer, PRD | E |
| 57 | SRS alimentada por datos del cronómetro (si fallas el reconocimiento de un caso en solves reales, entra en la cola) | auditoría previa, Cubeast | I |
| 58 | Plan de entrenamiento adaptativo/por debilidad detectada | acubemy | I |
| 59 | Registrar "por qué fallo" en cada algoritmo | r/Cubers trainer | E |
| 60 | Seguimiento de progreso por caso/ejercicio a lo largo del tiempo | r/Cubers, csTimer | E |

### 8.6 Puzzles y eventos

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 61 | Todos los eventos WCA: 2×2–7×7, OH, 3BLD, FMC, Clock, Megaminx, Pyraminx, Skewb, Square-1, 4BLD/5BLD, MBLD | WCA, Twisty Timer, Last Cube X | E |
| 62 | Scrambles WCA correctos por evento (TNoodle-equivalentes) | estándar | E |
| 63 | Puzzles no-WCA (redi, kilominx, FTO, curvycopter, gear…) | csTimer | E (nicho) |
| 64 | Eventos personalizados (categorías propias) | r/Cubers | E |
| 65 | Distinguir OH de 3×3 normal (evento separado) | r/Cubers | I |

### 8.7 Algoritmos y métodos

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 66 | Catálogo OLL/PLL/F2L completo con variantes y votos | SpeedCubeDB | E |
| 67 | Sets avanzados: ZBLL, COLL, WV, VLS, CMLL, EG, CLL, ZBLS, LSLL… | SpeedCubeDB, PRD | E |
| 68 | Métodos: CFOP, Roux, ZZ, Petrus, LBL, Mehta, 1LLL | PRD, csTimer | E |
| 69 | Algoritmos propios del usuario (custom sets) | PRD, r/Cubers | E |
| 70 | Visualización 3D/2D de cada caso (no solo imagen estática) | PRD | E |
| 71 | Métricas de movimientos (HTM/STM/QTM) y dificultad | PRD | E |
| 72 | Enlace a vídeo/recursos por caso | PRD, SpeedCubeDB | E |
| 73 | Importar/exportar catálogos (AlgDB/SpeedCubeDB) para migrar | PRD | E |

### 8.8 Comunidad y motivación

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 74 | Compartir reconstrucciones con análisis | CubeDB, Cubeast | E |
| 75 | Comparación con la comunidad (anonimizada, opt-in) | PRD | E |
| 76 | Battles online / 1v1 / leaderboards | CubeStation, CubeDesk, csTimer | E |
| 77 | Logros/badges y streaks | PRD | I |
| 78 | Perfil público con solves | CubeDB | E |
| 79 | Retos/competiciones amistosas | CubeStation | E |

### 8.9 UX/UI y plataforma

| # | Necesidad | Fuente | Tipo |
|---|---|---|---|
| 80 | UI moderna y limpia (vs csTimer) | r/Cubers | E |
| 81 | Paridad móvil/escritorio sin perder features | SpeedSolving | E |
| 82 | Tema claro/oscuro y personalización | estándar | E |
| 83 | Onboarding que guíe al principiante | auditoría previa | I |
| 84 | Funciona offline, privado por defecto | PRD, Twisty Timer | E |
| 85 | Sin cuenta obligatoria para lo básico | CubeDesk crítica | I |
| 86 | Sin ads (o fáciles de quitar) | r/Cubers iOS | E |
| 87 | Accesibilidad (contraste AA, focus, lectores de pantalla) | PRD a11y | I |
| 88 | i18n multi-idioma | csTimer Crowdin | E |
| 89 | PWA instalable + app nativa de escritorio (BLE estable) | r/Cubers, PRD | E |
| 90 | Auto-updater de escritorio (con canal firmado) | PRODUCT.md | I |

---

## 9. Señal vs. ruido (priorización de la evidencia)

### 9.1 Necesidades ampliamente compartidas (señal fuerte — aparecen en ≥3 fuentes)

1. **Backup/sync automático de solves y configuración** (Reddit ×5 hilos, csTimer changelog, CubeDesk incidente). Es la causa nº 1 de retención y de miedo al cambio.
2. **Migración de datos sin fricción** (Reddit ×4, csTimer "import from other timers", VizCube nace de esto).
3. **UI moderna sin perder profundidad** (Reddit ×6, vídeos comparativos, CubeDesk como prueba de demanda).
4. **Análisis de fase con reconocimiento vs ejecución** (Cubeast, csTimer, r/Cubers, acubemy).
5. **SRS de algoritmos** (Reddit ×5, Cubeast Academy, SpeedCubeDB, OLL Genius, CubingApp, Lambro Trainer).
6. **Soporte multi-evento WCA** (Twisty Timer, Last Cube X, csTimer, CubeDesk — es tabla de entrada en móvil).
7. **Fiabilidad BLE (sin falsos +2, sin pérdida de movimientos)** (SpeedSolving Cubeast, Reddit ×3, csTimer changelog).
8. **Compartir reconstrucción/playback** (CubeDB, Cubeast, csTimer — estándar del ecosistema).
9. **Auto-stop con smart cube** (Cubeast, csTimer).
10. **Merge/mover solves entre sesiones** (SpeedSolving, csTimer changelog 2019, Reddit).

### 9.2 Peticiones repetidas pero de nicho medio

- **BLD memo/ejecución + beeps** (2 hilos Reddit + csTimer BLD helper): nicho BLD, estable en el tiempo.
- **Color neutrality: documentar el color del cross y entrenar por color** (4 hilos Reddit + csTimer color-neutral mode): relevante para intermedios/avanzados.
- **Metrónomo/lookahead** (3 hilos): herramienta auxiliar, opiniones divididas sobre eficacia.
- **Video del último solve** (SpeedSolving + r/Cubers): pedido recurrente pero con menos tracción que el análisis automático.
- **Battles/1v1/leaderboards** (CubeStation, CubeDesk, csTimer, r/Cubers): alta demanda en público casual/competitivo, depende de backend.

### 9.3 Problemas recurrentes (no "funciones", sino dolores)

- **Pérdida de datos** por caches/storage (csTimer 2017/2019, CubeDesk).
- **BLE lag → falsos +2** y detección de fase errónea (Cubeast).
- **Detección errónea de la cruz con color neutrality / solves no-CFOP** (Cubeast).
- **Batería/bricking de smart cubes** (Reddit ×3) — externo a la app pero afecta a la confianza.
- **Configuración del StackMat por mic/jack** (Reddit ×4) — dolor de setup.
- **Fragmentación de herramientas** (transversal) — el workflow exige 3-5 apps.

### 9.4 Opiniones aisladas (no priorizar sin más evidencia)

- "Metronome practice is not very effective" (un usuario) vs. "metronome is definitely useful" (otro) → la herramienta es neutra; el veredicto depende del usuario.
- "Color neutrality is overrated" (un hilo) vs. consenso dual-neutrality (varios) → matiz, no descarte.
- Preferencias de fuente de timing (StackMat puro vs cubo) → conviven, no compiten; lo importante es **no mezclarlas sin etiqueta**.

### 9.5 Funcionalidad de una sola app (no es estándar, puede ser diferencial)

- **Sistema de widgets flotantes con dock y persistencia** (Cubalyze, único).
- **Skill tree con XP/prerequisitos** (Cubalyze; parcialmente gamificado en CubeStation).
- **SRS alimentada por datos del cronómetro** (no existe en ningún competidor; csTimer/Cubeast la rozan con "métricas por caso").
- **Análisis explicable a nivel de movimiento** (acubemy lo promete; Cubeast lo roza).

---

## 10. Necesidades históricas y recientes (evolución del ecosistema)

Reconstruida principalmente del changelog de csTimer (2017→2025) y de hilos antiguos.

### 10.1 Históricas (ya resueltas por el mercado)

- **2013-2016:** precisión del timer (parar al soltar, no al clic); scrambles WCA por evento; imagen del scramble; estadísticas básicas (Ao5/Ao12/Ao100); sesiones. **Ya estándar.**
- **2017:** multi-fase y splits guardados por sesión; indicadores estadísticos personalizables (AoN arbitrario). **Estándar en csTimer; no universal.**
- **2018:** login WCA/Google y backup manual a la nube; soporte de más timers (MoYu) y smart cubes (Giiker). **El backup manual nunca dejó de ser un dolor.**
- **2019:** session manager completo (merge/split/group/reorder + CSV + import de otros timers). **Estándar en csTimer; los timers móviles lo tienen parcial.**
- **2021-2023:** BLD helper; battles online; playback y compartir de solves; virtual cube para todos los puzzles WCA; métricas por caso (OLL/PLL ocurrencias + reconocimiento/ejecución); target time; WPA/BPA. **Estas capacidades suben la barra para cualquier competidor.**

### 10.2 Recientes (2024-2026) — nuevas expectativas

- **Auto-stop y reloj interno del cubo** para eliminar el lag BLE (csTimer 2024 "built-in timer accuracy display"; Cubeast).
- **Color-neutral en scrambles de entrenamiento** (csTimer 2024) — entrenar con cualquier color como primera capa.
- **Scrambles por sub-paso cada vez más granulares** (EO cross, VLS, Mehta, FTO L3T, SQ1 CSP…) — el entrenamiento deliberado se ha vuelto el diferenciador de csTimer.
- **Compartir por link y perfiles sociales** (CubeDB 2021, csTimer playback 2023) — la comunidad quiere mostrar solves, no solo guardarlos.
- **IA/AI critique** (CubeDB "AI Cube Critique", acubemy) — primeros pasos de la crítica automática de solves; **aún nadie la hace explicable y ligada al dato del usuario**.
- **Timers móviles nuevos** (Last Cube X 2024-26, Cubic Timer) que ponen multi-evento + Material You como tabla de entrada en Android.
- **Preocupación por privacidad/trackers** en apps de fabricante (r/Cubers 2025 sobre CubeStation).

### 10.3 Lo que desapareció o nunca llegó

- La **sincronización automática** nunca se completó en csTimer (sigue manual); sigue siendo el hueco nº 1.
- Los **formatos de exportación unificados** nunca existieron; cada app reinventa su CSV/JSON (los usuarios usan IA para convertir).
- El **análisis cross-método unificado** (CFOP+Roux+ZZ en un solo modelo) nunca existió; cada app es CFOP-céntrica o single-method.

---

## 11. Necesidades nicho documentadas

Cada una responde: cuál es, quién la tiene, qué resuelve, evidencia, soporte del mercado y soporte de Cubalyze.

1. **BLD memo vs ejecución con beeps configurables.** Quién: blinders (3BLD/4BLD/5BLD/MBLD). Resuelve: medir y mejorar memo y ejecución por separado. Evidencia: r/Cubers "PlusTimer but with BLD mode" (2015); csTimer BLD helper. Mercado: csTimer (parcial), casi nadie en móvil. Cubalyze: **no** (solo "Blind Cross" drill y un metrónomo genérico).
2. **Documentar el color del cross por solve y entrenar color neutrality.** Quién: intermedios/avanzados dual-CN. Evidencia: 4+ hilos Reddit (2020-2026). Mercado: csTimer (color-neutral mode en scrambles de entrenamiento); nadie lo registra por solve de forma visible. Cubalyze: **parcial** (Cross Trainer CN existe; la detección color-neutral de la cruz existe en el análisis; falta persistir/mostrar el color por solve en stats).
3. **Entrenamiento 2-sided de PLL/OLL (reconocimiento desde 2 caras).** Quién: avanzados que compiten. Evidencia: r/Cubers (2021). Mercado: CubingApp, SpeedCubeDB, csTimer (Anti-PLL). Cubalyze: **parcial** (el subset Anti-PLL está sembrado como "2-sided recognition practice", pero no hay un modo específico 2-sided).
4. **FMC con intento de 1h, NISS/HTR y verificación.** Quién: especialistas de FMC. Evidencia: r/Cubers "Is there a FMC app?" (2017) → uso de stopwatch genérico; VFMC (2025). Mercado: VFMC, herramientas de HTR; ningún timer general. Cubalyze: **no**.
5. **Puzzles no-WCA (FTO, redi, kilominx, curvycopter, gear…).** Quién: coleccionistas y comunidad twisty. Evidencia: csTimer changelog (soporte masivo). Mercado: csTimer (único serio). Cubalyze: **no** (solo 2×2/3×3 reales).
6. **SQL/programabilidad de los datos propios.** Quién: cuber-dev / data nerds. Evidencia: VizCube expone SQLite. Mercado: VizCube (nicho). Cubalyze: **parcial implícito** (SQLite WASM local; no hay consola SQL expuesta).
7. **Métricas de ergonomía/RSI en sesiones largas.** Quién: usuarios con dolor de muñeca. Evidencia: auditoría previa (gap citado), comunidades de ergonomía. Mercado: nadie. Cubalyze: **no**.
8. **Simulación de presión competitiva WCA** (formato de ronda, Ao5 con corte, inspección estricta). Quién: competidores pre-competición. Evidencia: auditoría previa; StackMat como proxy. Mercado: csTimer (formatos parciales), nadie simula "rondas". Cubalyze: **parcial** (reglas WCA de inspección/penalidades; sin modo "ronda"/"corte").
9. **Entrenamiento por errores: registrar el error (pop, alg equivocado, fallo de reconocimiento) con clasificación semi-automática.** Quién: avanzados. Evidencia: PRD 11.2; Cubeast parcial. Mercado: nadie lo hace bien. Cubalyze: **parcial** (el análisis detecta pausas/rotaciones; no hay clasificación de errores ni feedback que alimente el entrenamiento).
10. **Perfil de entrenador con diagnóstico por alumno.** Quién: coaches (pocos, reales). Evidencia: implícita (no hay herramienta). Mercado: nadie. Cubalyze: **no**.
11. **Relays (2-5 cubos seguidos) y scrambles de relay.** Quién: práctica de resistencia. Evidencia: csTimer (scramble image for relays). Mercado: csTimer. Cubalyze: **no**.
12. **Generador de patrones (pattern solver).** Quién: FMC/teoría de grupos. Evidencia: csTimer (2024), Twizzle Pattern Searcher. Mercado: Twizzle, csTimer. Cubalyze: **no**.
13. **Import/export de sets de algoritmos propios** (compartir variantes). Quién: avanzados. Evidencia: PRD 10.2. Mercado: AlgDB/SpeedCubeDB export. Cubalyze: **parcial** (editor de algoritmos propios; sin export/import de sets).

---

## 12. Auditoría real de Cubalyze (verificación por código)

> Método: lectura directa de `apps/web/src`, `packages/*`, `apps/desktop`, `apps/api`. Estados: ✅ tiene / 🟡 parcial / ❌ no tiene / ⚠️ necesita verificación. Se corrige explícitamente la auditoría previa donde ya no coincide con el código actual.

### 12.1 Paquetes (estado verificado)

| Paquete | Estado | Nota verificada |
|---|---|---|
| `solver-engine` | ✅ | Min2Phase + RandomStateGenerator (3×3) + TwoByTwoScrambler/Solver (2×2) + PhaseSolver + CrossScrambleGenerator. **Solo 2×2 y 3×3.** |
| `analysis-engine` | ✅ | PhaseSplitter (CFOP color-neutral + XCross/XXCross/skips/pseudo-cross), métricas CFOP y Roux, TPS, pausas, rotaciones, eficiencia. **Fases solo CFOP/Roux.** |
| `algorithm-db` | ✅/🟡 | 8 métodos + ~33 subsets registrados; **sembrados** PLL(21), OLL(57), F2L(41+126), Ortega OLL/PBL, COLL(40), WV(27), SV(27), CLS(95), ELL(25), Anti-PLL(22). **VACÍOS (registrados sin seed): CMLL, LSE, First/Second Block, OCLL, ZZLL, ZBLL, CLL(2×2), EG-1, EG-2.** |
| `training` | ✅ | FSRS-4 real, catálogo de ejercicios derivado de métodos+subsets, session engine, scheduler, SRS insights. |
| `hardware-hal` | ✅ | GAN cube + GAN timer (BLE), StackMat (audio), ClockDriftReconciler. **Solo GAN + StackMat.** |
| `timer-engine` | ✅ | Máquina de estados WCA (inspección 15s→+2/17s→DNF, hold-to-start, smart-cube start/stop, safety nets). |
| `statistics` | ✅ | Ao5/12/100 (trim 5% para N grandes), std dev, BPA/WPA, `averageOf(n)` genérico. |
| `database` | ✅ | SQLite WASM (OPFS), migraciones versionadas. |
| `cube-3d-engine` | ✅ | Motor 3D, replay, giroscopio, worker. |
| `ai-core`, `sync-engine`, `apps/api` | ❌ | **Solo `package.json`** (vacíos). |

### 12.2 Vistas y funcionalidad (verificado)

| Elemento | Estado | Evidencia |
|---|---|---|
| Timer (inspección, +2/DNF, focus mode, PB celebration, scramble en vivo) | ✅ | `App.tsx`, `TimerEngine`, `useSolveSession` |
| Vistas: Timer, Training, Algorithms, Skills, Stats/Insights, Reconstructions, Cube, Profile | ✅ | `views/` (7 vistas; **Reconstructions y Profile ya existen**, la auditoría previa no las contaba) |
| Onboarding guiado | ✅ | `components/Onboarding/` + `useOnboarding` (6 pasos, one-shot, replayable) — **corrige auditoría previa (decía que no existía)** |
| Perfil local (avatar/identicon, nombre, preferencias, stats) | ✅ | `views/Profile`, `useProfile`, `useProfileStats`, `ProfileSection` — **local-only, sin cuenta** |
| Skill tree (grafo, XP, prerequisitos, categorías incl. BLD/FMC/hardware/psicología/teoría) | ✅ | `views/SkillTree` |
| Entrenamiento (Drill, Recognize, Cross Trainer ≤8/CN, Blind, LSE sub-fases, EO detect/eff, SRS FSRS-4, Full Solve, Phase Stats, Calendar) | ✅ | `views/Training/*` + `packages/training` |
| Import/Export | ✅ | `importSolves.ts` (csTimer CSV/header-CSV/JSON, Twisty Timer, Cubalyze CSV/JSON, CSV/TSV genérico); `exportSolves.ts` (Cubalyze CSV, csTimer CSV, JSON, XLSX) |
| Widgets (dock, drag&drop, persistencia) | ✅ | 11 implementaciones: times-log, time-distribution, pb-progression, phase-balance, solve-timeline, scramble-2d, cube-button(3D), metronome, notes, algorithm-db, layout-organizer |
| Settings | ✅ | 14 secciones (General, Appearance, Smart Cube, Timer, Scramble, Analysis, Training, Notifications, Shortcuts, Data, Advanced, Profile, Audio, Credits) |
| i18n EN/ES | ✅ | `i18n/locales/en.json`, `es.json` |
| PWA instalable + offline | ✅ | `main.tsx`, boot, SQLite OPFS |
| Desktop Tauri (BLE nativo, reusa web) | ✅ | `apps/desktop/src-tauri` (Cargo, tauri.conf); auto-updater deshabilitado (PRODUCT.md) |
| Reconstrucciones (dataset CubeRoot/reco.nz/WCA ~14.565 solves) | ✅ | `views/Reconstructions`, `apps/web/public/reconstructions` |
| Cuenta/auth | ❌ | búsqueda `auth|login|signup` → solo falsos positivos (`author`) |
| Sync/cloud | ❌ | `sync-engine` vacío; sin código de sync de datos |
| AI Coach | ❌ | `ai-core` vacío |
| Backend/API | ❌ | `apps/api` vacío |
| Video del solve | ❌ | sin `MediaRecorder`/`getUserMedia`; solo enlaces `videoUrl` externos en reconstrucciones |
| Compartir solve/replay por link | ❌ | Replay 3D existe; sin generación de link |
| Comunidad/comparación/battles | ❌ | sin backend |
| Logros/badges | 🟡 | Skill tree tiene XP; sin sistema de logros separado |
| Metas de rendimiento ("sub-15") | 🟡 | Calendar tasks existen; sin metas de rendimiento |
| Streaks | 🟡 | heatmap/calendario de actividad; sin streak explícito |
| Beeps/config BLD | 🟡 | metrónomo genérico; sin perfiles BLD |
| StackMat UI completa | 🟡 | adapter de audio existe; la UX de conexión es la misma de BLE |
| Tests | ✅ | 177 archivos de test (apps+packages); análisis previo decía 103 |

### 12.3 Hallazgo crítico — puzzles "fantasma" (falsa apariencia)

`puzzleUtils.ts` documenta explícitamente:

> "Only 2×2 and 3×3 are fully functional right now; other categories fall back to the 3×3 scramble generator (safe default, no breakage)."

Consecuencias verificadas:
- El selector de puzzles muestra **4×4, 5×5, 6×6, 7×7, 3×3 OH, Megaminx, Pyraminx, Skewb**, pero `generateScrambleFor()` devuelve un **scramble de 3×3** para todos salvo 2×2.
- `puzzleCategoryToType()` mapea todos ellos a `"3x3x3"` (excepto 2×2/3×3/OH→3×3×3), por lo que los solves se guardan como **3×3×3** y se mezclan con los de 3×3 normal.
- **3×3 OH se guarda indistinguible de 3×3 normal** (mismo `puzzle_type`), así que el evento OH no existe de facto como categoría de datos.
- No existen Clock, Square-1, BLD ni FMC en el selector.

Esto es exactamente el caso que el encargo pide detectar: **"existe el nombre en la UI" ≠ "la necesidad está resuelta"**.

### 12.4 Hallazgo — subsets de algoritmos vacíos

`methodRegistry.ts` registra CMLL (Roux), CLL (2×2), EG-1/EG-2, ZBLL, OCLL, ZZLL, LSE, First/Second Block; el catálogo de entrenamiento (`catalog.ts`) genera ejercicios Drill/Recognize para ellos; pero `seed/index.ts` **no importa ningún archivo seed para esos subsets**. Resultado: los métodos CLL/EG y la fase CMLL aparecen navegables con drills, pero **sin algoritmos sembrados** (vacíos salvo que el usuario añada los suyos). ZBLL está registrado pero no sembrado (el PRD lo promete como contenido futuro).

### 12.5 Correcciones a la auditoría anterior (Agosto 2026)

1. **Onboarding SÍ existe** (tour de 6 pasos; la auditoría anterior decía que no).
2. **Perfil local SÍ existe** (avatar/identicon/nombre/prefs/stats; la auditoría anterior lo daba por inexistente).
3. **Vista Reconstructions existe** y es completa (la anterior no la listaba en navegación).
4. El catálogo de algoritmos es **más amplio** que "F2L/OLL/PLL/Ortega": incluye COLL, WV, SV, CLS, ELL, Anti-PLL sembrados.
5. Los tests pasaron de 103 a **177 archivos**.

---

## 13. Contraste necesidad ↔ Cubalyze (matriz completa)

Leyenda: ✅ tiene · 🟡 parcial/insuficiente · ⚠️ aparente (nombre en UI, verificar) · ❌ no tiene. Los números remiten a §8.

### 13.1 Timing y precisión

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 1 | Timer un toque | ✅ | timer centrado, atajos, hold-to-start |
| 2 | Precisión ms, parada al soltar | ✅ | TimerEngine con performance.now() |
| 3 | Inspección WCA | ✅ | 15s→+2, 17s→DNF (`WcaRules`) |
| 4 | Multi-fase (splits) | ❌ | sin splits manuales del cronómetro (los splits de fase son del análisis de smart cube/replay) |
| 5 | Auto-stop smart cube | ✅ | `handleSmartCubeStop` + análisis de estado resuelto |
| 6 | StackMat + timers BLE | 🟡 | StackMat por audio ✅; QIYI/MoYu timer ❌ |
| 7 | Gestos táctiles OK/+2/DNF | 🟡 | hay confirmación de solve; sin gestos específicos |
| 8 | Elegir teclas start/stop | 🟡 | atajos configurables; no "any key/Ctrl+Ctrl" fino |
| 9 | No mezclar fuentes de timing | ✅ | `Solve.source` (smart/manual/virtual) persistido |
| 10 | Etiquetar origen del solve | ✅ | fuente persistida y visible |

### 13.2 Organización y datos

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 11 | Sesiones ilimitadas, renombrar | ✅ | `usePersistentSession` (crear/renombrar/borrar/cambiar) |
| 12 | Merge/split y mover solves | 🟡 | sesiones existen; **mover solves individuales no está expuesto** |
| 13 | Backup/sync automático | ❌ | solo export manual (JSON/CSV/XLSX); `sync-engine` vacío |
| 14 | Import/export interoperable | ✅ | csTimer (3 formatos), Twisty Timer, CSV/TSV genérico, XLSX, JSON full-fidelity |
| 15 | Auto-backup cada N solves | ❌ | sin recordatorio (csTimer lo tiene) |
| 16 | Notas/comentarios por solve | ✅ | `note` persistido; sin "número como métrica" (MBLD) |
| 17 | Fecha/hora por solve | ✅ | `timestamp` persistido |
| 18 | Multi-dispositivo | ❌ | sin cuenta/sync |

### 13.3 Estadísticas

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 19 | Ao5/12/100 y AoN | 🟡 | Ao5/12/100 ✅; `averageOf(n)` genérico en el paquete pero la UI expone el set estándar |
| 20 | WPA/BPA | ✅ | `computeBpaWpa` |
| 21 | Target time (romper PB) | ❌ | no implementado |
| 22 | Desviación estándar | ✅ | `stdDeviation` |
| 23 | Historial filtrable | ✅ | filtros sesión×puzzle |
| 24 | Distribución/histograma/tendencia | ✅ | Overview + widgets (time-distribution, pb-progression) |
| 25 | Heatmap estilo GitHub | ✅ | heatmap de actividad en Overview |
| 26 | Cross-session stats | 🟡 | sin herramienta explícita cross-session |
| 27 | Destacar PBs en la lista | ✅ | lista de tiempos con PBs |
| 28 | Métricas por caso (reconocimiento/ejecución) | ❌ | el análisis de fases existe, pero **no hay estadística agregada por caso OLL/PLL** desde solves |
| 29 | Metas de rendimiento | 🟡 | calendar tasks; sin metas "sub-15" con seguimiento |
| 30 | Streaks | 🟡 | calendario/heatmap; sin streak explícito |

### 13.4 Análisis de solves

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 31 | Splits CFOP/Roux | ✅ | `PhaseSplitter` + métricas CFOP/Roux |
| 32 | Reconocimiento vs ejecución | ✅ | reconocimiento estimado por fase: `ollRecognitionMs`/`pllRecognitionMs` (CFOP) y `cmllRecognitionMs` (Roux) = gap entre el último move de la fase anterior y el primero de la fase, mostrados en el panel (`OLL Recog`/`PLL Recog`/`CMLL Recog`); por par F2L vía `pauseBeforeMs`. El `recognitionMs: 0` del `PhaseSegment` genérico de `PhaseSplitter` es un campo distinto, por diseño — ver `Fase0_Normalizacion_SliceWide_2026-08.md` §7 |
| 33 | TPS global y por fase | ✅ | `TPSCalculator`, panel de análisis |
| 34 | Pausas localizadas | ✅ | `PauseDetector` + timeline con marcas de pausa |
| 35 | Rotaciones y coste | ✅ | `RotationCounter` |
| 36 | XCross/XXCross/skips | ✅ | detección en `PhaseSplitter` (xcross/xxcross/xxxcross, OLL/PLL skip) |
| 37 | Cruz color-neutral | ✅ | `ColorPhaseDetector` (cualquier color en cualquier cara) |
| 38 | Comparación con óptimo | ✅ | `EfficiencyCalculator.solveOptimal` resuelve el scramble con Min2Phase (`Min2PhaseSolver`) y el panel muestra `Efficiency {moveEfficiencyRatio} · opt={optimalMoveCount}m` (`SolveAnalysisPanel` → `RotEfficiencySection`); ruta smart vía `analyzeSolve` |
| 39 | Reconstrucción automática | ✅ | pipeline `analyzeSolve` sobre movimientos del smart cube/virtual |
| 40 | Reconstrucción manual con comentarios | 🟡 | hay dataset de recons externas con comentarios; **sin editor de reconstrucción manual propio** |
| 41 | Compartir solve por link | ❌ | sin generación de link |
| 42 | Replay 3D (cámara, velocidad, scrubbing) | ✅ | `ReplaySection` + motor 3D |
| 43 | Comparar dos solves lado a lado | ❌ | motor preparado en PRD; no expuesto |
| 44 | Video del solve | ❌ | sin captura de vídeo |
| 45 | Detectar eslabón débil y explicar | ❌ | análisis existe pero **no hay capa de "diagnóstico/plan"** (eso sería el AI Coach) |

### 13.5 Entrenamiento

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 46 | Drill por caso | ✅ | `AlgorithmDrillView` + subsets |
| 47 | Reconocimiento por caso | ✅ | `AlgorithmRecognizeView` |
| 48 | SRS | ✅ | FSRS-4 real (`progress/`) — por encima del estándar |
| 49 | Cross trainer (≤N, blind, CN) | ✅ | `CrossTrainerView` (Plain/Blind/≤8/CN) |
| 50 | Reconocimiento desvinculado de ejecución | ✅ | Recognize view separada del Drill |
| 51 | Lookahead (metrónomo, blind) | 🟡 | metrónomo widget + blind drills; **sin drill estructurado de tracking de pares** |
| 52 | BLD memo/ejecución + beeps | ❌ | solo Blind Cross drill; sin modo BLD ni beeps |
| 53 | OH diferenciado | ❌ | OH existe en selector pero se guarda como 3×3×3 |
| 54 | FMC | ❌ | sin modo |
| 55 | Sub-paso avanzado | 🟡 | COLL/WV/SV/CLS/ELL/Anti-PLL sembrados; **ZBLL/CMLL/CLL/EG/OCLL/ZZLL vacíos**; sin LSLL/ZBLS/Mehta |
| 56 | Scrambles de entrenamiento por caso | ✅ | `generateRandomSetup` + generadores; **sin color-neutral en setup** (lo tiene csTimer) |
| 57 | SRS alimentada por datos del cronómetro | ❌ | la SRS se alimenta de drills; **no del reconocimiento en solves reales** |
| 58 | Plan adaptativo | ❌ | sin IA |
| 59 | Registrar "por qué fallo" en un alg | 🟡 | grading SRS (again/hard/good/easy); sin texto libre de motivo |
| 60 | Progreso por caso a lo largo del tiempo | ✅ | Phase Stats, SRS Insights, historial de attempts |

### 13.6 Puzzles y eventos

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 61 | Todos los eventos WCA | ❌ | solo 2×2/3×3 reales (ver §12.3) |
| 62 | Scrambles WCA por evento | 🟡 | 2×2/3×3 random-state ✅; resto ❌ |
| 63 | Puzzles no-WCA | ❌ | — |
| 64 | Categorías personalizadas | ❌ | sin categorías custom |
| 65 | OH como evento separado | ❌ | se guarda como 3×3×3 |

### 13.7 Algoritmos y métodos

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 66 | Catálogo OLL/PLL/F2L completo | ✅ | sembrado y verificado contra SpeedCubeDB |
| 67 | Sets avanzados | 🟡 | COLL/WV/SV/CLS/ELL/Anti-PLL ✅; ZBLL/CMLL/CLL/EG/OCLL/ZZLL ❌ (vacíos) |
| 68 | Métodos CFOP/Roux/ZZ/Petrus/… | 🟡 | CFOP/Roux/ZZ/Petrus/Ortega/CLL/EG con fases; Mehta/LBL/1LLL ❌ |
| 69 | Algoritmos propios | ✅ | editor de algoritmos propios |
| 70 | Visualización 3D/2D por caso | ✅ | diagramas 2D/3D por caso |
| 71 | Métricas de movimientos | ✅ | `moveMetrics` (HTM/STM/QTM) |
| 72 | Enlace a vídeo por caso | ❌ | no hay campo de vídeo por algoritmo |
| 73 | Import/export de catálogos | ❌ | solo solve data, no sets de algs |

### 13.8 Comunidad y motivación

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 74 | Compartir reconstrucción | ❌ | sin link/perfil público |
| 75 | Comparación con comunidad | ❌ | — |
| 76 | Battles/1v1/leaderboards | ❌ | — |
| 77 | Logros/badges y streaks | 🟡 | XP del skill tree; sin logros/streaks |
| 78 | Perfil público | ❌ | perfil local only |
| 79 | Retos amistosos | ❌ | — |

### 13.9 UX/UI y plataforma

| # | Necesidad | Cubalyze | Detalle |
|---|---|---|---|
| 80 | UI moderna | ✅ | design system propio (bone-white/carbon) |
| 81 | Paridad móvil/escritorio | ✅ | bottom tab bar, sheets, safe-areas; PWA + Tauri |
| 82 | Tema claro/oscuro | ✅ | theme-provider |
| 83 | Onboarding | ✅ | tour 6 pasos |
| 84 | Offline, privado | ✅ | SQLite local, sin servidor |
| 85 | Sin cuenta obligatoria | ✅ | no hay cuenta |
| 86 | Sin ads | ✅ | no hay ads |
| 87 | Accesibilidad | 🟡 | tokens AA y aria-live parciales; sin auditoría a11y formal |
| 88 | i18n | ✅ | EN/ES completos |
| 89 | PWA + desktop | ✅ | ambos; desktop Tauri con BLE nativo |
| 90 | Auto-updater escritorio | ❌ | deshabilitado (falta canal firmado) |

---

## 14. Bugs, riesgos y falsas apariencias detectados

1. **Puzzles fantasma (crítico).** 4×4–7×7, Megaminx, Pyraminx y Skewb aparecen en el selector pero generan scramble 3×3 y guardan como 3×3×3. Un usuario que elija "Pyraminx" cronometra un 3×3 sin saberlo. → *Prioridad: o implementar scrambles reales por evento, o deshabilitar/etiquetar "próximamente" los no implementados.*
2. **3×3 OH indistinguible.** Se persiste como `3x3x3`; las medias/times de OH se mezclan con 3×3 normal salvo que el usuario cree una sesión aparte manualmente. → *Persistir `puzzle_type`/evento propio para OH.*
3. **Subsets vacíos (apariencia).** CMLL, CLL, EG-1/EG-2, ZBLL, OCLL, ZZLL, LSE y First/Second Block están registrados y generan drills, pero no tienen algoritmos sembrados. Los métodos CLL/EG y la fase CMLL pueden mostrarse vacíos. → *Sembrar o marcar como "custom-only".*
4. **~~`recognitionMs` fijado a 0~~ → CORREGIDO (verificado 2026-08-14).** La observación literal solo es cierta para el campo genérico `PhaseSegment.recognitionMs` de `PhaseSplitter.buildSegments` (0 por diseño, campo distinto). El reconocimiento **sí se estima** exactamente como proponía esta auditoría (gap entre el último move de la fase anterior y el primero de la fase): `ollRecognitionMs`/`pllRecognitionMs` (CFOP) y `cmllRecognitionMs` (Roux) en `CFOPMetricsCalculator.ts` / `RouxMetricsCalculator.ts`, y se muestran en el panel de análisis (`OLL Recog`/`PLL Recog`/`CMLL Recog`). Por par F2L, `pauseBeforeMs` ≈ reconocimiento del par (falta restar ~100 ms de ejecución de turno; mejora ya propuesta en `plan_analysis_unification`).
5. **~~Comparación con solución óptima no expuesta~~ → CORREGIDO (verificado 2026-08-14).** La métrica "moves vs óptimo por solve" **sí está expuesta**: `EfficiencyCalculator.compute` resuelve el scramble con `Min2PhaseSolver` (`EfficiencyCalculator.solveOptimal`) y el panel muestra `Efficiency {ratio} · opt={N}m` (`RotEfficiencySection`); la ruta smart la calcula vía `analyzeSolve` → `MetricsAggregator`. El Cross Trainer también muestra el óptimo real de la cruz (solver `PhaseSolver` sobre estados generados con min2phase). Matiz honesto: la **detección de fases** (límites Cross/F2L/OLL/PLL) es heurística por geometría de stickers (`ColorPhaseDetector`), no min2phase — min2phase alimenta la comparación con el óptimo que se muestra, no la segmentación. Y `crossEfficiency` del panel sigue siendo heurística (÷8); el óptimo real por fase está propuesto como mejora M1 en `plan_analysis_unification`.
6. **`theme-color` del PWA** fijado a `#0f172a` (bug heredado documentado en la auditoría previa) — el color de la barra del navegador no sigue el tema.
7. **Falsa apariencia de video en el skill tree.** El nodo "Video record solves and count pause frames between steps" describe una habilidad, no una funcionalidad: **no hay captura de vídeo** (solo enlaces `videoUrl` externos en reconstrucciones).
8. **Riesgo de licencias GPL.** csTimer/cubing.js/tnoodle son GPLv3; cualquier integración directa (p. ej. adaptadores MoYu/QiYi copiados de csTimer) arrastra obligaciones. El proyecto ya lo advierte (PRD Parte 17, DATA_SOURCES).
9. **Riesgo de arquitectura de cuenta.** Sin decisión tomada entre ID anónimo local-first vs email. Todo lo que dependa de identidad (sync, AI, comunidad) está bloqueado por esta decisión.
10. **Riesgo de costes de IA.** El AI Coach requiere LLM; sin fallback local determinista rompería la promesa offline-first.

---

## 15. Revisión final y conclusiones

### 15.1 Qué quiere la comunidad (síntesis final)

1. **Un timer sin fricción y a prueba de pérdidas** (sync/backup es la necesidad nº 1 no resuelta del ecosistema).
2. **Análisis que diga el porqué** (reconocimiento vs ejecución, pausas, fase débil) — no solo "eres lento en F2L".
3. **Entrenamiento deliberado con SRS** por micro-habilidad, idealmente **conectado a los datos reales del cronómetro** (ningún competidor lo hace).
4. **Todos sus puzzles/eventos WCA**, con scrambles correctos.
5. **Llevarse y traer sus datos** sin fricción.
6. **Comunidad**: compartir el solve/replay y, en segundo plano, comparación/battles.

### 15.2 Qué tiene Cubalyze (real, verificado)

- Núcleo técnico **superior a la media** en 3×3/2×2: timer WCA, smart cube GAN + StackMat con corrección de deriva, análisis de fases color-neutral con XCross/skips, FSRS-4, catálogo de algoritmos verificado, motor 3D, widgets, perfil local, onboarding, import/export amplio, i18n, PWA+Tauri, 177 archivos de test.

### 15.3 Qué tiene parcialmente (con la carencia exacta)

- **Análisis**: sin reconocimiento vs ejecución por fase, sin comparación con óptimo, sin métricas por caso.
- **Entrenamiento**: sets avanzados a medias (vacíos), sin lookahead estructurado, sin plan adaptativo.
- **Estadísticas**: sin AoN en UI, sin target-time, sin cross-session.
- **Hardware**: solo GAN + StackMat; sin MoYu/QiYi/Giiker ni timers BLE de terceros.
- **Sesiones**: sin mover solves individuales.
- **Motivación**: skill tree sin conectar al entrenamiento; sin logros/streaks/metas de rendimiento.

### 15.4 Qué le falta (por orden de impacto)

| Prioridad | Bloque | Justificación |
|---|---|---|
| P0 | **Cuenta/sync/backend mínimo** | desbloquea multi-dispositivo, AI y comunidad; es la necesidad nº 1 del ecosistema |
| P0 | **Cobertura WCA real** (empezando por desactivar los puzzles fantasma) | hoy 4×4–7×7/Megaminx/Pyraminx/Skewb mienten al usuario; OH no se distingue |
| P0 | **BLD (memo/ejecución + beeps) y OH** | los más demandados tras 3×3/2×2 |
| P1 | **Reconocimiento vs ejecución + métricas por caso + comparación con óptimo** | el diferenciador que ya valida el mercado (Cubeast) y que Cubalyze aún no entrega |
| P1 | **AI Coach explicable** sobre el analysis-engine ya existente | diferenciador de marketing; debe ser trazable al dato |
| P1 | **Compartir solve/replay por link** | estándar del ecosistema (CubeDB/Cubeast/csTimer) |
| P2 | **Sembrar subsets vacíos** (CMLL/CLL/EG/ZBLL/OCLL/ZZLL) | coherencia entre catálogo y contenido |
| P2 | **Metas de rendimiento, streaks, logros** | motivación/retención |
| P2 | **Video del solve** | pedido recurrente |
| P3 | **Mover solves entre sesiones, target-time, AoN, cross-session** | calidad de vida |

### 15.5 Veredicto en una frase

Cubalyze tiene **el motor que el mercado no unifica** y una ejecución técnica de alto nivel para 3×3/2×2 CFOP/Roux; lo que le falta no es otro motor, sino **no prometer lo que aún no hace (puzzles fantasma, subsets vacíos, reconocimiento vs ejecución)** y construir la capa de plataforma (cuenta+sync), la cobertura WCA real y el diagnóstico explicable que conviertan el motor en un producto.

---

## 16. Referencias

**Reddit (hilos clave, vía snippets de búsqueda):**
- "What's the best alternative to CS Timer?" — https://www.reddit.com/r/Cubers/comments/17gtigu/
- "Which Timer you use and why?" — https://www.reddit.com/r/Cubers/comments/1p5jjk9/
- "What makes CS timer better than Cubedesk?" — https://www.reddit.com/r/Cubers/comments/1hqwfpn/
- "CubeDesk vs CStimer" — https://www.reddit.com/r/Cubers/comments/1rh2a85/
- "Better than CS Timer" — https://www.reddit.com/r/Cubers/comments/1e8gvax/
- "A new CSTimer" — https://www.reddit.com/r/Cubers/comments/1jummf5/
- "Let's be honest, csTimer is bad" — https://www.reddit.com/r/Cubers/comments/wcs5cr/
- "Cstimer SUCKS!!!!" — https://www.reddit.com/r/Cubers/comments/1qyr5is/
- "What's your favorite and least favorite thing about cstimer?" — https://www.reddit.com/r/Cubers/comments/1r3zyyv/
- "What are some complaints you have about your speedcubing timer" — https://www.reddit.com/r/Cubers/comments/1ct3u3j/
- "Some Features that would be really cool on Cs Timer" — https://www.reddit.com/r/Cubers/comments/slyqdx/
- "Did anyone else lose their solves/sessions on cstimer" — https://www.reddit.com/r/Cubers/comments/7k7en1/
- "What happened to csTimer??!" — https://www.reddit.com/r/Cubers/comments/czp3o5/
- "Question about CS Timer and stat tracking" — https://www.reddit.com/r/Cubers/comments/1k1exqh/
- "Import not working!" — https://www.reddit.com/r/Cubers/comments/1t1q52g/
- "Describe your perfect alg trainer" — https://www.reddit.com/r/Cubers/comments/1hgkw1j/
- "A smart alg trainer?" — https://www.reddit.com/r/Cubers/comments/1g78ohv/
- "Tutorial Learn algs efficiently with Anki" — https://www.reddit.com/r/Cubers/comments/1de51ih/
- "New Speedcubing Training Software" — https://www.reddit.com/r/Cubers/comments/mrc7lx/
- "Android cube timer app features" — https://www.reddit.com/r/Cubers/comments/35rxia/
- "What features would be worth including in a cube timer?" — https://www.reddit.com/r/Cubers/comments/i001h5/
- "What features would you like to see in a cube timer app?" — https://www.reddit.com/r/Cubers/comments/1s4i88m/
- "Best timer for ios?" — https://www.reddit.com/r/Cubers/comments/1bbu386/
- "Best iOS cube timer ?" — https://www.reddit.com/r/Cubers/comments/1lrhmuw/
- "Everyone should own a smart cube" — https://www.reddit.com/r/Cubers/comments/1f6cxrx/
- "Questions about smart cubes" — https://www.reddit.com/r/Cubers/comments/1h3zldv/
- "What Smart Cube has the best App?" — https://www.reddit.com/r/Cubers/comments/1qab2bl/
- "Are smart cubes worth it?" — https://www.reddit.com/r/Cubers/comments/1o0pnxy/
- "I reverse engineered the QiYi smartcube protocol!" — https://www.reddit.com/r/Cubers/comments/1dkgu8b/
- "Gan 12 ui not charging or connecting" — https://www.reddit.com/r/Cubers/comments/1muiga9/
- "How safe is the CubeStation app" — https://www.reddit.com/r/Cubers/comments/1lsb2os/
- "How do you track your times?" — https://www.reddit.com/r/Cubers/comments/3ew9ti/
- "What are your cubing goals for 2024?" — https://www.reddit.com/r/Cubers/comments/18w16k5/
- "How to improve at cross?" — https://www.reddit.com/r/Cubers/comments/1t3oxm0/
- "Does anyone else find practicing f2l to a metronome impossible" — https://www.reddit.com/r/Cubers/comments/1ltiqzf/
- "Is there a FMC app?" — https://www.reddit.com/r/Cubers/comments/6iwggy/
- "Introducing... CubeDB" — https://www.reddit.com/r/Cubers/comments/jemo4o/
- "new version of cubedb, now supports profiles and socials!" — https://www.reddit.com/r/Cubers/comments/psllcd/
- "Automatic Solve Critiques - CubeDB.net" — https://www.reddit.com/r/Cubers/comments/uwm61g/

**SpeedSolving:**
- "Making a Cube Timer Site — Ideas Needed" — https://www.speedsolving.com/threads/77687/
- "Cubeast — a speedcubing timer for Bluetooth cubes" — https://www.speedsolving.com/threads/77406/
- "VizCube — Fun and helpful way to visualize solves" — https://www.speedsolving.com/threads/92835/
- "csTimer released" (changelog) — https://www.speedsolving.com/threads/36236/
- "the DB in cubedb" — https://www.speedsolving.com/threads/85427/
- "CubeDB.net is back" — https://www.speedsolving.com/threads/92383/
- "What cubing timer should I get for my phone?" — https://www.speedsolving.com/threads/91072/
- "Official GAN 356i discussion / issues report" — https://www.speedsolving.com/threads/74825/

**Sitios oficiales y stores:**
- csTimer — https://cstimer.net/ · Cubeast — https://www.cubeast.com/ · CubeDesk — https://cubedesk.io/ · CubeDB — https://cubedb.net/ · SpeedCubeDB — https://speedcubedb.com/ · cubing.js — https://github.com/cubing/cubing.js/ · TNoodle — https://github.com/thewca/tnoodle
- Google Play: Twisty Timer (com.aricneto.twistytimer), GAN Cube Station (com.gan.cubestation), Last Cube X (com.lastcube.client.android) · App Store: CubeStation NEW, OLL Genius

**Wikis:** r/Cubers — timing_programs, smart_cubes, cstimer, how_to_improve, improving_bld, improving_fmc (https://www.reddit.com/r/Cubers/wiki/)

**Documentación interna del proyecto:** `docs/00-product/PRD.md`, `docs/00-product/Auditoria_Producto_2026-08.md`, `docs/01-roadmap/Master_Roadmap.md`, `PRODUCT.md`, `DATA_SOURCES.md`.

---

*Fin del documento. Generado el 13 de agosto de 2026 mediante investigación web (Reddit, SpeedSolving, stores, wikis y sitios oficiales) y auditoría por lectura directa del código de Cubalyze.*
