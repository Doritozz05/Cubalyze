"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import {
  UserRound,
  Camera,
  RotateCcw,
  Download,
  Check,
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { IdenticonAvatar } from "@/components/Identity/IdenticonAvatar";
import { CountryFlag } from "@/components/Identity/CountryFlag";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/utils/exportSolves";
import {
  MAX_AVATAR_SOURCE_BYTES,
  processAvatarImage,
} from "@/utils/processAvatarImage";
import { METHODS } from "@cubalyze/algorithm-db";
import { countriesInLanguage, countryName } from "@/utils/countries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Puzzle types the app actually supports today (2×2 / 3×3). The buttons
 * show the human label ("3×3") while the stored value stays the canonical
 * puzzle_type code ("333", ADR-002) — never user-facing.
 */
const PUZZLE_OPTIONS: { value: string; label: string }[] = [
  { value: "222", label: "2×2" },
  { value: "333", label: "3×3" },
];

/** Methods selectable for the profile (from the algorithm catalog). */
const METHOD_NAMES = METHODS.map((m) => m.name);

const HANDLE_RE = /^[a-z0-9_-]{3,20}$/;
const MAX_BIO = 280;

/**
 * F5 (docs/plan_profile) — Profile identity editor.
 *
 * Fields: display name, @handle, bio, main puzzle, declared methods.
 * Avatar: keep the CubeMark identicon, upload a photo (base64 in
 * `profiles.avatar_data`), or reset back to the identicon — the CubeMark is
 * never deleted (D5: photo can always be removed and the identicon returns).
 * Validation uses the same zod `ProfileSchema`-shaped rules (handle format,
 * bio length, method list). Export downloads the profile as JSON.
 */
export function ProfileSection() {
  const { t } = useTranslation("settings");
  const { profile, identiconSeed, loading, updateProfile } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Draft state (local until Save) so the form never writes partial edits.
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [mainPuzzle, setMainPuzzle] = useState<string>("333");
  const [country, setCountry] = useState<string>("");
  const [methods, setMethods] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ handle?: string; bio?: string }>({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Initialize the draft exactly once when the DB row first loads. Syncing on
  // every `profile` change would wipe unsaved edits whenever an unrelated
  // update runs (e.g. uploading a photo mid-edit).
  const initializedRef = useRef(false);
  useEffect(() => {
    if (profile && !initializedRef.current) {
      initializedRef.current = true;
      setDisplayName(profile.displayName);
      setHandle(profile.handle);
      setBio(profile.bio);
      // Normalize any legacy spelling ('3x3x3', '2x2x2', '3x3', '2x2') to the
      // canonical codes the picker offers, so a legacy row always selects a
      // visible option instead of silently matching none.
      const mp = (profile.mainPuzzle || "").toLowerCase().replace(/\s+/g, "");
      setMainPuzzle(mp === "222" || mp === "2x2" || mp === "2x2x2" ? "222" : "333");
      setCountry(profile.country ?? "");
      setMethods(profile.declaredMethods ?? []);
    }
  }, [profile]);

  /** Validate the draft; returns the first problem as a user-facing message. */
  const validate = useCallback((): { ok: boolean; message?: string } => {
    const next: { handle?: string; bio?: string } = {};
    const h = handle.trim();
    if (h && !HANDLE_RE.test(h)) {
      next.handle = i18n.t("toast:handleValidation");
    }
    if (bio.length > MAX_BIO) {
      next.bio = i18n.t("toast:bioTooLong", { max: MAX_BIO, current: bio.length });
    }
    setErrors(next);
    const first = next.handle ?? next.bio;
    return first ? { ok: false, message: first } : { ok: true };
  }, [handle, bio]);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    const check = validate();
    if (!check.ok) {
      // Never fail silently: tell the user exactly what to fix.
      toast.error(check.message ?? i18n.t("toast:checkFields"));
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
        mainPuzzle,
        country,
        declaredMethods: methods,
      });
      toast.success(i18n.t("toast:profileSaved"));
    } catch (err) {
      console.error("[ProfileSection] Save failed:", err);
      toast.error(i18n.t("toast:profileSaveFailed"));
    } finally {
      setSaving(false);
    }
  }, [profile, validate, updateProfile, displayName, handle, bio, mainPuzzle, country, methods]);

  const toggleMethod = useCallback((name: string) => {
    setMethods((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name],
    );
  }, []);

  const handlePhoto = useCallback(
    async (file: File | undefined) => {
      if (!file || !profile) return;
      if (!file.type.startsWith("image/")) {
        toast.error(i18n.t("toast:chooseImageFile"));
        return;
      }
      if (file.size > MAX_AVATAR_SOURCE_BYTES) {
        const mb = Math.round(MAX_AVATAR_SOURCE_BYTES / 1024 / 1024);
        toast.error(i18n.t("toast:imageTooLarge", { mb }));
        return;
      }
      setUploadingAvatar(true);
      try {
        // Downscale + compress client-side so the stored payload is small
        // (phones produce multi-MB photos; the row stays light).
        const dataUrl = await processAvatarImage(file);
        await updateProfile({ avatarKind: "photo", avatarData: dataUrl });
        toast.success(i18n.t("toast:avatarUpdated"));
      } catch (err) {
        console.error("[ProfileSection] Photo upload failed:", err);
        toast.error(i18n.t("toast:avatarProcessFailed"));
      } finally {
        setUploadingAvatar(false);
      }
    },
    [profile, updateProfile],
  );

  const resetIdenticon = useCallback(async () => {
    if (!profile) return;
    try {
      await updateProfile({ avatarKind: "identicon", avatarData: undefined });
      toast.success(i18n.t("toast:avatarReset"));
    } catch (err) {
      console.error("[ProfileSection] Reset identicon failed:", err);
      toast.error(i18n.t("toast:avatarResetFailed"));
    }
  }, [profile, updateProfile]);

  const handleExport = useCallback(() => {
    if (!profile) return;
    const payload = JSON.stringify(profile, null, 2);
    downloadFile(
      payload,
      `cubeforge-profile-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
    );
    toast.success(i18n.t("toast:profileExported"));
  }, [profile]);

  if (loading || !profile) {
    return <Spinner variant="centered" size="md" />;
  }

  const isPhoto = profile.avatarKind === "photo";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Identity preview + avatar editor ─────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          {isPhoto && profile.avatarData ? (
            <img
              src={profile.avatarData}
              alt={t("profile.avatarAlt")}
              className="size-24 shrink-0 rounded-xl object-cover ring-1 ring-line"
            />
          ) : (
            <IdenticonAvatar
              seed={identiconSeed ?? profile.userId}
              size={96}
              className="shrink-0 rounded-xl ring-1 ring-line"
            />
          )}
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-sm font-semibold text-ink">
              {displayName.trim() || t("profile.defaultName")}
            </p>
            <p className="text-xs text-ink-3">
              {handle.trim() ? `@${handle}` : `@user-${profile.userId.slice(0, 6)}`}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[0.72rem] leading-relaxed text-ink-3">
            {isPhoto
              ? t("profile.photoInfo")
              : t("profile.identiconInfo")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <Spinner size="xs" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {uploadingAvatar
                ? t("profile.processing")
                : isPhoto
                  ? t("profile.changePhoto")
                  : t("profile.uploadPhoto")}
            </Button>
            {isPhoto && (
              <Button type="button" variant="ghost" size="sm" onClick={resetIdenticon}>
                <RotateCcw className="size-3.5" />
                {t("profile.resetIdenticon")}
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void handlePhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* ── Display name ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-display-name">{t("profile.displayName")}</Label>
        <Input
          id="profile-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("profile.defaultName")}
          maxLength={40}
        />
      </div>

      {/* ── Handle ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-handle">{t("profile.handle")}</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
            @
          </span>
          <Input
            id="profile-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="speedcuber"
            className={cn("pl-7", errors.handle && "border-dnf")}
            aria-invalid={Boolean(errors.handle)}
            aria-describedby={errors.handle ? "profile-handle-error" : undefined}
          />
        </div>
        {errors.handle ? (
          <p id="profile-handle-error" className="text-[0.68rem] text-dnf">
            {errors.handle}
          </p>
        ) : (
          <p className="text-[0.65rem] text-ink-3">{t("profile.handleHint")}</p>
        )}
      </div>

      {/* ── Bio ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="profile-bio">{t("profile.bio")}</Label>
          <span
            className={cn(
              "text-[0.6rem]",
              bio.length > MAX_BIO ? "text-dnf" : "text-ink-3",
            )}
          >
            {bio.length}/{MAX_BIO}
          </span>
        </div>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("profile.bioPlaceholder")}
          rows={3}
          maxLength={MAX_BIO + 40}
          aria-invalid={Boolean(errors.bio)}
          aria-describedby={errors.bio ? "profile-bio-error" : undefined}
        />
        {errors.bio ? (
          <p id="profile-bio-error" className="text-[0.68rem] text-dnf">
            {errors.bio}
          </p>
        ) : null}
      </div>

      {/* ── Country ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-country">{t("profile.country")}</Label>
        {/* Radix Select forbids empty-string item values, so the "unset"
            option uses a 'none' sentinel mapped to '' on save. */}
        <Select value={country || "none"} onValueChange={(v) => setCountry(v === "none" ? "" : v)}>
          <SelectTrigger id="profile-country" className="w-full">
            <SelectValue placeholder={t("profile.selectCountry")}>
              {country ? (
                <span className="flex items-center gap-2">
                  <CountryFlag country={country} withTooltip={false} />
                  {countryName(country)}
                </span>
              ) : (
                t("profile.selectCountry")
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[50vh]">
            <SelectItem value="none">
              <span className="text-ink-3">{t("profile.notSet")}</span>
            </SelectItem>
            {countriesInLanguage(i18n.language).map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <CountryFlag country={c.code} withTooltip={false} />
                  {countryName(c.code)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.65rem] text-ink-3">{t("profile.countryHint")}</p>
      </div>

      {/* ── Main puzzle ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5" role="group" aria-labelledby="profile-main-puzzle-label">
        <span
          id="profile-main-puzzle-label"
          className="text-sm font-medium leading-none text-ink"
        >
          {t("profile.mainPuzzle")}
        </span>
        <div className="flex flex-wrap gap-2">
          {PUZZLE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mainPuzzle === value}
              onClick={() => setMainPuzzle(value)}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-[0.75rem] font-medium transition-all duration-150 cursor-pointer",
                mainPuzzle === value
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface-2/40 text-ink-2 hover:border-ink/40 hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Declared methods ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5" role="group" aria-labelledby="profile-methods-label">
        <span
          id="profile-methods-label"
          className="text-sm font-medium leading-none text-ink"
        >
          {t("profile.declaredMethods")}
        </span>
        <div className="flex flex-wrap gap-2">
          {METHOD_NAMES.map((name) => {
            const active = methods.includes(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMethod(name)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.7rem] font-medium transition-all duration-150 cursor-pointer",
                  active
                    ? "border-ink/40 bg-surface-2 text-ink shadow-xs"
                    : "border-line bg-surface-2/30 text-ink-3 hover:border-ink/30 hover:text-ink-2",
                )}
              >
                {active && <Check className="mr-1 inline size-3" />}
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Spinner size="xs" /> : <Check className="size-3.5" />}
          {saving ? t("profile.saving") : t("profile.saveProfile")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          {t("profile.exportProfile")}
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <UserRound className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
        <span className="text-[0.65rem] leading-relaxed text-ink-3">
          {t("profile.identityNote")}
        </span>
      </div>
    </div>
  );
}
