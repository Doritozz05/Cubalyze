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
