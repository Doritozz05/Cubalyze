/**
 * Handle reservation contract — el nombre NUEVO no se puede reclamar y el viejo
 * nunca se libera.
 *
 * `public.normalize_handle()` decide qué handles existen: devuelve NULL para los
 * reservados, y `handle_claim` lo traduce a `invalid`. Reservar un nombre es, por
 * tanto, una línea de SQL con consecuencias de identidad — y su fallo es
 * silencioso: si la lista pierde `cubalyze`, cualquiera puede registrarlo y nadie
 * se entera hasta que alguien se hace pasar por la app.
 *
 * Se fijan tres cosas:
 *
 *   1. La lista EFECTIVA —la ÚLTIMA definición de la función entre TODAS las
 *      migraciones, no un fichero por su nombre— reserva los dos nombres: el
 *      histórico (`cubeforge`, que no se libera jamás) y el nuevo (`cubalyze`).
 *      Se lee la última a propósito: así una migración POSTERIOR que se deje
 *      fuera cualquiera de los dos rompe el test, y esto sigue valiendo cuando la
 *      reserva se amplíe otra vez.
 *   2. La migración que definió la lista primero es INMUTABLE: está aplicada en
 *      el proyecto hosteado y su id ya está registrado, así que editarla haría que
 *      una base nueva ejecutara algo distinto con el mismo historial. Se fija por
 *      hash: es la única forma de que un `sed` bienintencionado falle en voz alta.
 *   3. La migración de la reserva solo redefine la función: no toca datos, avisa
 *      si el nombre ya está en uso y conserva el formato canónico y el
 *      `immutable` de los que depende el cliente.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));

/** La migración que definió la lista originalmente. NO se edita (ver el hash). */
const APPLIED_MIGRATION = '20260912000016_handle_identity.sql';
const APPLIED_SHA256 = '105b07e1e02647c80678c31006b1a12e5a81eaf576ed4b3d72998a253a7dcb36';

/**
 * Los ficheros se leen normalizando el fin de línea: git guarda `\n` y Windows
 * escribe `\r\n` al hacer checkout, así que sin esto el hash dependería de la
 * máquina — exactamente el fallo que esta guarda debe evitar en sí misma.
 */
function readNormalized(name: string): string {
  return readFileSync(MIGRATIONS_DIR + name, 'utf8').replace(/\r\n/g, '\n');
}

/** Migraciones ordenadas por nombre: el prefijo es la fecha, así que ordena igual que el tiempo. */
const migrationNames = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

/** Todas las que (re)definen la función, en orden de aplicación. */
const definitions = migrationNames
  .map((name) => ({ name, sql: readNormalized(name) }))
  .filter((entry) => entry.sql.includes('function public.normalize_handle'));

const effective = definitions[definitions.length - 1];

const DEFINITION = 'create or replace function public.normalize_handle';
const definitionStart = effective ? effective.sql.indexOf(DEFINITION) : -1;

/** El cuerpo de la última definición (hasta su `end $$;`). */
const effectiveFunction =
  effective && definitionStart >= 0
    ? effective.sql.slice(definitionStart, effective.sql.indexOf('end $$;', definitionStart))
    : '';

/**
 * Los nombres de la lista reservada. Se aísla el ARRAY declarado (delimitado por
 * `[` … `]`) en vez de buscar todos los strings del cuerpo: el cuerpo también
 * contiene el regex de formato, y contarlo como un nombre reservado haría que la
 * guarda midiera otra cosa de la que cree.
 */
const reservedArray = /reserved text\[\] := array\[([\s\S]*?)\]/.exec(effectiveFunction)?.[1] ?? '';
const effectiveReserved = [...reservedArray.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]!);

describe('handle reservation — la lista efectiva', () => {
  it('hay al menos dos definiciones y la última se puede leer (una guarda ciega pasa en falso)', () => {
    expect(
      definitions.length,
      'solo hay una definición de `normalize_handle`: falta la migración que reserva el nombre nuevo.',
    ).toBeGreaterThanOrEqual(2);
    expect(
      effective!.name >= APPLIED_MIGRATION,
      'el orden de las migraciones no es el esperado',
    ).toBe(true);
    expect(
      effectiveReserved.length,
      'no se extrajo ninguna entrada de la lista reservada',
    ).toBeGreaterThan(10);
  });

  it('reserva el nombre histórico (nunca se libera) y el nuevo', () => {
    expect(
      effectiveReserved,
      `«cubeforge» desapareció de la lista reservada (${effective!.name}). El handle histórico no se ` +
        'libera nunca: liberarlo lo expone a que lo reclame cualquiera en cuanto la marca deje de usarse.',
    ).toContain('cubeforge');
    expect(
      effectiveReserved,
      `«cubalyze» no está reservado (${effective!.name}). Sin reserva, cualquier usuario puede ` +
        'registrarse el handle de la marca.',
    ).toContain('cubalyze');
  });

  it('mantiene el formato canónico y el `immutable` (el cliente los da por hechos)', () => {
    // `handle.ts` del cliente asume el formato al validar antes de llamar y el
    // `handle_claim` es `security definer`, así que la función no puede volverse
    // `volatile` ni ampliar el alfabeto sin cambiar el contrato visible.
    expect(effectiveFunction).toContain("'^[a-z0-9_]{3,20}$'");
    expect(effectiveFunction).toMatch(/immutable/);
    expect(effectiveFunction).toContain('set search_path = public');
  });
});

describe('handle reservation — la migración aplicada es inmutable', () => {
  it(`${APPLIED_MIGRATION} no ha cambiado ni un byte`, () => {
    const actual = createHash('sha256').update(readNormalized(APPLIED_MIGRATION)).digest('hex');
    expect(
      actual,
      'Alguien editó una migración YA APLICADA. El CLI registra las migraciones por su id: el ' +
        'proyecto hosteado NO la vuelve a ejecutar, pero una base nueva (otro entorno local, un ' +
        'proyecto reconstruido) sí — mismo historial, contenido distinto. Si el cambio es ' +
        'necesario, va en una migración NUEVA; si de verdad hay que tocar esta, actualiza también ' +
        'este hash y explica por qué en el commit.',
    ).toBe(APPLIED_SHA256);
  });
});

describe('handle reservation — la migración nueva se contiene', () => {
  it('solo redefine la función: ningún cambio de datos', () => {
    const sql = effective!.sql;
    for (const forbidden of [
      /\bdelete\s+from\b/i,
      /\btruncate\b/i,
      /\bupdate\s+public\./i,
      /\bdrop\s+(table|index|column|function|schema)\b/i,
    ]) {
      expect(
        sql,
        `La migración de la reserva (${effective!.name}) contiene una operación destructiva ` +
          `(${forbidden}). Reservar un nombre no puede tocar filas ni objetos: solo amplía una lista.`,
      ).not.toMatch(forbidden);
    }
  });

  it('si el nombre nuevo ya está en uso, lo dice en voz alta en vez de aplicarlo en silencio', () => {
    const sql = effective!.sql;
    // Reservar impide reclamar, pero no expulsa a un titular previo: si lo
    // hubiera y la migración pasara de largo, la marca quedaría en manos de esa
    // cuenta sin que nadie se enterase.
    expect(sql).toContain('public.profiles');
    expect(sql).toMatch(/raise exception/i);
  });
});
