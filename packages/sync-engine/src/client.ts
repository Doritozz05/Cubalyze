import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Credentials for the Supabase project. The web app passes its `import.meta.env`
 * object in; the package stays Vite-free so it typechecks and tests in isolation.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/** Extract `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from an env bag. */
export function readSupabaseEnv(
  source: Record<string, unknown>,
): SupabaseEnv | null {
  const url =
    typeof source.VITE_SUPABASE_URL === "string"
      ? source.VITE_SUPABASE_URL.trim()
      : "";
  const anonKey =
    typeof source.VITE_SUPABASE_ANON_KEY === "string"
      ? source.VITE_SUPABASE_ANON_KEY.trim()
      : "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(source: Record<string, unknown>): boolean {
  return readSupabaseEnv(source) !== null;
}

/**
 * PKCE flow: the recommended OAuth flow for SPAs (no implicit-token in the
 * URL, robust against token leakage in history/referrer). Google OAuth
 * redirects back to `/auth`, where the client exchanges the code.
 */
export function createSupabaseClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
}
