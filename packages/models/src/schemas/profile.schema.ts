import { z } from 'zod';
import { isDbPuzzleType } from '@cubalyze/events';

/** How the user's avatar is rendered: procedural identicon or uploaded photo. */
export const AvatarKindSchema = z.enum(['identicon', 'photo']);

/**
 * The user's identity/profile row (single local user today; forward-compatible
 * with future accounts via `userId` as the stable identity key).
 */
export const ProfileSchema = z.object({
  /** Stable anonymous local id (crypto.randomUUID), persisted in app_meta. */
  userId: z.string().uuid(),
  displayName: z.string().default(''),
  handle: z.string().default(''),
  bio: z.string().default(''),
  avatarKind: AvatarKindSchema.default('identicon'),
  /** Base64 blob — only set when avatarKind === 'photo'. */
  avatarData: z.string().optional(),
  /**
   * Main puzzle (WCA event code, ADR-002: '333', '222', …). Validated
   * against the event registry — the profile layer uses the same canonical
   * codes as solves/sessions, never the legacy '3x3x3'/'2x2x2' spellings.
   */
  mainPuzzle: z.string().refine(isDbPuzzleType, {
    message: 'Unknown puzzle_type — must be a WCA event code declared by the registry',
  }).default('333'),
  declaredMethods: z.array(z.string()).default([]),
  /** ISO 3166-1 alpha-2 country code (e.g. 'ES'); empty string = unset. */
  country: z.string().default(''),
  createdAt: z.number().int().default(0),
  updatedAt: z.number().int().default(0),
});

export type Profile = z.infer<typeof ProfileSchema>;
