---
status: "Draft"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "None"
tags: "hardware, bluetooth, ios, capacitor, pwa"
document_type: "RFC"
---

# RFC-012-Web_Bluetooth_Mobile_Fallbacks

## Summary
Este RFC detalla la arquitectura de integración de Bluetooth Low Energy (BLE) para conectar cubos inteligentes (Smart Cubes) desde navegadores de escritorio y, críticamente, resuelve las deficiencias de Web Bluetooth en navegadores iOS (DEC-03).

## Motivation
Una de las funcionalidades *killer* de CubeForge es analizar tiempos en vivo mediante "Smart Cubes" Bluetooth (ej. GAN, MoYu). En escritorio (Chrome/Edge) y Android (Chrome), la API `navigator.bluetooth` (Web Bluetooth) funciona nativamente. Sin embargo, **iOS Safari no soporta Web Bluetooth**. Esto rompe la compatibilidad del PRD en el ecosistema de Apple, por lo que requerimos una estrategia de *Fallback* para iOS (ej. aplicación *wrapper* con Capacitor).

## Proposed Solution
(Pendiente de investigación de viabilidad). Proponemos abstraer la lógica Bluetooth en una capa "Hardware Abstraction Layer (HAL)" de CubeForge. Si el entorno provee `navigator.bluetooth`, el HAL usará la API web nativa. En caso contrario (iOS), el cliente detectará el entorno y se comunicará mediante puentes nativos con un *wrapper* de Capacitor (usando plugins comunitarios BLE para iOS).

## Detailed Design
(TBD)

## Alternatives
*   **Requerir WebBLE app en iOS:** Obligar a los usuarios de iPhone a descargar un navegador especial de pago (ej. Bluefy/WebBLE) que expone el API de Bluetooth. Rompe la fricción de entrada, pero elimina la necesidad de mantener código nativo iOS.
*   **React Native / Tauri Mobile:** Abandonar PWA en favor de apps puramente nativas o híbridas complejas. (Descartado temporalmente en DEC-22 por complejidad).

## Unresolved Questions
*   ¿Existen plugins de Capacitor BLE actuales que expongan una interfaz compatible con el flujo asíncrono de un cronómetro a 60fps sin saturar el Bridge de Cordova/Capacitor?
*   ¿Deberíamos lanzar la app inicialmente sin soporte iOS BLE (PWA puro) y evaluar la demanda antes de incurrir en los costes de mantener una app de la App Store?
