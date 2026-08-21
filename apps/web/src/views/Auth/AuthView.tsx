"use client";

/**
 * /auth — the sign-in page (Google-only), rendered STANDALONE outside the
 * app shell (like NotFoundView). Vercel-style: one centered card, the brand
 * tile, a single "Continue with Google" button, quiet privacy microcopy.
 * If a session already exists it redirects straight to /profile.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Box } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { markAppReady } from "@/boot/appReady";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { GoogleIcon } from "@/components/Account/GoogleIcon";

export function AuthView() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const { user, loading, configured, signInWithGoogle } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDocumentTitle(t("title"));

  // The auth page is rendered outside the shell — signal the boot loader so
  // it never waits for shell data that won't come.
  useEffect(() => {
    markAppReady();
  }, []);

  // Already signed in → profile.
  useEffect(() => {
    if (!loading && user) {
      navigate("/profile", { replace: true });
    }
  }, [loading, user, navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Full-page OAuth redirect: the browser leaves this page and returns
      // to /auth with the PKCE code — nothing else to do here.
    } catch (err) {
      console.error("[AuthView] sign-in failed:", err);
      setError(t("errorGeneric"));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-line bg-surface p-8 shadow-sm">
          {/* Brand tile — the carbon square holding the mark */}
          <div className="mb-6 grid size-12 place-items-center rounded-lg bg-ink text-surface">
            <Box className="size-6" aria-hidden="true" />
          </div>

          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-3">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 text-lg font-semibold leading-tight text-ink">
            {t("title")}
          </h1>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-3">
            {t("subtitle")}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => void handleGoogle()}
              disabled={busy || loading}
              className="h-10 w-full justify-center gap-2.5 rounded-md border border-line bg-surface text-ink shadow-xs hover:bg-surface-2"
            >
              {busy ? <Spinner size="xs" /> : <GoogleIcon size={18} />}
              {t("continueWithGoogle")}
            </Button>

            {error && (
              <p className="text-center text-[0.68rem] text-dnf">{error}</p>
            )}
            {!configured && (
              <p className="text-center text-[0.68rem] text-caution">
                {t("errorNotConfigured")}
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-[0.62rem] leading-relaxed text-ink-3">
            {t("privacyNote")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/timer")}
          className="mx-auto mt-5 flex cursor-pointer items-center gap-1.5 text-[0.7rem] text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 rounded-md px-2 py-1"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t("backToTimer")}
        </button>
      </div>
    </div>
  );
}
