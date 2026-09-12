"use client";

/**
 * FriendAvatar — how another person looks in the friends UI.
 *
 * Two states only, and the choice is made by the friend's own profile (the
 * `avatar_kind` they pushed), never by us: a photo if they uploaded one, their
 * CubeMark otherwise. The CubeMark seed is their `user_id` — the same rule the
 * app uses for its own identity (D2: the mark is derived from the identity
 * key, so it never changes and can't be spoofed by renaming yourself).
 *
 * The avatar is decorative in every current usage (the display name always
 * renders next to it), so it is `aria-hidden` like `IdenticonAvatar`.
 */

import { cn } from "@/lib/utils";
import { IdenticonAvatar } from "@/components/Identity/IdenticonAvatar";
import type { FriendProfile } from "@/services/friends";

export interface FriendAvatarProps {
  profile: Pick<FriendProfile, "userId" | "displayName" | "avatarKind" | "avatarData">;
  /** Pixel size of the square. */
  size?: number;
  className?: string;
}

export function FriendAvatar({ profile, size = 40, className }: FriendAvatarProps) {
  if (profile.avatarKind === "photo" && profile.avatarData) {
    return (
      <img
        src={profile.avatarData}
        alt=""
        aria-hidden="true"
        draggable={false}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn("shrink-0 rounded-full border border-line object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn("shrink-0 overflow-hidden rounded-full border border-line", className)}
      style={{ width: size, height: size }}
    >
      <IdenticonAvatar seed={profile.userId} size={size} tile="transparent" />
    </span>
  );
}
