// Supabase Edge Function: delete the signed-in user's account permanently.
// Uses the service role to delete the auth user; the RLS `ON DELETE CASCADE`
// on every sync table removes all of their cloud data.
//
// Invoked from the web app (Settings → Account → Delete account) with the
// user's access token in the Authorization header.
//
// The browser sends `Authorization` + `apikey` headers, which triggers a CORS
// preflight OPTIONS — without the headers below the gateway 401s it and the
// actual request never fires (the app showed "no se pudo eliminar la cuenta").
//
// Deno Deploy runtime (esm.sh import) — do not add npm imports.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PHOTO_BUCKET = "locker-photos";

/**
 * Remove every object under the user's folder in the Locker bucket.
 *
 * Layout is `{user_id}/{item_id}/{photo_id}/{full|thumb}.jpg`, so this walks
 * the folders (Storage `list` returns placeholder entries with `id === null`
 * for folders) and removes the files in batches. Bounded depth guards against
 * an unexpected tree.
 */
async function purgeUserPhotos(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const paths: string[] = [];

  const collect = async (prefix: string, depth: number): Promise<void> => {
    if (depth > 4) return;
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .list(prefix, { limit: 1000 });
    if (error) {
      // A bucket that was never created is not an error for a delete path.
      console.warn(`[delete-account] list ${prefix} failed:`, error.message);
      return;
    }
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null) await collect(path, depth + 1);
      else paths.push(path);
    }
  };

  await collect(userId, 0);

  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove(paths.slice(i, i + 100));
    if (error) console.warn("[delete-account] remove photos failed:", error.message);
  }
}

Deno.serve(async (req) => {
  // CORS preflight — answer immediately, no JWT needed for OPTIONS.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("server misconfigured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response("missing token", {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response("unauthorized", {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Storage objects have NO foreign key to auth.users, so the RLS cascade that
  // removes every row does not touch the Locker's photos: without this purge a
  // deleted account leaves `{user_id}/…` objects behind forever (F9).
  // Best-effort and BEFORE the user delete: a failure must not keep the
  // account alive (privacy first), but it is logged so it can be retried.
  try {
    await purgeUserPhotos(supabase, user.id);
  } catch (err) {
    console.warn("[delete-account] photo purge failed:", err);
  }

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[delete-account] deleteUser failed:", error.message);
    return new Response(error.message, {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
