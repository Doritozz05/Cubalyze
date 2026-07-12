---
status: "Ready for ADR"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
depends_on: "DEC-09, DEC-18"
tags: "security, cryptography, offline-first"
document_type: "RFC"
---

# RFC-018-Security_Crypto

## Summary
Este RFC propone implementar un mecanismo de **firmado criptográfico local** utilizando la Web Crypto API (o Ed25519) para validar la integridad de los tiempos de resolución (solves) registrados localmente antes de sincronizarlos con la base de datos en la nube.

## Motivation
En una PWA offline-first, la fuente de la verdad para un tiempo de resolución recién hecho es el navegador del usuario. Sin validaciones, es trivial que un usuario modifique maliciosamente IndexedDB o la memoria de SQLite local para forjar un tiempo de "0.01s" y alterar las tablas de clasificación mundiales (Leaderboards). 

## Proposed Solution
*   **Mecanismo:** Al arrancar, si el usuario está autenticado, el cliente genera (o recupera) un par de claves criptográficas y asocia la pública a su sesión en Supabase.
*   **Firma Continua:** Cuando el cronómetro se detiene, el Core toma el hash del evento (scramble + tiempo exacto + timestamp + sal), lo firma con la clave privada local y guarda ese bloque en la DB offline.
*   **Validación en Backend:** Cuando se reestablece la red y se sincroniza, el Backend (Postgres RLS / Edge Functions) verifica la firma con la clave pública asociada a ese dispositivo.

## Detailed Design
*   Utilizaremos el estándar nativo de los navegadores: `window.crypto.subtle` (Web Crypto API) para operaciones de bajo coste usando curvas elípticas (ECDSA).
*   La clave privada se almacenará en OPFS o IndexedDB en un formato no exportable (protegido por el sandbox del navegador).
*   Cualquier tiempo enviado sin firma, o con firma inválida, será clasificado como "Unverified" en la plataforma, protegiendo las leaderboards oficiales.

## Drawbacks
*   **No infalible a nivel de cliente:** Un usuario sofisticado que controle completamente su entorno de navegador, inyectando scripts directamente en la VM de JS, podría interceptar el cronómetro antes de que se genere la firma. Evitar esto al 100% en Web es imposible (requeriría un anticheat a nivel de SO).
*   **Complejidad de Recuperación:** Si el usuario borra la caché del navegador perdiendo su clave privada antes de sincronizar los *solves* offline, esos tiempos no podrán verificarse y podrían quedar marcados como no oficiales.

## Alternatives
*   **Validación Backend-only:** Imposible bajo el modelo offline-first, donde los tiempos se generan sin conexión de red y se pueden acumular.
*   **Ofuscación simple:** Esconder el código. Inútil contra devtools modernas.

## Unresolved Questions
*   ¿Manejaremos un sistema de atestación criptográfica rotativa para incrementar la seguridad en caso de un leak de la clave en cliente, o un solo par de llaves vinculadas al token JWT de Supabase será suficiente?
