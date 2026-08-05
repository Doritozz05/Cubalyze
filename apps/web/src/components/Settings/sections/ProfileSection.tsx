"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  UserRound,
  Camera,
  RotateCcw,
  Download,
  Check,
  Loader2,
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
import { METHODS } from "@cubeforge/algorithm-db";
import { COUNTRIES, countryName } from "@/utils/countries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Puzzle types the app actually supports today (2×2 / 3×3). */
const PUZZLE_OPTIONS = ["2x2x2", "3x3x3"] as const;

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
  const { profile, loading, updateProfile } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // Draft state (local until Save) so the form never writes partial edits.
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [mainPuzzle, setMainPuzzle] = useState<string>("3x3x3");
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
      setMainPuzzle(profile.mainPuzzle || "3x3x3");
      setCountry(profile.country ?? "");
      setMethods(profile.declaredMethods ?? []);
    }
  }, [profile]);

  /** Validate the draft; returns the first problem as a user-facing message. */
  const validate = useCallback((): { ok: boolean; message?: string } => {
    const next: { handle?: string; bio?: string } = {};
    const h = handle.trim();
    if (h && !HANDLE_RE.test(h)) {
      next.handle =
        "3–20 characters: lowercase letters, numbers, underscore or dash.";
    }
    if (bio.length > MAX_BIO) {
      next.bio = `Keep it under ${MAX_BIO} characters (${bio.length}).`;
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
      toast.error(check.message ?? "Check the highlighted fields before saving");
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
      toast.success("Profile saved");
    } catch (err) {
      console.error("[ProfileSection] Save failed:", err);
      toast.error("Couldn't save the profile");
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
        toast.error("Please choose an image file (JPG, PNG, WebP, GIF or SVG)");
        return;
      }
      if (file.size > MAX_AVATAR_SOURCE_BYTES) {
        const mb = Math.round(MAX_AVATAR_SOURCE_BYTES / 1024 / 1024);
        toast.error(`Image too large — keep it under ${mb} MB`);
        return;
      }
      setUploadingAvatar(true);
      try {
        // Downscale + compress client-side so the stored payload is small
        // (phones produce multi-MB photos; the row stays light).
        const dataUrl = await processAvatarImage(file);
        await updateProfile({ avatarKind: "photo", avatarData: dataUrl });
        toast.success("Avatar updated");
      } catch (err) {
        console.error("[ProfileSection] Photo upload failed:", err);
        toast.error("Couldn't process that image — try a JPG, PNG or WebP");
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
      toast.success("Back to your CubeMark");
    } catch (err) {
      console.error("[ProfileSection] Reset identicon failed:", err);
      toast.error("Couldn't reset the avatar");
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
    toast.success("Profile exported");
  }, [profile]);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-ink-3">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading profile…
      </div>
    );
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
              alt="Profile avatar"
              className="size-24 shrink-0 rounded-2xl object-cover ring-1 ring-line"
            />
          ) : (
            <IdenticonAvatar
              seed={profile.userId}
              size={96}
              className="shrink-0 rounded-2xl ring-1 ring-line"
            />
          )}
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-sm font-semibold text-ink">
              {displayName.trim() || "Speedcuber"}
            </p>
            <p className="text-xs text-ink-3">
              {handle.trim() ? `@${handle}` : `@user-${profile.userId.slice(0, 6)}`}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[0.72rem] leading-relaxed text-ink-3">
            {isPhoto
              ? "You uploaded a photo. Your CubeMark is kept — you can always switch back."
              : "This is your CubeMark — a procedural identity generated from your user ID. It never changes when you rename yourself."}
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
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {uploadingAvatar ? "Processing…" : isPhoto ? "Change photo" : "Upload photo"}
            </Button>
            {isPhoto && (
              <Button type="button" variant="ghost" size="sm" onClick={resetIdenticon}>
                <RotateCcw className="size-3.5" />
                Reset identicon
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
        <Label htmlFor="profile-display-name">Display name</Label>
        <Input
          id="profile-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Speedcuber"
          maxLength={40}
        />
      </div>

      {/* ── Handle ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-handle">Handle</Label>
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
          <p className="text-[0.65rem] text-ink-3">
            Used to identify you across the platform. Leave empty to keep your
            generated one.
          </p>
        )}
      </div>

      {/* ── Bio ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="profile-bio">Bio</Label>
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
          placeholder="What kind of cuber are you?"
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
        <Label htmlFor="profile-country">Country</Label>
        {/* Radix Select forbids empty-string item values, so the "unset"
            option uses a 'none' sentinel mapped to '' on save. */}
        <Select value={country || "none"} onValueChange={(v) => setCountry(v === "none" ? "" : v)}>
          <SelectTrigger id="profile-country" className="w-full">
            <SelectValue placeholder="Select a country">
              {country ? (
                <span className="flex items-center gap-2">
                  <CountryFlag country={country} withTooltip={false} />
                  {countryName(country)}
                </span>
              ) : (
                "Select a country"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[50vh]">
            <SelectItem value="none">
              <span className="text-ink-3">Not set</span>
            </SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <CountryFlag country={c.code} withTooltip={false} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.65rem] text-ink-3">
          Shown next to your name and in your profile header.
        </p>
      </div>

      {/* ── Main puzzle ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5" role="group" aria-labelledby="profile-main-puzzle-label">
        <span
          id="profile-main-puzzle-label"
          className="text-sm font-medium leading-none text-ink"
        >
          Main puzzle
        </span>
        <div className="flex flex-wrap gap-2">
          {PUZZLE_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={mainPuzzle === p}
              onClick={() => setMainPuzzle(p)}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-[0.75rem] font-medium transition-all duration-150 cursor-pointer",
                mainPuzzle === p
                  ? "border-ink bg-ink text-surface"
                  : "border-line bg-surface-2/40 text-ink-2 hover:border-ink/40 hover:bg-surface-2",
              )}
            >
              {p}
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
          Declared methods
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
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {saving ? "Saving…" : "Save profile"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleExport}>
          <Download className="size-3.5" />
          Export profile (JSON)
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <UserRound className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
        <span className="text-[0.65rem] leading-relaxed text-ink-3">
          Your identity is stored locally on this device. The CubeMark is your
          visual fingerprint — the photo is an overlay you can remove at any
          time.
        </span>
      </div>
    </div>
  );
}
