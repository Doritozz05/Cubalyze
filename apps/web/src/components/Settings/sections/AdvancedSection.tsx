"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  Wrench,
  RotateCcw,
  Bug,
  Database,
  Flag,
  FlaskConical,
  CheckCircle2,
  TriangleAlert,
  HardDrive,
} from "lucide-react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubeforge/state";
import { SettingToggle } from "../components/SettingToggle";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useStorageStatusStore } from "@/stores/storageStatus";
import { isDev, isTauri, isLocalhost } from "@/utils/env";

/** Storage-type → human label. */
const STORAGE_LABEL: Record<string, string> = {
  opfs: "Persistent (OPFS)",
  desktop: "Desktop (file)",
  memory: "In-memory (volatile)",
  unknown: "Unknown",
};

/** Keys under the app's namespace in localStorage. */
const APP_STORAGE_KEYS = ["cubeforge-prefs", "cubeforge:activeSessionId"];

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

/** Live storage usage (navigator.storage.estimate) for the inspector. */
function useStorageEstimate() {
  const [estimate, setEstimate] = useState<{ usage: number | null; quota: number | null }>({
    usage: null,
    quota: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then(({ usage, quota }) => {
          if (!cancelled) setEstimate({ usage: usage ?? null, quota: quota ?? null });
        })
        .catch(() => {
          if (!cancelled) setEstimate({ usage: null, quota: null });
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return estimate;
}

/** localStorage entries owned by the app (for the storage inspector). */
function useAppStorageEntries() {
  const [entries, setEntries] = useState<{ key: string; bytes: number }[]>([]);

  const refresh = () => {
    if (typeof window === "undefined") return;
    const out: { key: string; bytes: number }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key) ?? "";
      // Only app-namespaced keys (cubeforge-*) plus anything huge.
      if (key.startsWith("cubeforge") || value.length > 2048) {
        out.push({ key, bytes: new Blob([value]).size });
      }
    }
    setEntries(out.sort((a, b) => b.bytes - a.bytes));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { entries, refresh };
}

/**
 * Advanced settings section.
 *
 * Developer-oriented controls:
 *   - Reset all options (preferences back to defaults).
 *   - Debug logs toggle (stored as a preference flag).
 *   - Storage inspector (backend type, quota usage, app localStorage keys).
 *   - Development environment flags (read-only diagnostics).
 *   - Beta features toggle.
 */
export function AdvancedSection() {
  const betaFeatures = useStore(preferencesStore, (s) => s.betaFeatures);
  const setBetaFeatures = useStore(preferencesStore, (s) => s.setBetaFeatures);
  const resetPreferences = useStore(preferencesStore, (s) => s.resetPreferences);

  const storageType = useStorageStatusStore((s) => s.storageType);
  const { usage, quota } = useStorageEstimate();
  const { entries, refresh } = useAppStorageEntries();

  // Debug logs = durable localStorage flag (mirrors ?cfop_debug=1).
  const [debugLogs, setDebugLogs] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("cubeforge:cfop-debug") === "1";
  });

  const handleToggleDebugLogs = (v: boolean) => {
    setDebugLogs(v);
    if (v) {
      window.localStorage.setItem("cubeforge:cfop-debug", "1");
      toast.success(i18n.t("toast:debugLogsEnabled"));
    } else {
      window.localStorage.removeItem("cubeforge:cfop-debug");
      toast.success(i18n.t("toast:debugLogsDisabled"));
    }
  };

  const envFlags = useMemo(
    () => [
      { key: "dev-server", label: "Dev server", value: isDev() },
      { key: "tauri", label: "Desktop (Tauri)", value: isTauri() },
      { key: "localhost", label: "Localhost", value: isLocalhost() },
    ],
    [],
  );

  const handleReset = () => {
    resetPreferences();
    toast.success(i18n.t("toast:optionsReset"));
  };

  const handleClearAppStorage = () => {
    if (typeof window === "undefined") return;
    for (const key of APP_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
    toast.success(i18n.t("toast:storageCleared"));
    refresh();
  };

  const envActive = envFlags.filter((f) => f.value).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Wrench className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          Developer tools, data and debugging. Use with care.
        </p>
      </div>

      {/* ── Reset options ───────────────────────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-dnf/25 bg-dnf/[0.03] p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <RotateCcw className="size-3.5 text-dnf" />
            Reset all options
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            Restore every preference — theme, timer, scramble, notifications — to its
            default value. Your solves, profile and training data are untouched.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-dnf/30 text-dnf hover:bg-dnf/10 hover:text-dnf"
            >
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base">Reset all options?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This restores every app preference to its default. Your solve data,
                profile and training progress are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="max-lg:h-11 h-8 text-xs">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="max-lg:h-11 h-8 bg-dnf text-xs text-white hover:bg-dnf/90"
                onClick={handleReset}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ── Debug / logs ────────────────────────────────────────────── */}
      <SettingToggle
        title="Debug logs"
        description="Enable verbose per-solve diagnostics in the browser console (move data, BLE audit, analysis pipeline). Mostly useful when reporting bugs."
        checked={debugLogs}
        onCheckedChange={handleToggleDebugLogs}
      />

      {/* ── Beta features ───────────────────────────────────────────── */}
      <SettingToggle
        title="Beta features"
        description="Opt in to experimental features that are still in development. Turn this off if something feels unstable."
        checked={betaFeatures}
        onCheckedChange={setBetaFeatures}
      />

      {/* ── Storage inspector ───────────────────────────────────────── */}
      <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
              <Database className="size-3.5 text-ink-2" />
              Storage inspector
            </h4>
            <p className="mt-1.5 text-[0.72rem] leading-5 text-ink-3">
              Where your data lives and how much space it uses.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">Backend</p>
            <p className="mt-1 flex items-center gap-1.5 text-[0.8rem] font-medium text-ink">
              <HardDrive className="size-3.5 text-ink-2" />
              {STORAGE_LABEL[storageType] ?? storageType}
            </p>
            {storageType === "memory" && (
              <p className="mt-1 flex items-center gap-1 text-[0.6rem] text-dnf">
                <TriangleAlert className="size-3" />
                Data lost on reload — export regularly
              </p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">Used</p>
            <p className="mt-1 text-[0.8rem] font-medium text-ink">{formatBytes(usage)}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">Quota</p>
            <p className="mt-1 text-[0.8rem] font-medium text-ink">{formatBytes(quota)}</p>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <div className="max-h-36 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-3 border-b border-line/50 px-3 py-1.5 text-[0.68rem] last:border-0"
                >
                  <span className="truncate font-mono text-ink-2">{entry.key}</span>
                  <span className="nums shrink-0 text-ink-3">{formatBytes(entry.bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[0.62rem] text-ink-3">
            Clearing app storage resets preferences & session id (a reload is required).
          </p>
          <Button variant="outline" size="sm" onClick={handleClearAppStorage}>
            Clear app storage
          </Button>
        </div>
      </div>

      {/* ── Dev flags ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
          <Flag className="size-3.5 text-ink-2" />
          Environment flags
        </h4>
        <p className="mt-1.5 text-[0.72rem] leading-5 text-ink-3">
          Runtime environment detected by the app — useful when sharing bug reports.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {envFlags.map((flag) => (
            <span
              key={flag.key}
              className={
                flag.value
                  ? "inline-flex items-center gap-1.5 rounded-md border border-ready/25 bg-ready/5 px-2.5 py-1 text-[0.68rem] font-medium text-ready"
                  : "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/40 px-2.5 py-1 text-[0.68rem] font-medium text-ink-3"
              }
            >
              {flag.value ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <span className="size-1.5 rounded-full bg-line-2" />
              )}
              {flag.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/40 px-2.5 py-1 text-[0.68rem] font-medium text-ink-3">
            <Bug className="size-3" />
            {envActive} active
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
        <span className="text-[0.65rem] leading-5 text-ink-3">
          Changes here affect only this device. Reset options is safe — it never deletes
          solves, profile or training progress.
        </span>
      </div>
    </div>
  );
}
