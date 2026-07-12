# Research Report: Web Bluetooth & iOS Fallbacks (DEC-03)

## 1. Metadata
- **ID**: A.2 (DEC-03)
- **Title**: Bluetooth Connectivity & iOS Fallbacks
- **Purpose**: Determinar cómo conectarán los usuarios móviles de iOS (iPhone/iPad) sus Smart Cubes a CubeForge, dado que Apple no soporta Web Bluetooth en Safari.
- **Status**: Complete
- **Date**: 2026-07-12
- **Confidence Level**: High

## 2. Contexto del Problema
CubeForge depende del uso de Smart Cubes (vía Bluetooth LE) para registrar movimientos y tiempos en tiempo real.
La API `Web Bluetooth` (que permite conectar el cubo directamente desde el navegador sin instalar apps) es soportada oficialmente por Chrome/Edge en Windows, macOS, Android y Linux.
**Bloqueo**: Apple se ha negado explícitamente a implementar Web Bluetooth en WebKit (Safari iOS) alegando preocupaciones de privacidad y seguridad. Ningún navegador en iOS (ni siquiera Chrome para iOS) soporta Web Bluetooth porque todos usan el motor WebKit por debajo.

## 3. Análisis de Soluciones (Fallbacks para iOS)

### Opción 1: Navegadores de Terceros Especializados (WebBLE / Bluefy)
Existen aplicaciones en la App Store (como WebBLE o Bluefy) que son navegadores web diseñados específicamente para inyectar *polyfills* de Web Bluetooth en páginas web.
*   **Pros**: Cero código extra requerido. Si funciona en Chrome (Android/Desktop), funcionará en Bluefy.
*   **Cons**: Pésima experiencia de usuario (UX). Hay que pedirle al usuario que descargue una app de navegador desconocida y navegue hasta nuestra URL. Algunas de estas apps son de pago o están abandonadas.

### Opción 2: Capacitor.js + PWA
Capacitor es una capa nativa (construida por Ionic) que envuelve tu aplicación web (React/Vite) y la empaqueta como una aplicación nativa para iOS y Android.
Capacitor cuenta con el plugin mantenido por la comunidad `@capacitor-community/bluetooth-le` que expone la API Bluetooth nativa de iOS al código JavaScript.
*   **Pros**: Se reutiliza el 99% del código fuente de la PWA. Los usuarios instalan la app desde la App Store. Experiencia premium y control total sobre el escaneo Bluetooth.
*   **Cons**: Requiere mantener una cuenta de Apple Developer ($99/año). Requiere implementar una capa de abstracción en nuestro código: `if (isCapacitor) useCapacitorBLE() else useWebBluetooth()`.

### Opción 3: Ignorar iOS para Smart Cubes (Temporal)
Lanzar la PWA oficial, permitiendo Bluetooth en Android/Desktop, pero mostrando un mensaje en iOS: "Para usar Smart Cubes en iOS, por favor usa una PC o Android. Estamos trabajando en una App Nativa".
*   **Pros**: 0 costo de desarrollo. Permite validar el *product-market fit* del solver de scrambles, timers manuales y analíticas en iOS.
*   **Cons**: Frustración inicial para usuarios de iPhone que tengan un Smart Cube.

## 4. Recomendación Arquitectónica
Dado el enfoque iterativo de CubeForge, la estrategia a seguir será una mezcla estructurada:

### Hito 1 (MVP Web): Opción 3 + Opción 1
1.  Construir y validar toda la arquitectura del cubo Bluetooth usando la API nativa `Web Bluetooth` estándar.
2.  Desplegar la PWA de forma universal.
3.  Usuarios de iOS sin Smart Cube: Pueden usar la PWA (manual/timer/algoritmos) sin problemas.
4.  Usuarios de iOS con Smart Cube: Se les muestra un modal recomendando usar Android/PC, u opcionalmente, que descarguen el navegador **Bluefy** como *hack* temporal.

### Hito 2 (Expansión Móvil): Opción 2 (Capacitor)
Una vez que el "Core" de análisis matemático y rendering 3D sea estable, se ejecutará el proyecto de envolver la SPA en **Capacitor**.
*   Esto resolverá tanto **DEC-03** (Bluetooth Nativo en iOS) como **DEC-02** (Persistencia, ya que la app nativa no sufre las purgas agresivas de Safari).

## 5. Conclusión y Siguientes Pasos
**Estado de DEC-03**: Completado.
*   El desarrollo primario **NO** se encuentra bloqueado por iOS. Se escribirá el código de conectividad usando la API Web Bluetooth estándar (`navigator.bluetooth`). Se diseñará una interfaz de abstracción para el gestor Bluetooth (`IBluetoothManager`) de modo que en el futuro se pueda inyectar el adaptador de Capacitor fácilmente.
*   **Next Action**: Actualizar el `Architecture_Decision_Register.md` y comenzar el desarrollo del paquete `core-hal` (Hardware Abstraction Layer).
