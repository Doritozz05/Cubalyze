---
title: TDD 0005 - Hardware Abstraction Layer (HAL)
status: Approved
author: Antigravity
date: 2026-07-12
epic: 2
---

# TDD 0005: Hardware Abstraction Layer (HAL)

Este documento define la arquitectura técnica para conectar dispositivos de hardware externos (Cronómetros y Smart Cubes) a la plataforma CubeForge. 

## 1. Visión Arquitectónica

El objetivo principal es evitar el *vendor lock-in*. El resto de la aplicación interactuará con interfaces genéricas (`HardwareTimerAdapter`, `SmartCubeAdapter`) y nunca con clases específicas de fabricante. La arquitectura se divide en dos ramas:

1.  **Hardware Timers**: Dispositivos físicos utilizados exclusivamente para cronometrar (ej. Stackmat, GAN Timer). Se acoplan con nuestro `TimerEngine`.
2.  **Smart Cubes**: Cubos con sensores internos que reportan giros, estado y giroscopio. Se acoplan con nuestro `Cube3DEngine` y `AnalysisEngine`.

## 2. Core Interfaces (Fase 2.2)

Todos los adaptadores vivirán dentro de un nuevo paquete `@cubeforge/hardware-hal`.

### 2.1. Interfaces de Cubos

```typescript
export interface SmartCubeAdapter {
  readonly vendor: string; // 'GAN', 'MoYu', etc.
  readonly supportedModels: string[];
  
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Streams de eventos usando EventTarget o RxJS
  moves$: Observable<CubeMoveEvent>;
  battery$: Observable<number>;
  gyro$?: Observable<GyroEvent>;
}

export interface CubeMoveEvent {
  face: string;           // "U", "R'", "F2"
  cubeTimestamp: number;  // Tiempo interno del cubo (con posible drift)
  hostTimestamp: number;  // performance.now() del navegador
}
```

### 2.2. Interfaces de Timers

```typescript
export interface HardwareTimerAdapter extends EventTarget {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Emite eventos estandarizados que consume el TimerEngine
  // Eventos: 'hardwareDown', 'hardwareUp'
}
```

## 3. Integración de Cronómetros (Fase 2.3)

### 3.1. Stackmat Timer (Audio FSK)

El protocolo Stackmat transmite datos seriales a través de una onda de audio mediante *Frequency-shift keying* (FSK).

*   **Infraestructura**: Usaremos la `Web Audio API` pidiendo permisos con `navigator.mediaDevices.getUserMedia({ audio: true })`.
*   **Decodificación**: Se escribirá un `AudioWorkletProcessor` para aislar el proceso del hilo principal. Este procesador analizará la amplitud de la onda a 44100Hz para detectar los "bits" de inicio y fin, decodificando las ráfagas en números y estados (luces verde/roja, manos puestas).
*   **Traducción**: Cuando el decodificador detecta "manos puestas", el `StackmatAdapter` dispara el evento `hardwareDown`. Al soltarlas, `hardwareUp`.

### 3.2. GAN Timer (Web Bluetooth)

El cronómetro de GAN usa Bluetooth Low Energy (BLE).
*   Se solicitará acceso vía `navigator.bluetooth.requestDevice()`.
*   A diferencia de los cubos, los paquetes del GAN Timer son más simples y no requieren una desencriptación criptográfica compleja.
*   Emite notificaciones cuando el usuario toca o suelta la placa, que se mapean a `hardwareDown` y `hardwareUp`.

## 4. Integración de Smart Cubes: GAN (Fase 2.4)

En lugar de reescribir la ingeniería inversa desde cero, CubeForge integrará la librería `gan-web-bluetooth`.

1.  **Fork de la Librería**: El código fuente de `gan-web-bluetooth` se copiará y adaptará dentro de nuestro monorepo como el paquete `@cubeforge/gan-protocol` (o directamente dentro del HAL).
2.  **Adaptador GAN**: Se escribirá una clase `GanCubeAdapter` que implemente `SmartCubeAdapter`, enrutando las notificaciones GATT a la lógica de descifrado AES del fork, y finalmente emitiendo `CubeMoveEvent`.

## 5. Middleware de Clock Drift (Fase 2.5)

Los cristales de cuarzo dentro de los cubos GAN tienen fluctuaciones, causando que sus marcas de tiempo difieran ligeramente del reloj del PC.
*   Implementaremos una función compartida `reconcileTimestamps()`.
*   Almacenará un historial en ventana (ej. últimos 20 movimientos) con los pares `[cubeTimestamp, hostTimestamp]`.
*   Se aplicará un algoritmo de Regresión Lineal de Mínimos Cuadrados para ajustar la pendiente y predecir el tiempo exacto en la escala del navegador, permitiendo cálculos precisos de TPS en la fase de Análisis.

## 6. Plan de Pruebas

*   **Audio**: Simularemos *buffers* de audio pregrabados de un Stackmat (arrays de Float32) y verificaremos que el `AudioWorklet` extraiga los tiempos correctos.
*   **Bluetooth**: Utilizaremos Mocks del API de Web Bluetooth para inyectar paquetes hexadecimales pre-grabados de un cubo GAN real y verificaremos que se emitan los movimientos 'U', 'R', etc., con los tiempos reconciliados.
