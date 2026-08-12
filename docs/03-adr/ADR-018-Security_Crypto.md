---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "TBD"
created: "2026-07-12"
last_updated: "2026-08-12"
version: "1.1.0"
depends_on: "DEC-09, DEC-18"
tags: "security, cryptography, offline-first"
document_type: "ADR"
---

# ADR-018-Security_Crypto

## Summary
Este RFC propone implementar un mecanismo de **firmado criptogrÃ¡fico local** utilizando la Web Crypto API (o Ed25519) para validar la integridad de los tiempos de resoluciÃ³n (solves) registrados localmente antes de sincronizarlos con la base de datos en la nube.

## Motivation
En una PWA offline-first, la fuente de la verdad para un tiempo de resoluciÃ³n reciÃ©n hecho es el navegador del usuario. Sin validaciones, es trivial que un usuario modifique maliciosamente IndexedDB o la memoria de SQLite local para forjar un tiempo de "0.01s" y alterar las tablas de clasificaciÃ³n mundiales (Leaderboards). 

## Proposed Solution
*   **Mecanismo:** Al arrancar, si el usuario estÃ¡ autenticado, el cliente genera (o recupera) un par de claves criptogrÃ¡ficas y asocia la pÃºblica a su sesiÃ³n en Supabase.
*   **Firma Continua:** Cuando el cronÃ³metro se detiene, el Core toma el hash del evento (scramble + tiempo exacto + timestamp + sal), lo firma con la clave privada local y guarda ese bloque en la DB offline.
*   **ValidaciÃ³n en Backend:** Cuando se reestablece la red y se sincroniza, el Backend (Postgres RLS / Edge Functions) verifica la firma con la clave pÃºblica asociada a ese dispositivo.

## Detailed Design
*   Utilizaremos el estÃ¡ndar nativo de los navegadores: `window.crypto.subtle` (Web Crypto API) para operaciones de bajo coste usando curvas elÃ­pticas (ECDSA).
*   La clave privada se almacenarÃ¡ en OPFS o IndexedDB en un formato no exportable (protegido por el sandbox del navegador).
*   Cualquier tiempo enviado sin firma, o con firma invÃ¡lida, serÃ¡ clasificado como "Unverified" en la plataforma, protegiendo las leaderboards oficiales.

## Drawbacks
*   **No infalible a nivel de cliente:** Un usuario sofisticado que controle completamente su entorno de navegador, inyectando scripts directamente en la VM de JS, podrÃ­a interceptar el cronÃ³metro antes de que se genere la firma. Evitar esto al 100% en Web es imposible (requerirÃ­a un anticheat a nivel de SO).
*   **Complejidad de RecuperaciÃ³n:** Si el usuario borra la cachÃ© del navegador perdiendo su clave privada antes de sincronizar los *solves* offline, esos tiempos no podrÃ¡n verificarse y podrÃ­an quedar marcados como no oficiales.

## Alternatives
*   **ValidaciÃ³n Backend-only:** Imposible bajo el modelo offline-first, donde los tiempos se generan sin conexiÃ³n de red y se pueden acumular.
*   **OfuscaciÃ³n simple:** Esconder el cÃ³digo. InÃºtil contra devtools modernas.

## Implementation Status (2026-08-12)

**No implementado.** No hay uso de Web Crypto (`crypto.subtle`) en el código actual. La decisión queda registrada como diseño para cuando exista sincronización en la nube (ADR-019).

## Unresolved Questions
*   Â¿Manejaremos un sistema de atestaciÃ³n criptogrÃ¡fica rotativa para incrementar la seguridad en caso de un leak de la clave en cliente, o un solo par de llaves vinculadas al token JWT de Supabase serÃ¡ suficiente?

