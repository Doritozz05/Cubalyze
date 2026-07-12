
# CubeForge — Plataforma Profesional de Speedcubing

### Documento Maestro de Producto, Arquitectura y Diseño

**Versión 1.0 — Julio 2026**
*Tipo de documento: Product Requirements Document (PRD) + Software Architecture Document (SAD) + Game/Product Design Document (GDD)*

---

## ÍNDICE

- **PARTE 0 — Investigación y Ecosistema**
  - 0.1 Metodología de investigación
  - 0.2 Mapa del ecosistema actual
  - 0.3 Herramientas, motores y librerías relevantes
  - 0.4 Protocolos de cubos inteligentes
  - 0.5 Marco regulatorio (WCA)
- **PARTE 1 — Estudio Competitivo (Benchmark)**
- **PARTE 2 — Filosofía y Principios del Producto**
- **PARTE 3 — Visión de Producto y Pilares**
- **PARTE 4 — Arquitectura de Software**
  - 4.1 Vista general
  - 4.2 Frontend
  - 4.3 Backend / Servicios
  - 4.4 Sistema de eventos y sincronización
  - 4.5 Sistema de plugins
  - 4.6 Offline-first y sincronización
  - 4.7 Seguridad, versionado y despliegue
- **PARTE 5 — Integración con Smart Cubes**
- **PARTE 6 — Motor de Cubo 3D en Tiempo Real**
- **PARTE 7 — Motor de Resolución (Solver Engine)**
- **PARTE 8 — Sistema de Análisis en Tiempo Real**
- **PARTE 9 — Sistema de Entrenamiento**
- **PARTE 10 — Base de Datos de Algoritmos**
- **PARTE 11 — Sistema de Tracking y Estadísticas**
- **PARTE 12 — Sistema de Timers**
- **PARTE 13 — Sistema de Inteligencia Artificial**
- **PARTE 14 — UX / UI**
- **PARTE 15 — Modelo de Datos**
- **PARTE 16 — Roadmap por Fases**
- **PARTE 17 — Referencias, Repositorios y Bibliografía**

---

# PARTE 0 — INVESTIGACIÓN Y ECOSISTEMA

## 0.1 Metodología de investigación

Antes de proponer una sola pantalla o tabla de base de datos, se ha realizado un barrido del ecosistema de software y hardware de speedcubing existente: timers web, apps móviles, apps de escritorio, solvers matemáticos, protocolos de hardware Bluetooth de fabricantes, librerías de visualización 3D, y la infraestructura oficial de la World Cube Association (WCA). El objetivo de esta fase es explícito: **no reinventar lo que ya existe y funciona bien**, identificar qué partes del ecosistema son reutilizables (librerías, protocolos documentados, motores de resolución), y detectar los huecos reales de producto que una nueva plataforma podría cubrir con ventaja competitiva genuina.

## 0.2 Mapa del ecosistema actual

El ecosistema se organiza en cinco capas que rara vez están unificadas en un solo producto — y esa fragmentación es, en sí misma, el mayor hallazgo de la investigación:

| Capa                                   | Función                                                      | Representantes                                              |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| **Timers puros**                 | Cronometrado, medias, sesiones                                | csTimer, Twisty Timer, qqTimer, Stackmat                    |
| **Analítica con Smart Cube**    | Captura de movimientos BLE, splits por fase                   | Cubeast, CubeDesk, GAN Cube Station / GAN iStation, acubemy |
| **Entrenadores de algoritmos**   | Repetición espaciada de OLL/PLL/F2L                          | CubeSkills, JPerm.net, csTimer (parcial)                    |
| **Bases de datos de algoritmos** | Repositorios consultables de casos                            | AlgDB, SpeedCubeDB                                          |
| **Infraestructura de motor**     | Resolución óptima, generación de scrambles, visualización | Kociemba/min2phase, TNoodle, cubing.js/Twizzle              |

Ninguna plataforma actual unifica de forma coherente las cinco capas con una arquitectura moderna, extensible y orientada a IA. Esa es la oportunidad de producto.

## 0.3 Herramientas, motores y librerías relevantes

### 0.3.1 Timers y plataformas de referencia

**csTimer** (`cs0x7f/cstimer`, GitHub, licencia GPLv3) es el software de referencia de facto de la comunidad. <cite index="4-1">Es un programa de cronometraje profesional para speedsolvers de cubo de Rubik que ofrece gran cantidad de algoritmos de scramble para todos los eventos oficiales de la WCA, variedad de puzzles twisty, y scrambles de entrenamiento para sub-pasos específicos como F2L, OLL, PLL y ZBLL, además de funciones estadísticas extensas con sesiones ilimitadas y división/fusión de sesiones.</cite> Técnicamente, <cite index="4-1">existe una variante orientada a despliegue exclusivamente cliente, sin servicios de servidor, desplegable en cualquier hosting estático como GitHub Pages, con soporte para el temporizador inteligente GAN mediante su protocolo Bluetooth.</cite> csTimer funciona como Progressive Web App instalable, <cite index="3-1">detecta automáticamente fallos de hardware en cubos Bluetooth</cite> y expone un módulo npm (`cstimer_module`) reutilizable para generación de scrambles. Su código, aunque potente, es monolítico (un único archivo JS gigante), lo que dificulta la extensibilidad — una lección directa de arquitectura para nuestro diseño.

**Twisty Timer** (Android) es el equivalente móvil ligero: cronómetro offline, historial local, estadísticas básicas, sin soporte de cubos inteligentes ni análisis por fases. Sirve como referencia de UX minimalista pero no de arquitectura.

**Cubeast** es la referencia histórica en analítica con hardware. <cite index="51-1">Aprovecha la conectividad Bluetooth de los cubos modernos para ofrecer nuevas herramientas de análisis, registrando, almacenando y analizando todos los solves del usuario para indicar fortalezas y debilidades; da soporte a todos los modelos de cubo Bluetooth 3x3 existentes, añadiendo soporte a nuevos modelos según aparecen.</cite>

**CubeDesk** es la alternativa de escritorio multiplataforma. <cite index="53-1">Es una app de escritorio para Mac, Windows y Linux que replica la experiencia de csTimer pero en formato nativo, con timer para 3x3, 2x2, 4x4, Skewb y otros eventos, y un entrenador de algoritmos integrado.</cite>

**acubemy** representa la generación más reciente de producto orientado a IA: <cite index="54-1">se posiciona como una herramienta que encuentra fallos ocultos en los solves del usuario y crea planes de entrenamiento personalizados, buscando entrenar de forma más inteligente, no solo más dura.</cite>

Un artículo de análisis de 2026 resume bien el estado del arte en analítica en tiempo real: <cite index="52-1">plataformas como Cubeast o GAN iStation descomponen el solve en cuatro fases (Cross, F2L, OLL, PLL); un patrón habitual es que un usuario cree que su F2L es lento cuando en realidad el cuello de botella real es el tiempo de reconocimiento entre parejas, y el software resuelve esto con drills específicos de look-ahead.</cite> También constata la aparición de robots resolutores (GAN Robot) usados como herramienta de scrambling físico automatizado para practicar casos concretos.

### 0.3.2 Motores de resolución matemática

El corazón algorítmico del sector converge en el **algoritmo de dos fases de Herbert Kociemba**. Existen múltiples implementaciones de referencia que deben reutilizarse en lugar de reimplementarse:

- **`hkociemba/RubiksCube-TwophaseSolver`** (Python) — <cite index="23-1">resuelve el cubo de Rubik en menos de 19 movimientos de media.</cite> Es la implementación de referencia del propio autor del algoritmo.
- **`cs0x7f/min2phase`** (Java, con puerto JS) — <cite index="21-1">implementación optimizada del algoritmo de dos fases de Kociemba</cite>, con métricas de rendimiento documentadas: <cite index="27-1">tras la inicialización completa, cada resolución tarda en torno a 2.3 ms de media, con soluciones garantizadas de no más de 21 movimientos.</cite> Esta es la opción recomendada para uso en navegador/servidor Node.js por su balance velocidad/tamaño de tablas.
- **`rokicki/twophase.js`** — <cite index="24-1">puerto a JavaScript del solver de dos fases de Kociemba, derivado de cube20.org</cite>, útil como alternativa o para validación cruzada.
- **`torjusti/cube-solver`** (JS) — no solo resuelve el cubo completo, también <cite index="22-1">permite resolver sub-pasos como la cruz, el primer bloque de Roux o la EOLine de ZZ, y generar scrambles filtrados por caso (por ejemplo, generar un scramble de ZBLL específico)</cite>, lo cual es directamente aplicable al motor de entrenamiento por sub-pasos que se describe en la Parte 9. El propio proyecto reconoce que su solver completo es más lento que versiones compiladas de min2phase, por lo que su rol ideal es el de motor auxiliar de sub-pasos, no motor principal.
- **`efrantar/rob-twophase`** — variante en C++ ultra-optimizada pensada para robots de resolución física; interesante como referencia de límites de rendimiento, no como dependencia directa.

**Decisión de arquitectura recomendada**: usar **min2phase (puerto WASM/JS)** como solver principal embebido en el cliente (permite análisis 100% offline y sin latencia de red), con un fallback en servidor (Node.js) para dispositivos de gama baja o para cálculos masivos por lotes (ej. reanálisis histórico de miles de solves).

### 0.3.3 Generación de scrambles oficiales — TNoodle

**TNoodle** es la única fuente de scrambles válida para eventos oficiales y debe tratarse como un componente de referencia y de interoperabilidad, no como dependencia de producción de la plataforma (nuestra plataforma no organiza competiciones oficiales, pero debe ser *compatible* con el formato). <cite index="42-1">TNoodle es la suite de software que contiene el programa oficial de scrambles de la WCA, con el núcleo de scrambling escrito principalmente en Kotlin, además de una interfaz y un servidor para generar un JAR autónomo.</cite> <cite index="43-1">El programa de scramble oficial forma parte de TNoodle desde el 1 de enero de 2013, y todas las competiciones oficiales de la WCA deben usar siempre la versión vigente del programa.</cite> Para desarrollo no oficial existe **`SpeedcuberOSS/tnoodle-cli`**, <cite index="44-1">una interfaz de línea de comandos no oficial y no afiliada a la WCA que reutiliza el mismo motor central tnoodle-lib para generar scrambles de calidad competitiva desde cualquier lenguaje mediante llamadas de sistema</cite> — útil en el pipeline de generación de scrambles de entrenamiento de nuestra plataforma, dejando claro en el producto que **no están certificados para uso oficial**.

### 0.3.4 Visualización 3D — cubing.js / Twizzle

**`cubing/cubing.js`** es, con diferencia, la base más sólida disponible para renderizado de puzzles twisty en la web y es la recomendación directa para el módulo de Cubo 3D de la plataforma (Parte 6). <cite index="31-1">Es la librería que da vida a Twizzle, sucesor espiritual de alg.cubing.net, y expone un componente web listo para usar mediante  cargable directamente desde CDN.</cite> Internamente <cite index="33-1">depende de three.js y de comlink (para mover cálculos pesados a web workers)</cite>, y su ecosistema de aplicaciones de referencia incluye <cite index="32-1">un explorador de reconstrucciones en vivo, un módulo de conectividad Bluetooth, un editor de stickering, soporte de VR y hasta un solucionador de patrones (Twizzle Pattern Searcher, planteado como reemplazo de TNoodle a futuro).</cite> Este último dato es relevante: el propio ecosistema `cubing` está evolucionando hacia sustituir TNoodle, señal de hacia dónde se mueve la infraestructura del sector.

**Licencia**: cubing.js usa GPLv3 en algunas ramas — debe auditarse la licencia exacta de la versión integrada antes de un uso comercial cerrado; si es incompatible, se recomienda usar three.js puro con un motor de estado de cubo propio (ver Parte 6).

### 0.3.5 Web Bluetooth y protocolos de cubos inteligentes

La conectividad con hardware es, con diferencia, el área de mayor complejidad técnica y el mayor foso competitivo posible para la plataforma. Se detalla en la Parte 0.4 y Parte 5.

## 0.4 Protocolos de cubos inteligentes (Smart Cubes)

### 0.4.1 GAN — el fabricante mejor documentado

El protocolo GAN es, con diferencia, el mejor documentado por la comunidad open source gracias a ingeniería inversa "clean-room" realizada por varios desarrolladores independientes.

- **`afedotov/gan-web-bluetooth`** — <cite index="12-1">librería para interactuar con GAN Smart Timers y GAN Smart Cubes usando la Web Bluetooth API</cite>, con una API basada en eventos y RxJS: <cite index="13-1">dado que la naturaleza del temporizador y los cubos inteligentes GAN es orientada a eventos, la librería depende de RxJS y expone Observables a los que suscribirse.</cite> Un detalle técnico crítico documentado por esta librería y que **debe incorporarse en nuestro motor de timing** es la corrección de deriva de reloj: <cite index="13-1">el reloj interno de la mayoría de los cubos inteligentes GAN no está perfectamente calibrado y suele introducir una desviación de tiempo apreciable respecto al reloj del dispositivo anfitrión, por lo que la mejor práctica es registrar timestamps de cada movimiento con ambos relojes (host y cubo) durante el solve y aplicar un algoritmo de regresión lineal para ajustar los valores del cubo y obtener un tiempo transcurrido correctamente medido — técnica inventada e implementada por primera vez por Chen Shuang (autor de csTimer).</cite>
- El propio repositorio de demo, **`afedotov/gan-cube-sample`**, <cite index="14-1">demuestra la conectividad con cubos GAN usando las versiones de protocolo Gen2, Gen3 y Gen4, incluyendo el manejo correcto de la medición de tiempo y de los eventos de giroscopio.</cite>
- **`cubing/cubing.js`** implementa su propio decodificador GAN de forma independiente, explícitamente etiquetado en el código como <cite index="15-1">"Clean-room reverse-engineered"</cite>, con una rutina de desencriptado de paquetes de estado que usa AES por bloques sobre los datos recibidos por characteristic BLE.
- Existen implementaciones nativas para otras plataformas, como **`shanedirksen/gan-cube-windows-app`**, una app de Windows (Tauri + Rust) que <cite index="20-1">soporta conectividad Bluetooth con múltiples modelos GAN (356i, 356i3, 11M Pro, 12M, 13M, etc.) mostrando datos en tiempo real del estado del cubo</cite>, construida explícitamente sobre `gan-web-bluetooth` como librería base del protocolo.
- La comunidad confirma que el reto principal no es la conexión BLE en sí sino el descifrado del payload: en el foro de SpeedSolving un desarrollador documenta que <cite index="16-1">tras conectar con un GAN 356i Carry es capaz de recibir notificaciones tras cada movimiento (paquetes de 20 bytes por estado del cubo), pero no logra decodificarlos porque el protocolo usa una capa de cifrado distinta a la de otros cubos inteligentes</cite> — confirmando que csTimer y las librerías mencionadas arriba son, hoy, las fuentes más fiables del algoritmo de descifrado real.

**Decisión de arquitectura**: adoptar `gan-web-bluetooth` (o un fork mantenido activamente) como base del adaptador GAN, envuelto en la capa de abstracción de hardware descrita en la Parte 5, en vez de reimplementar el descifrado desde cero.

### 0.4.2 Otros fabricantes (MoYu, QiYi, Giiker)

La investigación confirma que no existe un protocolo unificado entre fabricantes — cada uno usa su propio formato de paquete BLE, en algunos casos cifrado y en otros no. csTimer es hoy el software que de facto mantiene el mayor número de decodificadores por fabricante integrados en un único códigobase, lo que lo convierte en la referencia obligatoria de ingeniería inversa para ampliar el soporte de la plataforma más allá de GAN. La estrategia recomendada (ver Parte 5) es un **Hardware Abstraction Layer (HAL)** con adaptadores plugin por fabricante, de forma que añadir un nuevo cubo (MoYu, QiYi, Giiker, o modelos futuros) sea una tarea aislada y no un cambio transversal al núcleo del producto.

## 0.5 Marco regulatorio y de interoperabilidad — WCA

<cite index="41-1">El programa de scrambles oficial vigente es TNoodle-WCA, que genera secuencias de scramble de alta calidad para todos los eventos de una competición a la vez; toda competición oficial debe usar siempre una versión vigente del programa oficial de scramble, y los delegados deben guardar y cifrar todas las secuencias generadas con una contraseña no relacionada con la competición ni con datos personales.</cite> Esto tiene una implicación directa de producto: **nuestra plataforma nunca debe presentarse como fuente de scrambles "oficiales" de competición**, y debe dejarlo explícito en la UI y en la documentación de la API (tal como hace honestamente `tnoodle-cli` en su propio disclaimer). Sí puede, en cambio, ofrecer generación de scrambles "competition-grade" para entrenamiento, usando el mismo motor matemático subyacente (min2phase / TNoodle-lib) sin reclamar certificación oficial.

---

# PARTE 1 — ESTUDIO COMPETITIVO (BENCHMARK)

| Producto                              | Fortalezas                                                                                        | Debilidades                                                                                  | Smart Cube                        | Análisis               | Entrenamiento               | Escalabilidad técnica       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------- | --------------------------- | ---------------------------- |
| **csTimer**                     | Motor de scrambles más completo del sector; comunidad enorme; gratuito; PWA offline              | UI anticuada; código monolítico difícil de extender; sin IA; análisis por fases limitado | Sí (parcial, varios fabricantes) | Básico                 | Entrenador de casos básico | Baja (arquitectura legacy)   |
| **Twisty Timer**                | Simplicidad extrema; ligero; offline total                                                        | Sin smart cube; sin análisis; sin entrenamiento estructurado                                | No                                | No                      | No                          | Baja (app cerrada, sin API)  |
| **Cubeast**                     | Pionero en analítica con hardware; buena UX de splits por fase                                   | Ecosistema cerrado; cobertura de fabricantes limitada; sin motor de IA moderno               | Sí                               | Media-alta              | Media                       | Media                        |
| **CubeDesk**                    | Multiplataforma nativo; UX cuidada; entrenador de algoritmos integrado                            | Menor comunidad; funciones de análisis avanzado limitadas                                   | Parcial                           | Media                   | Media                       | Media                        |
| **GAN Cube Station / iStation** | Integración perfecta con hardware propio; splits de fase en tiempo real                          | Vendor lock-in total (solo cubos GAN); ecosistema cerrado                                    | Sí (solo GAN)                    | Alta (solo su hardware) | Media                       | Baja (mono-fabricante)       |
| **acubemy**                     | Enfoque explícito en IA y planes de entrenamiento personalizados; detección de "fallos ocultos" | Producto joven, comunidad pequeña, cobertura de eventos limitada                            | Sí                               | Alta                    | Alta (orientado a IA)       | Desconocida (producto nuevo) |
| **AlgDB / SpeedCubeDB**         | Bases de datos de algoritmos completas y consultables                                             | Sin timer, sin tracking, sin integración con solves reales                                  | No                                | No                      | Consulta pasiva             | Media                        |
| **CubeSkills / JPerm**          | Contenido educativo de altísima calidad (vídeo, teoría)                                        | No es una plataforma de software; sin tracking automático                                   | No                                | No                      | Contenido, no interactivo   | N/A                          |

### Qué haría CubeForge mejor que todos ellos

1. **Unificación real de las cinco capas** (timer, smart cube, análisis, entrenamiento, base de datos de algoritmos) en una sola arquitectura de datos coherente, en vez de herramientas aisladas que el usuario tiene que combinar manualmente.
2. **Independencia de fabricante** mediante un HAL de hardware plugin-based (ningún competidor actual lo ofrece de forma abierta y extensible).
3. **Análisis en tiempo real explicable**, no solo estadístico: no basta con decir "tu F2L es lento", hay que decir *por qué* (reconocimiento, ejecución, rotaciones, pausas) — inspirado directamente en el patrón de diagnóstico ya validado por Cubeast/GAN iStation pero llevado a nivel de movimiento individual.
4. **IA modular y explicable**, no una caja negra: cada recomendación debe poder trazarse hasta datos concretos del propio usuario.
5. **Offline-first genuino** con sincronización posterior, en lugar de depender de conexión constante.
6. **Arquitectura plugin-based desde el día uno**, evitando el problema estructural que hoy limita a csTimer (motor potente pero monolítico y difícil de extender).

---

# PARTE 2 — FILOSOFÍA Y PRINCIPIOS DEL PRODUCTO

1. **Modularidad radical.** Cada capacidad (solver, HAL de hardware, motor de análisis, motor de IA, motor de entrenamiento) es un módulo con contrato de interfaz explícito, sustituible de forma independiente.
2. **Plugin-first.** Nuevos fabricantes de cubos, nuevos métodos de resolución (CFOP, Roux, ZZ, Petrus, LBL, y los que aparezcan en el futuro), nuevos tipos de entrenamiento y nuevas fuentes de datos se añaden como plugins, no como parches al núcleo.
3. **Offline-first.** El cronómetro, el análisis básico y el entrenamiento deben funcionar sin conexión; la nube sincroniza, nunca bloquea.
4. **Sin dependencia de un único fabricante de hardware.** GAN es el primer y mejor soportado (Parte 5), pero la arquitectura debe tratarlo como "el primer adaptador", no como un requisito estructural.
5. **Escalabilidad a millones de solves por usuario y por plataforma.** Las decisiones de modelo de datos (Parte 15) asumen desde el diseño volúmenes de escritura muy altos (un solve genera decenas de eventos de movimiento).
6. **Cero deuda técnica por defecto.** Contratos de API versionados, migraciones de esquema explícitas, tests de regresión en el núcleo de resolución (el solver debe ser matemáticamente verificable).
7. **Explicabilidad sobre "magia".** Todo lo que la IA o el analizador en tiempo real sugiera debe ser trazable a datos concretos del solve, no una caja negra.

---

# PARTE 3 — VISIÓN DE PRODUCTO Y PILARES

CubeForge se plantea como la capa de software de referencia del speedcubing serio: el lugar donde un speedcuber conecta su cubo inteligente, entrena, analiza cada solve movimiento a movimiento, gestiona su propia base de algoritmos, sigue su progreso a largo plazo y recibe recomendaciones de entrenamiento generadas por IA basadas en sus propios datos — todo ello sin quedar atado a un único fabricante de hardware ni a un único método de resolución.

**Pilares del producto:**

- 🎯 **Entrenamiento** — sistemas de práctica deliberada por sub-paso, con repetición espaciada.
- 📊 **Análisis** — descomposición de cada solve en fases, movimientos, pausas y eficiencia.
- 📈 **Seguimiento** — históricos, medias móviles, calendario de progreso, rachas.
- 🤖 **IA** — explicación de errores, generación de ejercicios, recomendaciones personalizadas.
- 🔌 **Cubos inteligentes** — integración multi-fabricante vía HAL plugin-based.
- 🧊 **Visualización 3D** — reproducción exacta y navegable de cualquier solve.
- 📚 **Aprendizaje** — biblioteca de algoritmos completa, filtrable, con progreso propio.
- 🚀 **Progresión** — objetivos, hitos, comparativas con versiones pasadas de uno mismo.
- 👥 **Comunidad** — comparativas, retos, compartición de reconstrucciones.
- 🏗️ **Arquitectura escalable** — pensada desde el primer commit para millones de solves.

---

# PARTE 4 — ARQUITECTURA DE SOFTWARE

## 4.1 Vista general

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENTES (Frontend)                          │
│   Web App (PWA)  |  App Móvil (React Native / Flutter)  |  Desktop   │
│                                                                        │
│   ┌────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────┐ │
│   │ Timer Core │ │ Cube3D Engine │ │ Analysis UI   │ │ Trainer UI │ │
│   └────────────┘ └───────────────┘ └───────────────┘ └────────────┘ │
│               │              │               │              │        │
│   ┌───────────┴──────────────┴───────────────┴──────────────┴────┐  │
│   │        Local State Layer (offline-first: IndexedDB/SQLite)    │  │
│   └───────────────┬─────────────────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────────────────┘
                     │  Sync Engine (event-based, conflict resolution)
┌────────────────────┴──────────────────────────────────────────────────┐
│                         BACKEND (API Gateway)                         │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐ │
│   │  Auth &   │ │  Solve    │ │  Algorithm│ │  Training │ │  AI    │ │
│   │  Profile  │ │  Ingest   │ │  Database │ │  Engine   │ │ Service│ │
│   │  Service  │ │  Service  │ │  Service  │ │  Service  │ │        │ │
│   └───────────┘ └───────────┘ └───────────┘ └───────────┘ └────────┘ │
│         │              │              │             │           │    │
│   ┌─────┴──────────────┴──────────────┴─────────────┴───────────┴─┐ │
│   │                     Event Bus (async, pub/sub)                 │ │
│   └─────┬─────────────────────────────────────────────────────────┘ │
│         │                                                            │
│   ┌─────┴──────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────┐ │
│   │ PostgreSQL │  │ Time-series  │  │ Object Storage │  │  Cache   │ │
│   │ (relacional)│  │ DB (eventos)│  │ (reconstrucc.) │  │ (Redis)  │ │
│   └────────────┘  └──────────────┘  └───────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Frontend

El frontend se diseña **local-first**: toda la lógica de cronometraje, decodificación de eventos del cubo y análisis básico corre en el cliente (navegador o app nativa), sin depender de round-trips de red. Esto es indispensable porque la latencia de un servidor remoto es incompatible con la precisión de milisegundos que exige el cronometraje de speedcubing.

- **Web**: SPA basada en componentes, con Web Bluetooth como capa de acceso a hardware (Chrome/Edge/Opera; Safari e iOS requieren fallback a app nativa por falta de soporte de Web Bluetooth).
- **Móvil**: app nativa (React Native o Flutter) usando Bluetooth LE nativo, indispensable para iOS.
- **Desktop**: empaquetado tipo Tauri/Electron reutilizando el mismo core web, con acceso BLE nativo más estable que en navegador (patrón ya validado por proyectos como `gan-cube-windows-app`, construido en Tauri + Rust sobre la misma librería de protocolo GAN).
- **Cube3D Engine**: motor de renderizado 3D (Parte 6), aislado como módulo independiente reutilizable en web, desktop y potencialmente overlays de vídeo.

## 4.3 Backend / Servicios

Arquitectura de microservicios ligera (o "modular monolith" en fases tempranas, con fronteras de servicio ya definidas para facilitar la futura extracción):

| Servicio                     | Responsabilidad                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| **Auth & Profile**     | Identidad, perfiles, preferencias, métodos de resolución declarados                    |
| **Solve Ingest**       | Recepción, validación y almacenamiento de solves (timing + stream de movimientos)      |
| **Algorithm Database** | CRUD y consulta de la biblioteca de algoritmos (Parte 10)                                |
| **Training Engine**    | Lógica de repetición espaciada, generación de sesiones de entrenamiento               |
| **Analysis Engine**    | Cálculo de métricas de eficiencia, detección de fase, comparación con óptimo        |
| **AI Service**         | Orquestación de modelos de IA (Parte 13), explicaciones, recomendaciones                |
| **Solver Service**     | Resolución óptima/sub-óptima bajo demanda (fallback de servidor al solver de cliente) |
| **Stats Service**      | Agregaciones, medias móviles, series temporales, exportación                           |
| **Community Service**  | Comparativas, retos, compartición pública opcional                                     |

## 4.4 Sistema de eventos y sincronización

Cada solve se modela como una secuencia de **eventos inmutables** (movimiento del cubo, timestamp, ángulo/cara, opcionalmente datos de giroscopio) en lugar de un único registro monolítico. Esto permite:

- Reproducción exacta en el Cubo 3D (Parte 6).
- Reanálisis retroactivo cuando el motor de análisis mejora (los eventos crudos no cambian; solo se recalculan las métricas derivadas).
- Sincronización basada en *append-only log* con resolución de conflictos trivial (los eventos nunca se editan, solo se añaden), evitando los problemas clásicos de sync de estado mutable.

## 4.5 Sistema de plugins

Tres superficies de extensión de primera clase, definidas desde el día uno:

1. **Hardware Adapters** (Parte 5) — un plugin por fabricante/protocolo de cubo inteligente.
2. **Solver Methods** — un plugin por método de resolución (CFOP, Roux, ZZ, Petrus, LBL, y métodos futuros), cada uno declarando sus propias fases, sus propios casos y su propia lógica de reconocimiento.
3. **Training Modules** — un plugin por tipo de entrenador (Cross, F2L, OLL, PLL, COLL, WV, VLS, ZBLL, LSLL, EO, etc.), cada uno consumiendo la misma Algorithm Database pero con su propia UI de práctica.

Cada plugin se registra contra un contrato de interfaz estable versionado (semver), de forma que actualizaciones del núcleo no rompan plugins existentes salvo cambios de versión mayor explícitos.

## 4.6 Offline-first y sincronización

- **Cliente**: IndexedDB (web) / SQLite (móvil/desktop) como fuente de verdad local.
- **Cola de sincronización**: los eventos generados offline se encolan y se envían en cuanto hay conectividad, con deduplicación por ID idempotente.
- **Resolución de conflictos**: dado el modelo append-only (4.4), los conflictos reales son mínimos; para entidades mutables (perfil, configuración de entrenamiento) se aplica *last-write-wins* con versión vectorial y aviso al usuario en casos de conflicto genuino (edición simultánea en dos dispositivos).

## 4.7 Seguridad, versionado y despliegue

- API versionada explícitamente (`/v1`, `/v2`) con política de deprecación documentada.
- Migraciones de base de datos gestionadas y reversibles (nunca cambios destructivos sin migración de datos).
- Cifrado en tránsito (TLS) y en reposo para datos de perfil; los eventos de movimiento del cubo, al no ser datos personales sensibles, pueden almacenarse con políticas de retención más flexibles pero siempre con opción de exportación/borrado total (cumplimiento GDPR-like).
- CI/CD con test suite obligatoria sobre el Solver Service (verificación matemática: todo scramble generado debe ser resoluble en ≤ 20 movimientos HTM, límite conocido de Dios para el cubo 3x3).

---

# PARTE 5 — INTEGRACIÓN CON SMART CUBES

## 5.1 Hardware Abstraction Layer (HAL)

El HAL expone una interfaz única e independiente de fabricante al resto de la plataforma:

```typescript
interface SmartCubeAdapter {
  readonly vendor: string;              // "GAN" | "MoYu" | "QiYi" | "Giiker" | ...
  readonly supportedModels: string[];
  connect(): Promise<SmartCubeConnection>;
  disconnect(): Promise<void>;
}

interface SmartCubeConnection {
  readonly deviceId: string;
  moves$: Observable<CubeMoveEvent>;     // stream de movimientos decodificados
  state$: Observable<CubeFaceletState>;  // estado facelet reconstruido
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
  getRecordedTimes?(): Promise<RecordedTime[]>;
}

interface CubeMoveEvent {
  face: Move;              // U, U', U2, R, R', ... en notación estándar
  cubeTimestamp: number;   // reloj interno del cubo
  hostTimestamp: number;   // reloj del dispositivo anfitrión
}
```

Cada fabricante implementa `SmartCubeAdapter` como un plugin aislado. El **adaptador GAN** (primer ciudadano de primera clase del sistema, dado que es el mejor documentado del ecosistema — ver Parte 0.4.1) se construye reutilizando la lógica de descifrado y de protocolo ya validada por `gan-web-bluetooth`, incluyendo la técnica de ajuste de reloj por regresión lineal descrita en 0.4.1, que se incorpora como utilidad compartida del HAL (`cubeTimestampLinearFit()`), disponible para todos los adaptadores, no solo GAN.

## 5.2 Corrección de deriva de reloj (compartida entre adaptadores)

Todo adaptador de hardware debe pasar sus timestamps crudos por el módulo de ajuste de reloj antes de entregarlos al resto del sistema, replicando el enfoque pionero de csTimer: registrar timestamp de host y de cubo por cada evento, y aplicar regresión lineal para obtener un tiempo elegido correctamente medido, evitando que pequeñas desviaciones del reloj interno del cubo se acumulen en sesiones largas.

## 5.3 Roadmap de adaptadores

| Prioridad | Fabricante               | Estado de documentación pública                                          | Estrategia                                       |
| --------- | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------ |
| P0        | GAN (Gen2/3/4, incl. i3) | Excelente (múltiples implementaciones open source)                        | Adaptar`gan-web-bluetooth`                     |
| P1        | MoYu                     | Parcial (documentado mayormente dentro del código de csTimer)             | Ingeniería inversa asistida por código csTimer |
| P1        | QiYi                     | Parcial                                                                    | Ingeniería inversa asistida por código csTimer |
| P2        | Giiker                   | Protocolo antiguo, sin cifrado, ya documentado por la comunidad hace años | Adaptador directo, baja complejidad              |
| P3        | Fabricantes futuros      | N/A                                                                        | Vía SDK de plugin público para la comunidad    |

## 5.4 SDK público de adaptadores

A medio plazo, se recomienda publicar el contrato `SmartCubeAdapter` como SDK público, permitiendo que la propia comunidad (como ya ocurre hoy de forma informal alrededor de csTimer) contribuya adaptadores para fabricantes nuevos sin depender del equipo núcleo — replicando a nivel de producto la dinámica de ecosistema abierto que hizo de csTimer el estándar de facto.

---

# PARTE 6 — MOTOR DE CUBO 3D EN TIEMPO REAL

## 6.1 Base tecnológica

Se recomienda **three.js** como motor de renderizado 3D subyacente, por ser la base ya validada tanto por `cubing.js`/Twizzle como por el propio ecosistema general de visualización WebGL. Existen dos caminos:

- **Opción A (rápida de integrar)**: usar directamente el componente `<twisty-player>` de cubing.js vía CDN para los casos de uso estándar (reproducción de alg, visualización de scramble), verificando la licencia exacta antes de cualquier uso comercial cerrado.
- **Opción B (control total)**: construir un motor de estado de cubo propio sobre three.js puro, con un modelo de facelets/cubies internos propio, para tener control total sobre estilos, stickering personalizado, animaciones de análisis (resaltado de piezas, overlays de "cruz óptima", etc.) que exceden lo que un componente genérico permite.

**Recomendación**: Opción B para el núcleo de producto (control total necesario para las funciones de análisis visual descritas en la Parte 8), reutilizando conceptos de representación de estado ya validados por cubing.js (formato "facelet cube" estándar tipo Kociemba) para máxima interoperabilidad de datos.

## 6.2 Funcionalidades requeridas

- **Reflejo en tiempo real** del estado físico del cubo inteligente conectado (rotaciones, orientación, scramble, solve) — alimentado directamente por el stream `moves$` del HAL (Parte 5).
- **Reproducción de cualquier solve grabado**, con:
  - Control de cámara libre (rotación, zoom).
  - Control de velocidad (0.25x–4x).
  - Timeline scrubbing.
  - Modo paso a paso (frame por movimiento).
  - Comparación lado a lado de dos soluciones (la del usuario vs. la óptima, o dos intentos distintos).
- **Overlays de análisis** (Parte 8): resaltado de pieza de cruz objetivo, resaltado de próxima pareja F2L sugerida, indicador de caso OLL/PLL reconocido.
- **Modo scramble visual**: renderizado del scramble antes de empezar, sincronizado con el estado físico real del cubo tras aplicarlo.

## 6.3 Rendimiento

El motor debe correr en un Web Worker independiente del hilo principal de UI para evitar bloqueos durante sesiones largas de entrenamiento, siguiendo el patrón ya adoptado por cubing.js (uso de `comlink` para mover cómputo pesado fuera del hilo principal).

---

# PARTE 7 — MOTOR DE RESOLUCIÓN (SOLVER ENGINE)

## 7.1 Núcleo matemático

- **Solver principal**: puerto WASM/JS de **min2phase**, embebido en cliente, con inicialización progresiva de tablas (igual que el comportamiento documentado del propio min2phase: primeras resoluciones más lentas mientras se generan tablas, luego resoluciones en pocos milisegundos).
- **Fallback de servidor**: mismo motor ejecutado en Node.js para dispositivos de gama baja, reanálisis masivo por lotes, y generación de scrambles de entrenamiento a gran escala.
- **Generación de scrambles**: adaptador propio inspirado en `tnoodle-cli`, dejando explícito en la UI que **no son scrambles oficiales certificados**, solo "competition-grade" para entrenamiento.

## 7.2 Soporte multi-método

El Solver Engine no impone un único método de resolución; expone una interfaz de **"method plugin"**:

```typescript
interface SolveMethod {
  readonly id: "CFOP" | "Roux" | "ZZ" | "Petrus" | "LBL" | string;
  readonly phases: MethodPhase[];         // ej. CFOP: Cross, F2L, OLL, PLL
  detectPhaseBoundary(state, moveHistory): PhaseTransition | null;
  suggestOptimalStep(state, phase): Suggestion;
}
```

- **CFOP**: fases Cross → F2L (x4) → OLL → PLL.
- **Roux**: fases First Block → Second Block → CMLL → LSE.
- **ZZ**: fases EOLine → F2L → LL (ZBLL/OCLL+PLL/COLL+EPLL según variante).
- **Petrus**: bloque 2x2x2 → bloque 2x2x3 → expansión → orientación de esquinas → permutación final.
- **LBL** (principiante): capa por capa, para el módulo de aprendizaje inicial.
- **Extensibilidad**: cualquier método futuro (o variantes personalizadas de usuarios avanzados) se añade implementando el mismo contrato, sin tocar el núcleo.

## 7.3 Cálculo de solución óptima de referencia

Para cada solve capturado, el sistema calcula en segundo plano (no bloqueante) la solución óptima teórica del scramble correspondiente vía min2phase, usada como línea base de comparación en el motor de análisis (Parte 8) — nunca mostrada como "lo que deberías haber hecho" de forma prescriptiva, sino como referencia contextual, dado que la solución más corta en movimientos no siempre es la más rápida en tiempo real (fingertricks, flujo, regrips).

---

# PARTE 8 — SISTEMA DE ANÁLISIS EN TIEMPO REAL

Este es, junto con la integración de hardware, el pilar diferencial más fuerte de la plataforma frente a la competencia.

## 8.1 Pipeline de análisis

```
Stream de movimientos (HAL) 
        │
        ▼
Reconstrucción de estado facelet (incremental)
        │
        ▼
Detección de fase (Solve Method plugin activo)
        │
        ├──► Módulo de Cruz:     detección, cruz óptima, X-Cross, eficiencia de inspección
        ├──► Módulo de F2L:      reconocimiento de pareja, alternativas, rotaciones innecesarias
        ├──► Módulo de LL:       reconocimiento OLL/PLL, algoritmo usado vs. recomendado
        └──► Módulo de Fluidez:  TPS, pausas, regrips, lookahead, rotaciones totales
        │
        ▼
Métricas derivadas + comparación con óptimo (Solver Engine)
        │
        ▼
Almacenamiento de resultados de análisis (vinculado al solve, versión de motor de análisis)
```

## 8.2 Capacidades por fase

**Inspección / Cruz**

- Detección automática de la cruz elegida por el usuario.
- Cálculo de la cruz óptima (y de X-Cross cuando aplica) para ese scramble concreto.
- Cálculo de eficiencia de inspección (tiempo usado vs. calidad del plan resultante).

**F2L**

- Detección automática del caso de cada pareja.
- Sugerencia de la mejor pareja siguiente según estado del cubo (no solo la más "obvia").
- Presentación de soluciones alternativas sin rotación cuando la solución usada requirió una.
- Detección de rotaciones innecesarias y su coste real en movimientos/tiempo.

**OLL / PLL**

- Reconocimiento automático del caso a partir del estado facelet.
- Comparación entre el algoritmo efectivamente ejecutado (reconstruido desde el stream de movimientos) y el algoritmo recomendado para ese caso según la Algorithm Database (Parte 10).
- Cálculo de movimientos extra respecto al algoritmo canónico más corto conocido.

**Fluidez y ejecución**

- TPS (turns per second) global y por fase.
- Detección de pausas (gaps de inactividad entre movimientos) y su ubicación (¿durante reconocimiento? ¿durante lookahead?).
- Conteo de regrips (requiere datos de orientación/giroscopio cuando el hardware lo soporte).
- Conteo de rotaciones de cubo (y, cuando el método lo permite, sugerencia de soluciones equivalentes sin rotación).
- Estimación de calidad de lookahead: correlación entre pausas y transiciones de fase.

## 8.3 Modo entrenamiento vs. modo solve libre

Todo lo anterior debe funcionar de forma idéntica en:

- **Modo Solve** (sesión de timing estándar, con scramble aleatorio).
- **Modo Entrenamiento** (Parte 9), donde el análisis se centra en el sub-paso específico que se está practicando (por ejemplo, únicamente en la fase F2L cuando se entrena F2L Trainer).

## 8.4 Versionado del motor de análisis

Dado que el motor de análisis mejorará con el tiempo, cada resultado de análisis almacena la versión del motor que lo generó, permitiendo reanálisis retroactivo bajo demanda sin perder el histórico ni requerir reprocesar todo automáticamente (coste computacional controlado, Parte 4.4).

---

# PARTE 9 — SISTEMA DE ENTRENAMIENTO

## 9.1 Arquitectura de entrenadores (Training Modules)

Cada entrenador es un plugin (Parte 4.5) que consume la Algorithm Database (Parte 10) y el Solver Engine (Parte 7) para generar sesiones de práctica dirigida:

| Módulo                         | Alcance                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| **Cross Trainer**         | Práctica de reconocimiento y ejecución de cruz                                     |
| **XCross Trainer**        | Cruz extendida (cruz + primera pareja)                                               |
| **F2L Trainer**           | Los 41 casos estándar de F2L, filtrables por pareja/ángulo                         |
| **OLL Trainer**           | 57 casos OLL                                                                         |
| **PLL Trainer**           | 21 casos PLL                                                                         |
| **COLL**                  | Orientación + permutación de esquinas combinada (para métodos avanzados CFOP)     |
| **WV (Winter Variation)** | Casos combinados de última pareja F2L + OLL                                         |
| **VLS (Valk Last Slot)**  | Extensión de WV a más casos                                                        |
| **ZBLL**                  | Últimas dos capas orientadas, permutación completa                                 |
| **LSLL**                  | Última capa entera tras EO (usado en ZZ)                                            |
| **EO Trainer**            | Orientación de aristas (ZZ)                                                         |
| **Roux Trainer**          | CMLL, LSE, bloques                                                                   |
| **ZZ Trainer**            | EOLine, F2L de ZZ, LL                                                                |
| **Petrus Trainer**        | Bloques 2x2x2/2x2x3, expansión                                                      |
| **Casos personalizados**  | El usuario puede crear sus propios sets de práctica (algoritmos propios, variantes) |

## 9.2 Modelo de progreso por algoritmo

Cada algoritmo, por usuario, mantiene estado propio:

- **Favorito / Pendiente / Dominado** (clasificación manual o automática por umbral de rendimiento).
- **Repetición espaciada (spaced repetition)**: algoritmo tipo SM-2/Leitner adaptado a speedcubing — los casos con peor rendimiento reciente (más lentos, más errores de reconocimiento) aparecen con mayor frecuencia; los "dominados" se espacían progresivamente.
- **Estadísticas por algoritmo**: tiempo medio de ejecución, tiempo medio de reconocimiento, tasa de error, evolución histórica.
- **Vídeos y animaciones**: cada caso enlaza a su representación en el Cubo 3D (Parte 6) y opcionalmente a vídeo de referencia externo.
- **Comparativas**: rendimiento del usuario en un caso vs. su propia media histórica, y (opcionalmente, de forma anonimizada) vs. la comunidad.

## 9.3 Generación de sesiones de entrenamiento

El **Training Engine** (servicio de backend, Parte 4.3) combina el estado de repetición espaciada con el Solver Engine para generar sesiones de scrambles que fuercen la aparición del caso concreto que se quiere practicar (reutilizando el patrón ya validado por `torjusti/cube-solver`, que soporta explícitamente scrambles filtrados por caso, por ejemplo para ZBLL).

---

# PARTE 10 — BASE DE DATOS DE ALGORITMOS

## 10.1 Esquema conceptual por algoritmo

Cada entrada de la Algorithm Database almacena:

- Identificador único y nombre del caso (nomenclatura estándar por sistema: OLL-27, PLL T-perm, F2L-13, etc.).
- Imagen/representación visual (renderizable directamente vía Cube3D Engine, no solo imagen estática).
- Notación del/de los algoritmo(s): principal y alternativos.
- Métricas de movimiento: HTM, STM, QTM.
- Variantes conocidas (fingertricks alternativos, orientaciones de agarre).
- Dificultad estimada (ejecución y reconocimiento, por separado).
- Popularidad (uso agregado, anonimizado, entre usuarios de la plataforma).
- Velocidad de referencia (TPS típico observado para ese algoritmo entre usuarios avanzados).
- Fuente/autor y notas de atribución.
- Etiquetas (método, subgrupo, familia de casos relacionados).
- Enlaces a vídeo de referencia externo.
- Estado de aprendizaje del usuario actual y fecha de última práctica (relación usuario↔algoritmo, no parte del algoritmo en sí).

## 10.2 Fuentes y compatibilidad

La base de datos se diseña para ser importable/exportable en formatos compatibles con las bases de referencia del sector (AlgDB, SpeedCubeDB), permitiendo a los usuarios migrar sus datos existentes sin fricción y evitando construir el catálogo completo desde cero — de nuevo, el principio de "no reinventar lo que ya existe" aplicado a contenido, no solo a código.

## 10.3 Gobernanza del contenido

- Catálogo base curado por el equipo (algoritmos canónicos, verificados).
- Extensión por la comunidad (algoritmos alternativos, variantes) con sistema de verificación/votación antes de entrar en el catálogo "oficial" de la plataforma.
- Algoritmos totalmente privados del usuario (sets personalizados) nunca se mezclan con el catálogo público salvo publicación explícita.

---

# PARTE 11 — SISTEMA DE TRACKING Y ESTADÍSTICAS

## 11.1 Métricas estándar

- Medias: Ao5, Ao12, Ao50, Ao100, Ao1000 (y configurable a Non de N genérico).
- Desviación estándar, consistencia (coeficiente de variación).
- Históricos completos, filtrables por sesión, evento, método, rango de fechas.
- Gráficas de evolución temporal (tendencia, no solo puntos).

## 11.2 Métricas avanzadas (diferenciales frente a la competencia)

- TPS global y por fase.
- Split por fase: Cross / F2L / OLL / PLL (o el desglose equivalente del método activo).
- Tiempos parciales dentro de cada fase (por pareja de F2L, por ejemplo).
- Ranking de "algoritmos más lentos" y "casos más lentos" del propio usuario, generado automáticamente a partir del histórico de análisis (Parte 8), no introducido manualmente.
- Errores frecuentes (algoritmo incorrecto aplicado, pop, reconocimiento fallido) con clasificación semi-automática.
- Progreso por algoritmo (enlazado directamente al estado de la Parte 10.2).

## 11.3 Seguimiento de hábito y objetivos

- Calendario de actividad (heatmap tipo "contribution graph").
- Rachas (streaks) de práctica diaria/semanal.
- Objetivos definidos por el usuario (ej. "bajar de Ao12 de 15s antes de fin de mes"), con seguimiento automático de progreso hacia el objetivo.

## 11.4 Exportación

Exportación completa en formatos abiertos (CSV, JSON compatible con csTimer donde sea razonable) para portabilidad total de datos del usuario — coherente con el principio de "sin dependencia de un único fabricante o proveedor" aplicado también a los propios datos del usuario.

---

# PARTE 12 — SISTEMA DE TIMERS

| Tipo                          | Descripción                                                                     | Precisión                                         | Offline |
| ----------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | ------- |
| **Manual**              | Barra espaciadora / doble Ctrl / touch, como csTimer                             | Alta (limitada por input humano)                   | Sí     |
| **Smart Cube**          | Inicio/parada derivados del stream de movimientos del HAL (Parte 5)              | Muy alta (con corrección de deriva de reloj, 5.2) | Sí     |
| **Bluetooth genérico** | Temporizadores BLE dedicados (ej. GAN Smart Timer)                               | Muy alta                                           | Sí     |
| **Stackmat**            | Temporizador físico estándar de competición, vía interfaz de audio/adaptador | Muy alta (estándar de competición)               | Sí     |
| **Futuras expansiones** | Cualquier fuente de timing que implemente el contrato`TimerSource` del HAL     | —                                                 | —      |

Todos los tipos de timer se normalizan a una interfaz común `TimerSource` para que el resto del sistema (análisis, tracking, entrenamiento) sea agnóstico de la fuente de timing usada.

---

# PARTE 13 — SISTEMA DE INTELIGENCIA ARTIFICIAL

## 13.1 Principios de diseño de la IA

- **Modular**: la IA es un servicio consumidor de los datos ya estructurados por el Analysis Engine (Parte 8) y el Stats Service (Parte 11.2-11.3), no una caja negra que reprocesa datos crudos por su cuenta.
- **Explicable**: cada recomendación debe citar la métrica/patrón concreto que la motiva.
- **Opt-in y transparente**: el usuario puede consultar en todo momento qué datos alimentan cada recomendación.

## 13.2 Capacidades

- **Análisis de solves**: resumen en lenguaje natural de un solve o de una sesión, apoyado directamente en las métricas ya calculadas por el Analysis Engine.
- **Explicación de errores**: por qué un solve concreto fue más lento de lo esperado (pausa larga en reconocimiento de OLL, rotación evitable, etc.), citando el momento exacto del stream de movimientos.
- **Creación de ejercicios**: generación de sesiones de entrenamiento dirigidas a la debilidad detectada (delegando la generación técnica al Training Engine, Parte 9.3).
- **Recomendación de algoritmos**: sugerencia de algoritmos alternativos para casos donde el usuario muestra tiempos de ejecución consistentemente por encima de la media de referencia (Parte 10.1).
- **Detección de malas costumbres**: patrones recurrentes (regrips sistemáticos, rotaciones innecesarias repetidas, algoritmos subóptimos usados de forma consistente).
- **Propuesta de entrenamientos**: plan semanal/mensual adaptativo basado en el histórico real (no genérico).
- **Comparación de progreso**: evolución del propio usuario en ventanas de tiempo comparables.
- **Identificación de puntos débiles**: cruce de métricas de fase + algoritmo + consistencia para señalar el cuello de botella real, replicando y generalizando el patrón ya validado por la competencia (diferenciar "F2L lento" de "reconocimiento lento entre parejas", como documenta el propio análisis del sector).
- **Explicación de teoría**: acceso conversacional a la teoría detrás de cada método/caso, enlazado con la Algorithm Database.

---

# PARTE 14 — UX / UI

## 14.1 Superficies principales

- **Dashboard**: resumen de progreso reciente, próxima sesión de entrenamiento recomendada, rachas, objetivos activos.
- **Entrenamiento**: selector de módulo (Parte 9), sesión activa, resultados inmediatos.
- **Análisis**: vista de detalle de un solve concreto, con Cubo 3D interactivo, timeline de fases y métricas.
- **Biblioteca / Algoritmos**: navegación de la Algorithm Database (Parte 10), estado de aprendizaje propio.
- **3D**: visor libre de reproducción y comparación de solves.
- **Perfil**: identidad, métodos declarados, hardware conectado.
- **Configuración**: hardware, preferencias de timer, privacidad de datos.
- **Comparativas**: usuario vs. su propio histórico, y opcionalmente vs. comunidad (anonimizado, opt-in).
- **Gráficas**: series temporales configurables (evento, sesión, rango, métrica).
- **Widgets**: componentes reutilizables entre Dashboard y Análisis (mini-gráficas, indicadores de racha, etc.).

## 14.2 Principios de diseño

- Cronometrado siempre accesible en un toque/tecla, sin fricción — la lección de UX más clara de csTimer y Twisty Timer.
- Análisis avanzado disponible pero no intrusivo por defecto (progresivo: el usuario nuevo ve lo simple, el usuario avanzado puede profundizar).
- Consistencia visual entre la vista 2D de estadísticas y la vista 3D de reproducción (mismos colores de cara, misma notación).

---

# PARTE 15 — MODELO DE DATOS

## 15.1 Entidades principales (nivel conceptual)

```
User (1) ───< Profile
User (1) ───< HardwareDevice (N)          [cubos vinculados, por adaptador HAL]
User (1) ───< Session (N)
Session (1) ───< Solve (N)
Solve (1) ───< MoveEvent (N)              [append-only, inmutable]
Solve (1) ───< AnalysisResult (N)          [versionado por motor de análisis]
User (1) ───< AlgorithmProgress (N) >─── Algorithm
Algorithm (N) >─── AlgorithmSet (N)        [OLL, PLL, F2L, ZBLL, etc.]
User (1) ───< TrainingSession (N)
TrainingSession (1) ───< TrainingAttempt (N)
User (1) ───< Goal (N)
```

## 15.2 Consideraciones de escalabilidad

- **MoveEvent** es, con diferencia, la tabla de mayor volumen de escritura (cada solve genera decenas de eventos). Se recomienda almacenamiento en una base orientada a series temporales o partición por usuario/fecha en el almacén relacional, separada físicamente de las tablas de baja cardinalidad (Algorithm, AlgorithmSet).
- **Solve** y **AnalysisResult** se mantienen en el almacén relacional principal (PostgreSQL), con índices por usuario, fecha y evento para las consultas de dashboard/estadísticas.
- **Reconstrucciones completas** (stream íntegro de movimientos + metadata para reproducción 3D) pueden almacenarse en Object Storage en formato comprimido, referenciadas desde `Solve`, evitando engordar la base relacional con blobs.
- **Cache** (Redis) para agregaciones costosas de uso frecuente (medias móviles del dashboard).

## 15.3 Versionado y migraciones

- Migraciones explícitas y reversibles en cada cambio de esquema.
- `AnalysisResult` versiona el motor de análisis que lo generó (Parte 8.4), permitiendo convivencia de resultados de distintas versiones sin romper históricos.
- `Algorithm` versiona cambios de notación/algoritmo recomendado, preservando el histórico de qué se recomendaba en cada momento (relevante para auditar decisiones de la IA a posteriori).

---

# PARTE 16 — ROADMAP POR FASES

### Fase 0 — FundacIones

**Objetivo**: Timer core offline-first + arquitectura base + primer adaptador de hardware (GAN).

- Timer manual y por smart cube (GAN).
- HAL con un único adaptador productivo.
- Modelo de datos base (Solve, MoveEvent, Session).
- Solver Engine embebido (min2phase) para scrambles y solución óptima de referencia.
- **Dependencias**: ninguna externa crítica más allá de las librerías identificadas en Parte 0.3-0.4.
- **Riesgos**: estabilidad del protocolo BLE de GAN entre generaciones (Gen2/3/4) — mitigado reutilizando librerías ya validadas por la comunidad.
- **Complejidad**: Media-alta (la integración BLE es la parte más delicada).

### Fase 1 — Análisis y Cubo 3D

**Objetivo**: Analysis Engine básico (detección de fase, TPS, comparación con óptimo) + Cube3D Engine funcional.

- Reproducción de solves grabados.
- Split de fases para CFOP como primer método soportado.
- **Dependencias**: Fase 0 completa (necesita el stream de MoveEvent).
- **Riesgos**: precisión de reconstrucción de estado facelet a partir de streams con posible pérdida de eventos BLE.
- **Complejidad**: Alta.

### Fase 2 — Biblioteca de algoritmos y entrenamiento base

**Objetivo**: Algorithm Database + F2L/OLL/PLL Trainers + repetición espaciada.

- Importación de catálogo base compatible con formatos existentes del sector.
- **Dependencias**: Fase 1 (el entrenador se apoya en Cube3D y en el Solver Engine para scrambles filtrados por caso).
- **Riesgos**: calidad/curación del contenido inicial del catálogo.
- **Complejidad**: Media.

### Fase 3 — Tracking avanzado y multi-método

**Objetivo**: Estadísticas avanzadas completas (Parte 11) + soporte Roux/ZZ/Petrus/LBL como method plugins.

- **Dependencias**: Fase 1 y 2.
- **Riesgos**: correcta definición de fases y detección de transición para métodos no-CFOP, cada uno con su propia lógica.
- **Complejidad**: Alta.

### Fase 4 — Multi-fabricante de hardware

**Objetivo**: Adaptadores MoYu, QiYi, Giiker vía HAL; SDK público de adaptadores.

- **Dependencias**: Fase 0 (HAL debe estar ya estabilizado como contrato).
- **Riesgos**: variabilidad y falta de documentación oficial de protocolos no-GAN; dependencia de ingeniería inversa comunitaria.
- **Complejidad**: Alta.

### Fase 5 — Inteligencia Artificial

**Objetivo**: AI Service completo (explicación, recomendación, generación de entrenamientos personalizados).

- **Dependencias**: Fases 1-3 (la IA necesita datos de análisis y tracking maduros para ser útil, no genérica).
- **Riesgos**: calidad/confianza de las recomendaciones tempranas con poco histórico por usuario; mitigado con umbrales mínimos de datos antes de activar recomendaciones fuertes.
- **Complejidad**: Alta.

### Fase 6 — Comunidad y escalado

**Objetivo**: Comparativas, retos, compartición pública opcional; hardening de infraestructura para escala (particionado de MoveEvent, cache avanzada).

- **Dependencias**: todas las anteriores.
- **Riesgos**: privacidad de datos compartidos; coste de infraestructura a escala.
- **Complejidad**: Media-alta (más organizativa/infraestructura que algorítmica).

---

# PARTE 17 — REFERENCIAS, REPOSITORIOS Y BIBLIOGRAFÍA

**Timers y plataformas**

- csTimer — https://github.com/cs0x7f/cstimer
- Twisty Timer (Android)
- Cubeast — https://www.cubeast.com/
- CubeDesk — https://cubedesk.io
- acubemy — https://acubemy.com/
- GAN Cube Station / GAN iStation (ecosistema propietario GAN)

**Motores de resolución**

- hkociemba/RubiksCube-TwophaseSolver — https://github.com/hkociemba/RubiksCube-TwophaseSolver
- cs0x7f/min2phase — https://github.com/cs0x7f/min2phase
- rokicki/twophase.js — https://github.com/rokicki/twophase.js
- torjusti/cube-solver — https://github.com/torjusti/cube-solver
- efrantar/rob-twophase — https://github.com/efrantar/rob-twophase
- Kociemba, H. — "The Two-Phase Algorithm" — https://kociemba.org/math/twophase.htm

**Scrambles oficiales (WCA)**

- WCA Regulations — Scrambles — https://www.worldcubeassociation.org/regulations/scrambles/
- thewca/tnoodle — https://github.com/thewca/tnoodle
- thewca/tnoodle-lib — https://github.com/thewca/tnoodle-lib
- SpeedcuberOSS/tnoodle-cli — https://github.com/SpeedcuberOSS/tnoodle-cli

**Visualización 3D**

- cubing/cubing.js (Twizzle) — https://github.com/cubing/cubing.js/
- Experimentos y apps de referencia — https://experiments.cubing.net/cubing.js/

**Protocolos de smart cubes**

- afedotov/gan-web-bluetooth — https://github.com/afedotov/gan-web-bluetooth
- afedotov/gan-cube-sample — https://github.com/afedotov/gan-cube-sample
- cubing/cubing.js — decodificador GAN (`gan.ts`) — https://github.com/cubing/cubing.js/blob/main/src/cubing/bluetooth/smart-puzzle/gan.ts
- shanedirksen/gan-cube-windows-app — https://github.com/shanedirksen/gan-cube-windows-app
- Hilo comunitario de ingeniería inversa GAN 356i — SpeedSolving Puzzles Community

**Bases de datos de algoritmos y contenido educativo**

- AlgDB, SpeedCubeDB (bases de datos de algoritmos consultables)
- CubeSkills, JPerm.net (contenido educativo de referencia)

**Nota de licencias**: varios de los repositorios citados (csTimer, algunas ramas de cubing.js, tnoodle-lib) están licenciados bajo GPLv3, lo que impone obligaciones de código abierto sobre cualquier derivado que los incorpore directamente. Cualquier integración directa de código (no solo de protocolo/formato) debe auditarse legalmente antes de un lanzamiento comercial de código cerrado; la alternativa más segura es reimplementar la lógica de protocolo (ya documentada públicamente) bajo licencia propia, tal y como ya han hecho terceros como `gan-cube-windows-app`.

---

*Fin del documento. Este documento está pensado como documentación maestra viva: cada Fase del roadmap (Parte 16) debe generar sus propios documentos de diseño técnico detallado (Technical Design Documents) que referencien este documento como fuente de verdad arquitectónica.*
