/**
 * Declaraciones ambient para el tsconfig de TypeDoc (tsconfig.typedoc.json).
 *
 * La web importa `*.css` y usa `import.meta.env.DEV` / `import.meta.env.BASE_URL`.
 * En el entorno normal esos tipos vienen de `vite/client`, pero vite no está
 * enlazado en la raíz del workspace (es devDep de apps/web), así que aquí se
 * declaran de forma mínima y autónoma. No se usa para builds ni CI.
 */

declare module '*.css';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.webp';
declare module '*.woff';
declare module '*.woff2';

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
