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

### 3.1. Stackmat Timer (Audio RS-232 Bit-banging)

El protocolo Stackmat **NO** utiliza FSK. Transmite una señal serial estándar **RS-232 a 1200 baudios (8N1: 8 bits, sin paridad, 1 stop bit)** directamente inyectada por el cable de audio. A diferencia de los cubos, transmite datos *continuamente* (ráfagas cada ~0.1s).

*   **Infraestructura**: Usaremos la `Web Audio API` pidiendo permisos con `navigator.mediaDevices.getUserMedia({ audio: true })`.
*   **Decodificación UART por Software**: Escribiremos un `AudioWorkletProcessor` para aislar el proceso. Analizará los cruces por cero (*zero-crossings*) en el búfer de Float32 a 44100Hz para medir la anchura de los pulsos, deducir los bits a 1200 baudios y ensamblarlos en paquetes de 9 bytes.
*   **Protocolo de Paquete (Gen4)**: Cada paquete contiene un Byte de Comando ('I', 'A', 'S', 'L', 'R'), 5 bytes ASCII de tiempo, 1 byte de Checksum, y CR+LF.
*   **Traducción**: Al recibir el comando 'A' o 'C' (ambas manos), el `StackmatAdapter` dispara el evento `hardwareDown`. Al pasar a ' ' o 'S', `hardwareUp`.

### 3.2. GAN Timer (Web Bluetooth)

El cronómetro de GAN usa Bluetooth Low Energy (BLE).
*   Se solicitará acceso vía `navigator.bluetooth.requestDevice()`.
*   A diferencia de los cubos, los paquetes del GAN Timer son más simples y no requieren una desencriptación criptográfica compleja.
*   Emite notificaciones cuando el usuario toca o suelta la placa, que se mapean a `hardwareDown` y `hardwareUp`.

## 4. Integración de Smart Cubes: GAN (Fase 2.4)

A diferencia de los Timers, los Smart Cubes **son impulsados por eventos (Event-Driven)**. Para ahorrar batería, no transmiten datos continuamente; solo emiten notificaciones BLE (paquetes AES de 20 bytes) cuando ocurre un giro físico (o a 20-50Hz si el giroscopio está activado explícitamente). En lugar de reescribir la ingeniería inversa desde cero, CubeForge integrará la librería `gan-web-bluetooth`.

1.  **Fork de la Librería**: El código fuente de `gan-web-bluetooth` se copiará y adaptará dentro de nuestro monorepo como el paquete `@cubeforge/gan-protocol`.
2.  **Adaptador GAN**: Se escribirá una clase `GanCubeAdapter` que implemente `SmartCubeAdapter`, enrutando las notificaciones GATT a la lógica de descifrado AES del fork, y finalmente emitiendo `CubeMoveEvent`.

## 5. Middleware de Clock Drift (Fase 2.5)

Los cristales de cuarzo dentro de los cubos GAN tienen fluctuaciones, causando que sus marcas de tiempo difieran ligeramente del reloj del PC.
*   Implementaremos una función compartida `reconcileTimestamps()`.
*   Almacenará un historial en ventana (ej. últimos 20 movimientos) con los pares `[cubeTimestamp, hostTimestamp]`.
*   Se aplicará un algoritmo de Regresión Lineal de Mínimos Cuadrados para ajustar la pendiente y predecir el tiempo exacto en la escala del navegador, permitiendo cálculos precisos de TPS en la fase de Análisis.

## 6. Plan de Pruebas

*   **Audio**: Simularemos *buffers* de audio pregrabados de un Stackmat (arrays de Float32) y verificaremos que el `AudioWorklet` extraiga los tiempos correctos.
*   **Bluetooth**: Utilizaremos Mocks del API de Web Bluetooth para inyectar paquetes hexadecimales pre-grabados de un cubo GAN real y verificaremos que se emitan los movimientos 'U', 'R', etc., con los tiempos reconciliados.
