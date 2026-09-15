/**
 * Derived-identity contract — the identicon HASH_SALTS are frozen.
 *
 * The avatar ("CubeMark") is a pure function of (profile seed, salts). The seed
 * is stored — locally and in the cloud — but the salts live only here, so
 * changing them silently re-skins the avatar of **every existing user** with no
 * error and no migration: the seed is still there, it just paints a different
 * picture.
 *
 * That makes the salts part of the app's identity surface, like the Tauri
 * identifier or a storage key: a rebranding renames the wordmark, not the
 * pixels users already associate with their account.
 *
 * Half of this contract is invisible to any search for the old name: the second
 * salt is `forgemark`, a token DERIVED from the wordmark that does not contain
 * the string `cubeforge` at all. Found by auditing the compiled bundle (see
 * apps/web/tests/contracts/artifactResidue.test.ts), not by grepping the name.
 *
 * If the salts ever must change, it is a product decision with a visible
 * consequence (everyone's avatar changes) — pair it with a release note.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HASH_SOURCE = readFileSync(join(__dirname, '..', 'hash.ts'), 'utf8');

/** The frozen list, in order: the order matters as much as the values. */
const FROZEN_SALTS = [
  'cubeforge',
  'forgemark',
  'cubemark',
  'identicon',
  'profile',
  'avatar',
  'seed',
  'glyph',
];

describe('identicon — contrato de salts (identidad derivada del usuario)', () => {
  it('la lista de salts es exactamente la histórica, en orden', () => {
    const block = /const HASH_SALTS = \[([\s\S]*?)\] as const;/.exec(HASH_SOURCE)?.[1];
    expect(block, 'no se pudo leer HASH_SALTS de hash.ts').toBeTruthy();

    const salts = (block as string)
      .split(',')
      .map((line) => line.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    expect(
      salts,
      'Los salts derivan el avatar de cada usuario. Cambiarlos re-skinnea a TODOS los usuarios ' +
        'existentes sin migración posible (el seed está guardado, el dibujo no). Si es intencional, ' +
        'actualiza este test junto con una nota de release.',
    ).toEqual(FROZEN_SALTS);
  });

  it('el salt derivado que no contiene el nombre antiguo sigue presente', () => {
    // `forgemark` no se puede encontrar buscando "cubeforge": solo aparece si se
    // audita el artefacto o se lee el fichero. Este test lo deja por escrito.
    expect(HASH_SOURCE).toContain("'forgemark'");
  });
});
