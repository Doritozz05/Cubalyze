/**
 * Fase 8 — identidad pública (`handle`).
 *
 * A handle is not a local field with a validation rule: it is a claim on a
 * name that only one account can own, so only the server can grant it. This
 * module is the client's half of `handle_claim`:
 *
 *   1. ask the server (`handle_claim`) — it normalizes, checks availability and
 *      writes the row itself;
 *   2. adopt the result locally with the SERVER's stamp, never a local one.
 *
 * Step 2 is what makes the claim survive the next cycle. Writing the handle
 * with a local stamp would be worse than useless: the server row would then
 * look older than the local row, LWW would keep the local copy and the pull
 * would never deliver the server's — the identity would exist on the cloud and
 * not in the app. Adopting the server's stamp also means the next `push` is a
 * no-op for this row and the next `pull` converges instead of fighting.
 *
 * The push watermark is deliberately NOT advanced past the claim, so a local
 * profile edit that is still pending (display name, bio) keeps its place in the
 * queue. Worst case the claim costs one extra profile row per push.
 *
 * Failure modes are all "the handle did not change locally":
 *   - `taken`        — someone else owns it; the server offers a suggestion.
 *   - `invalid`      — rejected by the format (length, charset, reserved).
 *   - `rate_limited` — too many attempts for now. NOT a format problem: telling
 *                      the user "pick another name" when the server is simply
 *                      saying "slow down" is the kind of wrong instruction that
 *                      makes people retype a perfectly good handle forever.
 *   - `offline`      — the RPC could not be reached (transport, or a server
 *                      error we cannot interpret).
 *   - `unauthorized` — no valid session; the fix is signing in, not the network.
 *
 * `taken` reveals that a handle exists. That is inherent to "add by handle"
 * and accepted in the plan (§6.4); what is avoided is enumeration at rate — the
 * exact format narrows the space and `handle_claim` itself enforces a burst
 * window plus a daily ceiling, so `taken` cannot be swept.
 */

import type { SyncContext } from "./types";

export type HandleClaimFailure =
  | "taken"
  | "invalid"
  | "offline"
  | "unauthorized"
  | "rate_limited";

export type HandleClaimResult =
  | { ok: true; handle: string }
  | { ok: false; reason: "taken"; suggestion: string | null }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "offline" }
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "rate_limited" };

interface ClaimResponse {
  ok?: unknown;
  handle?: unknown;
  reason?: unknown;
  suggestion?: unknown;
  updated_at?: unknown;
}

/**
 * Claim `raw` as this account's public handle. Never throws for a *rejected*
 * claim (including no network) — a failed claim is a normal outcome the UI must
 * be able to render, not an exception.
 *
 * Throws only when called without an account: that is a programming error, and
 * `handle_claim` would reject it server-side anyway.
 */
export async function claimHandle(
  ctx: SyncContext,
  uid: string,
  raw: string,
): Promise<HandleClaimResult> {
  if (!uid) throw new Error("claimHandle requires a signed-in account");

  let data: unknown;
  try {
    const { data: res, error } = await ctx.supabase.rpc("handle_claim", {
      p_handle: raw,
    });
    if (error) {
      // 401 is NOT a network problem, and saying "you appear to be offline"
      // for a signed-out session sends the user to check their wifi. The two
      // are actionable in different places, so they stay distinct.
      const status = (error as { status?: number }).status;
      return { ok: false, reason: status === 401 ? "unauthorized" : "offline" };
    }
    data = res;
  } catch {
    // Network down or a server error: "we do not know whether the name is
    // yours", so the local row is left untouched and the user can retry.
    return { ok: false, reason: "offline" };
  }

  const payload = (data ?? {}) as ClaimResponse;
  if (payload.ok !== true) {
    if (payload.reason === "taken") {
      return {
        ok: false,
        reason: "taken",
        suggestion: typeof payload.suggestion === "string" ? payload.suggestion : null,
      };
    }
    // `rate_limited` is its own outcome, not a format error: the handle may be
    // perfectly free, the server is just refusing to answer right now.
    if (payload.reason === "rate_limited") {
      return { ok: false, reason: "rate_limited" };
    }
    // Any other rejection is a version skew, and `invalid` is the honest
    // answer: we could not establish this handle. It prompts the user to
    // choose another, which is the safe direction (never claim something we
    // did not verify).
    return { ok: false, reason: "invalid" };
  }

  const handle = String(payload.handle ?? "");
  if (handle === "") return { ok: false, reason: "invalid" };

  const seal = Number(payload.updated_at);
  const hasSeal = Number.isFinite(seal) && seal > 0;

  const local = await ctx.profiles.getOrCreate(uid);
  if (local.handle !== handle || hasSeal) {
    await ctx.profiles.upsert({
      ...local,
      handle,
      // The idempotent branch ("it was already yours") returns no `updated_at`:
      // keep the local stamp rather than regressing it to 0.
      updatedAt: hasSeal ? seal : local.updatedAt,
    });
  }

  return { ok: true, handle };
}
