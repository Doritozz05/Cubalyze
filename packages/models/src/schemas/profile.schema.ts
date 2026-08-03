import { z } from 'zod';

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
  mainPuzzle: z.string().default('3x3x3'),
  declaredMethods: z.array(z.string()).default([]),
  createdAt: z.number().int().default(0),
  updatedAt: z.number().int().default(0),
});

export type Profile = z.infer<typeof ProfileSchema>;
