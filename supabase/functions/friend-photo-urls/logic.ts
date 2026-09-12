// Lógica pura del firmante de fotos de Fase 8 — sin `Deno`, sin red, sin
// Supabase. Vive aparte de `index.ts` por una razón concreta: era el único
// rincón de la fase que ninguna prueba podía ejecutar (el runtime Deno no corre
// en vitest), así que el test se limitaba a comprobar que el TEXTO del fuente
// contenía ciertas líneas — y por ahí se coló el bug A1: `Array.isArray()` sobre
// una columna `text`, que ningún assert de substring podía ver.
//
// Todo lo que se puede equivocar sin red está aquí y se prueba de verdad:
//   · qué identificadores son aceptables como segmento de ruta,
//   · cómo se leen las fotos declaradas por un ítem (`photos` es TEXT con JSON),
//   · cómo se convierte un `ref` del cliente en una ruta de objeto,
//   · y qué identificador de cuenta es canónico.

/** `{user}/{item}/{photo}/{full|thumb}.jpg` — el layout que escribe el uploader. */
export function objectPath(
  userId: string,
  itemId: string,
  photoId: string,
  rendition: "full" | "thumb",
): string {
  return `${userId}/${itemId}/${photoId}/${rendition}.jpg`;
}

/** 128-bit hex uuid, minúsculas. El `user_id` canónico de Postgres. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Identificador seguro como segmento de ruta: sin barras, sin traversal, acotado. */
export function safeSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return value;
}

/**
 * El `user_id` de una cuenta, en su forma canónica.
 *
 * El cliente manda el `user_id` que le devolvieron los RPC, así que en teoría ya
 * es canónico. Pero el firmante no puede fiarse de eso por dos motivos: (a) el
 * par canónico de `friendships` se compara como `uuid` en Postgres, y mezclar
 * mayúsculas aquí invertía `low`/`high` y negaba una amistad real; (b) la ruta
 * del objeto cuelga del id en minúsculas, así que una mayúscula firmaba una ruta
 * inexistente. Se normaliza y se exige la forma exacta: si no es un uuid, no es
 * una cuenta.
 */
export function canonicalUserId(value: unknown): string | null {
  const segment = safeSegment(value);
  if (!segment) return null;
  const lower = segment.toLowerCase();
  return UUID_RE.test(lower) ? lower : null;
}

/** Una referencia de foto declarada por un ítem (`GearPhotoRef`). */
interface PhotoLike {
  id?: unknown;
}

/**
 * Las fotos declaradas por un ítem, desde las DOS formas en las que llegan:
 *
 *   · `jsonb` ya parseado (arrays de PostgREST cuando el valor sale de un
 *     `jsonb`, o el fixture de un test), y
 *   · **string con JSON** — que es la forma real: `gear_items.photos` es `text`
 *     (migración 11) y PostgREST lo entrega como string. El cliente que empuja
 *     escribe `JSON.stringify(refs)`.
 *
 * Aceptar solo una de las dos formas fue el bug A1: con `Array.isArray()` la
 * segunda caía a `[]`, el conjunto declarado quedaba vacío y el firmante
 * devolvía `{ok:true, urls:{}}` para siempre — fotos de escaparate que nunca
 * cargaban, enmascaradas por el cubo 3D de respaldo.
 */
export function parsePhotos(value: unknown): PhotoLike[] {
  if (Array.isArray(value)) return value as PhotoLike[];
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as PhotoLike[]) : [];
  } catch {
    // Una fila con JSON corrupto no puede tumbar la firma del resto.
    return [];
  }
}

/** Los `photo_id` que un ítem declara, por `item_id`. */
export function declaredPhotoIds(
  rows: readonly { id?: unknown; photos?: unknown }[],
): Map<string, Set<string>> {
  const declared = new Map<string, Set<string>>();
  for (const row of rows) {
    const ids = new Set<string>();
    for (const photo of parsePhotos(row.photos)) {
      if (typeof photo?.id === "string") ids.add(photo.id);
    }
    declared.set(String(row.id), ids);
  }
  return declared;
}

export interface PhotoRef {
  item_id?: unknown;
  photo_id?: unknown;
  thumb?: unknown;
}

export interface WantedPhoto {
  /** Clave del mapa de respuesta: `itemId:photoId`. */
  key: string;
  itemId: string;
  photoId: string;
  path: string;
}

export type WantedResult =
  | { ok: true; wanted: WantedPhoto[] }
  | { ok: false; reason: "invalid" | "too_many" };

/**
 * Convierte lo que pide el cliente en la lista exacta de objetos a firmar.
 *
 * Un lote mixto (una ref válida y otra no) se rechaza ENTERO a propósito: firmar
 * la mitad y descartar el resto en silencio haría que la UI mostrara unas fotos y
 * no otras sin ninguna señal de error.
 */
export function buildWanted(
  rawRefs: unknown,
  owner: string,
  maxRefs: number,
): WantedResult {
  const refs = Array.isArray(rawRefs) ? (rawRefs as PhotoRef[]) : [];
  if (refs.length > maxRefs) return { ok: false, reason: "too_many" };

  const wanted: WantedPhoto[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const itemId = safeSegment(ref?.item_id);
    const photoId = safeSegment(ref?.photo_id);
    if (!itemId || !photoId) return { ok: false, reason: "invalid" };
    const key = `${itemId}:${photoId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push({
      key,
      itemId,
      photoId,
      path: objectPath(
        owner,
        itemId,
        photoId,
        ref?.thumb === false ? "full" : "thumb",
      ),
    });
  }
  return { ok: true, wanted };
}
