"use client";

/**
 * friendsCopy.ts — one place that turns a failure reason into a sentence.
 *
 * The map is `Record<FriendsFailure, …>`, so it is **exhaustive by type**: the
 * day the server grows a reason (or the service starts reporting one it did
 * not before), the build fails here instead of a screen silently showing a
 * missing translation or, worse, the wrong sentence.
 *
 * Why a map instead of `t(`failure.${reason}`)`: template-literal keys defeat
 * the project's typed i18n (`ParseKeys`), and a typo in the key would only
 * surface at runtime, in the one path nobody tests — a rejection.
 */

import type { ParseKeys } from "i18next";
import type { FriendsFailure, FriendProfile } from "@/services/friends";

export const FRIEND_FAILURE_KEY: Record<FriendsFailure, ParseKeys<"friends">> = {
  offline: "failure.offline",
  unauthorized: "failure.unauthorized",
  not_friends: "failure.not_friends",
  not_shared: "failure.not_shared",
  invalid: "failure.invalid",
  taken: "failure.taken",
  not_found: "failure.not_found",
  self: "failure.self",
  closed: "failure.closed",
  already_friends: "failure.already_friends",
  pending: "failure.pending",
  not_pending: "failure.not_pending",
  rate_limited: "failure.rate_limited",
  // The catch-all: a reason this client version does not know. Saying "algo
  // fue mal" is honest; pretending it was `invalid` would not be.
  unknown: "failure.unknown",
};

/** How a person is named in one line: display name, or the handle, or both. */
export function displayNameOf(profile: FriendProfile): string {
  return profile.displayName.trim() || (profile.handle ? `@${profile.handle}` : "");
}
