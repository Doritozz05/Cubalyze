---
status: "Accepted"
owner: "Architecture Lead"
reviewers: "Principal Architect"
created: "2026-07-12"
last_updated: "2026-07-12"
version: "1.0.0"
related_rfc: "RFC-007-Hosting_Strategy"
tags: "ops, CD, hosting, infrastructure, vercel, supabase"
document_type: "ADR"
---

# ADR-007-Hosting_Strategy

## Context and Problem Statement

Para materializar el proyecto CubeForge sin incurrir en costes iniciales, se requiere definir una infraestructura de alojamiento y servicios de backend que ofrezca un "tier gratuito" (Free Tier) lo suficientemente generoso como para soportar el ciclo de vida de desarrollo y a los primeros usuarios en producción. 
Dado que el ecosistema se ha diseñado (según ADR-008) como una SPA PWA puramente estática con lógica pesada de cálculo (WASM) y renderizado 3D delegada al cliente, el backend no necesita poder de cómputo intensivo, sino más bien almacenamiento de datos estructurados, sincronización y autenticación.

## Decision Drivers

* **Coste Cero:** Requisito indispensable de usar infraestructuras "Full Gratuito" (Free Tier) viables a medio plazo.
* **Soporte para Frontend Estático:** Red de distribución global (CDN) rápida y optimizada para servir el `index.html`, los assets 3D y el Service Worker.
* **Backend as a Service (BaaS):** Evitar la complejidad de levantar y mantener contenedores de bases de datos y servidores de autenticación.
* **Compatibilidad con la estrategia Offline-First:** Los datos se sincronizan puntualmente hacia la nube, sin requerir conexión constante.

## Considered Options

* **Opción 1:** Vercel (Frontend) + Supabase (Backend/Auth/DB).
* **Opción 2:** GitHub Pages / Cloudflare Pages (Frontend) + Firebase.
* **Opción 3:** Servidor VPS gratuito (ej. Oracle Cloud) alojando contenedores Docker propios.

## Decision Outcome

Chosen option: **Opción 1: Vercel (Frontend) + Supabase (Backend/Auth/DB)**.

Se elige esta combinación porque se ajusta de forma perfecta a la naturaleza de la aplicación y garantiza un coste inicial de 0€ con altísima escalabilidad:

1.  **Vercel:** Al ser una SPA (React+Vite), el frontend consiste únicamente en archivos estáticos. El plan "Hobby" de Vercel es sobresaliente en la distribución de sitios estáticos mediante CDN global, con CI/CD automatizado instantáneo y sin las limitaciones de tiempo de cómputo (Serverless Functions) dado que CubeForge no usa SSR.
2.  **Supabase:** Funciona como un backend completo sobre PostgreSQL. Su capa gratuita permite 50,000 MAUs (usuarios activos), 500MB de base de datos (suficiente para registrar cientos de miles de tiempos de resolución que son solo datos tabulares), y provee de forma nativa Autenticación y APIs REST/Realtime automáticas (PostgREST). 

Como CubeForge delega el esfuerzo computacional al navegador (motor 3D y WASM) y usa estado offline, las llamadas al servidor (Supabase) son esporádicas (solo para sincronizar sesiones). Esta arquitectura minimiza el consumo de ancho de banda y conexiones concurrentes de servidor, maximizando la utilidad de los niveles gratuitos.

### Positive Consequences

* **Cero coste operativo** para arrancar y soportar un volumen considerable de usuarios tempranos.
* **Cero mantenimiento de infraestructura:** Ni Supabase ni Vercel requieren mantenimiento de servidores, parches del SO o configuración de balanceadores.
* **Velocidad de desarrollo:** Supabase genera la API de forma automática según el esquema de base de datos y la Autenticación viene "out-of-the-box".

### Negative Consequences

* Limitaciones de escalado abrupto: Si la aplicación se vuelve masivamente viral, el salto del Free Tier de Supabase al de pago (Pro) conlleva un coste fijo de ~$25/mes, y las bases de Vercel Pro son de ~$20/mes por usuario.
* Dependencia estricta del proveedor (Vendor Lock-in moderado), aunque menor en Supabase al estar basado 100% en Postgres Open Source.

## Pros and Cons of the Options

### Opción 1: Vercel + Supabase
* **Good, because:** Vercel es el estándar de oro para DX en despliegues estáticos con Vite.
* **Good, because:** Supabase ofrece una verdadera base de datos relacional Postgres con control de acceso por filas (RLS).
* **Good, because:** Encaja matemáticamente con el hecho de que el cómputo pesado en CubeForge ocurre en el cliente (WASM).

### Opción 2: Cloudflare Pages + Firebase
* **Good, because:** Cloudflare Pages tiene ancho de banda virtualmente ilimitado.
* **Bad, because:** Firebase (NoSQL) suele ser menos estructurado y más problemático para consultas analíticas complejas (estadísticas de tiempos de cubos) en comparación con Postgres.

### Opción 3: VPS Gratuito (Oracle Cloud) con Docker
* **Good, because:** Control total y cero lock-in comercial.
* **Bad, because:** El esfuerzo de mantener, parchear la seguridad de la DB, configurar proxies inversos y certificados SSL rompe por completo la velocidad y filosofía de desarrollo ágil en solitario.
