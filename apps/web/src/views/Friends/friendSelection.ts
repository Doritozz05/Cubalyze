"use client";

/**
 * friendSelection — one-shot handoff of "open this friend" across views.
 *
 * `onNavigate` only carries a `ViewId`, so the profile friends panel cannot
 * pass the selected user through navigation props. Instead it stashes the id
 * here and navigates; `FriendsView` consumes it on mount and selects the
 * friend. Consuming clears the slot, so a later visit to Friends starts
 * unselected and StrictMode double-effects are harmless (second read is null).
 */

let pendingUserId: string | null = null;

/** Stage a friend to open on the Friends view. Overwrites any prior request. */
export function requestFriendSelection(userId: string): void {
  pendingUserId = userId;
}

/**
 * Take the staged selection, if any. Returns the user id once — every later
 * call returns null until a new request arrives.
 */
export function consumeFriendSelection(): string | null {
  const next = pendingUserId;
  pendingUserId = null;
  return next;
}
