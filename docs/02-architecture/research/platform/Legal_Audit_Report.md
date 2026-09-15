# Legal Audit Report: GPLv3 Compatibility (DEC-01)

## 1. Metadata
- **ID**: DEC-01
- **Title**: Licensing Compatibility Audit
- **Purpose**: Determinar las implicaciones legales de utilizar dependencias con licencia GPLv3 (`cubing.js`, `min2phase`) en la arquitectura de Cubalyze.
- **Status**: Complete
- **Date**: 2026-07-12
- **Confidence Level**: High

## 2. Contexto del Problema
Cubalyze planea utilizar librerías críticas de la comunidad como `cubing.js` (para renderizado 3D y notación) y `min2phase` (para algoritmos de resolución y scramble). Estas librerías están licenciadas bajo **GNU General Public License v3.0 (GPLv3)**.

La licencia GPLv3 es una licencia *copyleft fuerte* (viral). Esto significa que cualquier software que se enlace, importe o derive de código GPLv3 debe ser distribuido bajo la misma licencia GPLv3 si dicho software se distribuye al público.

## 3. Implicaciones Arquitectónicas

### 3.1. Impacto en la Aplicación Frontend (SPA/PWA)
Si la aplicación web de Cubalyze (React/Vite) importa y empaqueta `cubing.js` o `min2phase` en su *bundle* de JavaScript, toda la aplicación frontend frontend **se considera un trabajo derivado**. 
*   **Consecuencia**: El código fuente completo del frontend de Cubalyze debe ser publicado bajo licencia GPLv3 (o compatible) de forma gratuita y accesible para todos los usuarios.

### 3.2. Impacto en Mobile/Desktop Wrappers (Capacitor/Tauri)
Si en el futuro se distribuye una aplicación nativa en iOS/Android o escritorio (Tauri) que envuelva la PWA que contiene este código GPLv3:
*   **Consecuencia**: La aplicación móvil/escritorio completa debe ser liberada bajo GPLv3. Las tiendas de aplicaciones (especialmente la App Store de Apple) han tenido históricamente fricciones con aplicaciones GPL, aunque las PWAs empaquetadas o Capacitor generalmente pueden publicarse si se cumple con ofrecer el código fuente.

### 3.3. Impacto en Backend (Servicios Cloud)
La GPLv3 no afecta al backend si este se ejecuta en un servidor y se comunica con el frontend a través de una API HTTP/REST (como Supabase o un servidor Node.js propio).
*   **Consecuencia**: El código del backend puede mantenerse propietario/cerrado siempre que no importe directamente el código GPLv3. (Nota: Existe la licencia AGPLv3 que sí afecta al backend, pero `cubing.js` es GPLv3, no AGPLv3).

## 4. Escenarios de Negocio

### Escenario A: Proyecto 100% Open Source
Si la intención de Cubalyze es ser un proyecto comunitario 100% de código abierto y gratuito:
*   **Viabilidad**: Perfecta.
*   **Riesgo**: Ninguno.
*   **Acción**: Adoptar `cubing.js` y licenciar el repositorio de Cubalyze bajo GPLv3.

### Escenario B: Proyecto Comercial (Frontend Cerrado / Monetización SaaS)
Si se pretende mantener el frontend de Cubalyze como código cerrado (propietario) para monetización o evitar clones:
*   **Viabilidad**: Imposible usando las dependencias actuales.
*   **Riesgo**: Crítico (Infracción de derechos de autor).
*   **Acción**: No se puede usar `cubing.js` ni `min2phase`. Habría que construir un ecosistema 3D de cubos (basado en Three.js) y un solver de scrambles propio desde cero (o buscar librerías MIT/Apache).

### Escenario C: Modelo Híbrido (Open Core)
*   **Acción**: El frontend (que incluye el visor 3D y el solver offline) se licencia bajo GPLv3 y es abierto. Las funciones "Premium" se manejan en el backend propietario o a través de APIs de suscripción que no incluyan código de estas librerías.

## 5. Recomendación y Siguientes Pasos
Dado que Cubalyze nace con una fuerte filosofía comunitaria y modular (plugin-system), el **Escenario A** (o C) es el más natural.

**Next Action (Para actualizar en el Register)**: 
1. El líder de producto debe confirmar si Cubalyze se licenciará públicamente bajo GPLv3.
2. Si la respuesta es afirmativa, el bloqueo legal de **DEC-01** queda resuelto y se pueden iniciar los Benchmarks de Renderizado (DEC-10) usando `cubing.js`.
3. Crear el archivo `LICENSE` en la raíz del repositorio con la licencia GPLv3.
